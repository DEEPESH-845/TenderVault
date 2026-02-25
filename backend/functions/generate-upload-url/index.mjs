import { getItem, putItem } from '../../shared/db.mjs';
import { generatePresignedPut, PRESIGNED_URL_EXPIRY } from '../../shared/s3.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext, parseBody, AppError } from '../../shared/errors.mjs';
import { validateBidUploadRequest } from '../../shared/validate.mjs';

const TENDERS_TABLE = process.env.TENDERS_TABLE;
const BIDS_TABLE = process.env.BIDS_TABLE;
const BIDS_BUCKET = process.env.BIDS_BUCKET;

/**
 * POST /tenders/{tenderId}/bids/upload-url — Generate pre-signed PUT URL for bid upload.
 * tv-bidder only. Checks tender exists, is OPEN, and deadline is in the future.
 */
export async function handler(event, context) {
  const requestId = context.awsRequestId;

  try {
    const { userId, groups, ipAddress, userAgent } = extractRequestContext(event);
    const tenderId = event.pathParameters?.tenderId;

    // 1. Role check — tv-bidder only
    if (!groups.includes('tv-bidder')) {
      await writeAuditEvent({
        action: 'UPLOAD_URL_GENERATED',
        userId,
        userRole: groups[0],
        tenderId,
        result: 'DENIED',
        ipAddress,
        userAgent,
        metadata: { reason: 'Insufficient role' },
      });
      return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only bidders can submit bids', 403, requestId);
    }

    // 2. Validate request body
    const body = parseBody(event);
    const { fileName, contentType, fileSize } = validateBidUploadRequest(body);

    // 3. Fetch tender
    const tender = await getItem(TENDERS_TABLE, { tenderId });
    if (!tender) {
      return errorResponse('TENDER_NOT_FOUND', 'Tender does not exist', 404, requestId);
    }

    // 4. Check tender status
    if (tender.status !== 'OPEN') {
      return errorResponse('TENDER_ALREADY_CLOSED', 'This tender is no longer accepting bids', 400, requestId);
    }

    // 5. Check deadline — MUST be in the future for uploads
    const now = Date.now();
    const deadlineMs = new Date(tender.deadline).getTime();
    if (now >= deadlineMs) {
      await writeAuditEvent({
        action: 'UPLOAD_URL_GENERATED',
        userId,
        userRole: 'tv-bidder',
        tenderId,
        result: 'DENIED',
        ipAddress,
        userAgent,
        metadata: { reason: 'Deadline passed' },
      });
      return errorResponse('BID_DEADLINE_PASSED', 'The submission deadline has passed', 423, requestId);
    }

    // 6. Construct S3 key
    const s3Key = `${tenderId}/${userId}/${Date.now()}-${fileName}`;

    // 7. Generate pre-signed PUT URL
    const uploadUrl = await generatePresignedPut({
      bucket: BIDS_BUCKET,
      key: s3Key,
      contentType,
    });

    // 8. Create or update bid record in DynamoDB (PENDING until S3 trigger confirms)
    const nowIso = new Date().toISOString();
    await putItem(BIDS_TABLE, {
      tenderId,
      bidderId: userId,
      s3Key,
      fileName,
      fileSize,
      status: 'PENDING',
      submittedAt: nowIso,
      updatedAt: nowIso,
    });

    // 9. Write audit event
    await writeAuditEvent({
      action: 'UPLOAD_URL_GENERATED',
      userId,
      userRole: 'tv-bidder',
      tenderId,
      fileKey: s3Key,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    // 10. Return pre-signed URL
    return successResponse(200, {
      uploadUrl,
      s3Key,
      expiresIn: PRESIGNED_URL_EXPIRY,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.statusCode, requestId, error.fields);
    }
    console.error('[GENERATE_UPLOAD_URL_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
