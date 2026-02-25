import { getItem } from '../../shared/db.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext } from '../../shared/errors.mjs';

const TENDERS_TABLE = process.env.TENDERS_TABLE;

/**
 * GET /tenders/{tenderId} — Get a single tender by ID.
 */
export async function handler(event, context) {
  const requestId = context.awsRequestId;

  try {
    const { userId, groups, ipAddress, userAgent } = extractRequestContext(event);
    const tenderId = event.pathParameters?.tenderId;

    if (!tenderId) {
      return errorResponse('VALIDATION_ERROR', 'tenderId path parameter is required', 400, requestId);
    }

    // Fetch tender
    const tender = await getItem(TENDERS_TABLE, { tenderId });
    if (!tender) {
      return errorResponse('TENDER_NOT_FOUND', 'Tender does not exist', 404, requestId);
    }

    // Compute effective status
    if (tender.status === 'OPEN' && new Date(tender.deadline).getTime() <= Date.now()) {
      tender.status = 'CLOSED';
    }

    // Write audit event
    await writeAuditEvent({
      action: 'TENDER_VIEWED',
      userId,
      userRole: groups[0] || 'NONE',
      tenderId,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    return successResponse(200, tender);
  } catch (error) {
    console.error('[GET_TENDER_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
