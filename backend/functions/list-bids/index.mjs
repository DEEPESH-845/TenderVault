import { getItem, queryItems } from '../../shared/db.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext } from '../../shared/errors.mjs';

const TENDERS_TABLE = process.env.TENDERS_TABLE;
const BIDS_TABLE = process.env.BIDS_TABLE;

/**
 * GET /tenders/{tenderId}/bids — List all bids for a tender.
 * Time-locked: returns 423 if deadline has not passed.
 * Accessible by: tv-admin, tv-evaluator
 */
export async function handler(event, context) {
  const requestId = context.awsRequestId;

  try {
    const { userId, groups, ipAddress, userAgent } = extractRequestContext(event);
    const tenderId = event.pathParameters?.tenderId;

    // 1. Role check — tv-admin or tv-evaluator only
    if (!groups.includes('tv-admin') && !groups.includes('tv-evaluator')) {
      return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only officers and evaluators can view bids', 403, requestId);
    }

    // 2. Fetch tender
    const tender = await getItem(TENDERS_TABLE, { tenderId });
    if (!tender) {
      return errorResponse('TENDER_NOT_FOUND', 'Tender does not exist', 404, requestId);
    }

    // 3. Time-lock check — bids cannot be listed before deadline
    const now = Date.now();
    const deadlineMs = new Date(tender.deadline).getTime();
    if (now < deadlineMs) {
      await writeAuditEvent({
        action: 'DOWNLOAD_DENIED_TIMELOCKED',
        userId,
        userRole: groups[0],
        tenderId,
        result: 'DENIED',
        ipAddress,
        userAgent,
        metadata: { reason: 'Bid list requested before deadline' },
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

    // 4. Query all bids for tender
    const result = await queryItems(BIDS_TABLE, {
      keyConditionExpression: 'tenderId = :tid',
      expressionAttributeValues: { ':tid': tenderId },
    });

    // 5. Write audit event
    await writeAuditEvent({
      action: 'TENDER_VIEWED',
      userId,
      userRole: groups[0],
      tenderId,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { bidCount: String(result.items.length) },
    });

    return successResponse(200, {
      bids: result.items,
      count: result.items.length,
    });
  } catch (error) {
    console.error('[LIST_BIDS_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
