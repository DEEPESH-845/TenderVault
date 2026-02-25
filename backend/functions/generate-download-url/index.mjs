import { getItem } from '../../shared/db.mjs';
import { generatePresignedGet, PRESIGNED_URL_EXPIRY } from '../../shared/s3.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext } from '../../shared/errors.mjs';

const TENDERS_TABLE = process.env.TENDERS_TABLE;
const BIDS_TABLE = process.env.BIDS_TABLE;
const BIDS_BUCKET = process.env.BIDS_BUCKET;

/**
 * GET /tenders/{tenderId}/bids/{bidderId}/download-url
 *
 * THE TIME-LOCK LAMBDA — MOST CRITICAL FUNCTION IN THE SYSTEM.
 *
 * Generates a pre-signed GET URL for bid download, but ONLY after the tender
 * deadline has passed. The time-lock check is the FIRST business logic after
 * authentication — no S3 call is made if the tender is still locked.
 *
 * Accessible by: tv-admin, tv-evaluator
 */
export async function handler(event, context) {
  const requestId = context.awsRequestId;

  try {
    const { userId, groups, ipAddress, userAgent } = extractRequestContext(event);
    const tenderId = event.pathParameters?.tenderId;
    const bidderId = event.pathParameters?.bidderId;

    // 1. Role check — tv-admin or tv-evaluator only
    if (!groups.includes('tv-admin') && !groups.includes('tv-evaluator')) {
      await writeAuditEvent({
        action: 'DOWNLOAD_URL_GENERATED',
        userId,
        userRole: groups[0],
        tenderId,
        result: 'DENIED',
        ipAddress,
        userAgent,
        metadata: { reason: 'Insufficient role', targetBidderId: bidderId },
      });
      return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only officers and evaluators can download bids', 403, requestId);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  TIME-LOCK CHECK — MUST BE FIRST BUSINESS LOGIC AFTER AUTH ║
    // ║  NO S3 CALL IS MADE IF THE TENDER IS STILL LOCKED          ║
    // ╚══════════════════════════════════════════════════════════════╝

    // 2. Fetch tender from DynamoDB
    const tender = await getItem(TENDERS_TABLE, { tenderId });
    if (!tender) {
      return errorResponse('TENDER_NOT_FOUND', 'Tender does not exist', 404, requestId);
    }

    // 3. THE TIME-LOCK CHECK
    const now = Date.now();
    const deadlineMs = new Date(tender.deadline).getTime();

    if (now < deadlineMs) {
      // TIME-LOCKED — DENY ACCESS
      await writeAuditEvent({
        action: 'DOWNLOAD_DENIED_TIMELOCKED',
        userId,
        userRole: groups[0],
        tenderId,
        result: 'DENIED',
        ipAddress,
        userAgent,
        metadata: {
          targetBidderId: bidderId,
          deadlineMs: String(deadlineMs),
          attemptMs: String(now),
          gap: `${Math.ceil((deadlineMs - now) / 1000)}s`,
        },
      });

      return {
        statusCode: 423,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
        body: JSON.stringify({
          error: 'TENDER_LOCKED',
          message: 'Bids cannot be accessed before the tender deadline',
          unlocksAt: tender.deadline,
          secondsRemaining: Math.ceil((deadlineMs - now) / 1000),
          requestId,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // TIME-LOCK PASSED — proceed to generate download URL
    // ═══════════════════════════════════════════════════════════════

    // 4. Fetch bid from BidsTable
    const bid = await getItem(BIDS_TABLE, { tenderId, bidderId });
    if (!bid) {
      return errorResponse('BID_NOT_FOUND', 'No bid found for this bidder on this tender', 404, requestId);
    }

    // 5. Generate pre-signed GET URL
    const downloadUrl = await generatePresignedGet({
      bucket: BIDS_BUCKET,
      key: bid.s3Key,
      versionId: bid.currentVersionId,
      fileName: bid.fileName,
    });

    // 6. Write audit event
    await writeAuditEvent({
      action: 'DOWNLOAD_URL_GENERATED',
      userId,
      userRole: groups[0],
      tenderId,
      fileKey: bid.s3Key,
      versionId: bid.currentVersionId,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { targetBidderId: bidderId },
    });

    // 7. Return download URL — NEVER log this (it is a credential)
    return successResponse(200, {
      downloadUrl,
      fileName: bid.fileName,
      fileSize: bid.fileSize,
      versionId: bid.currentVersionId,
      expiresIn: PRESIGNED_URL_EXPIRY,
    });
  } catch (error) {
    console.error('[GENERATE_DOWNLOAD_URL_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
