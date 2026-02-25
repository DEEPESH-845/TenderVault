import { queryItems, scanItems } from '../../shared/db.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext } from '../../shared/errors.mjs';

const TENDERS_TABLE = process.env.TENDERS_TABLE;

/**
 * GET /tenders — List tenders (role-filtered).
 * - tv-admin: All tenders (Scan)
 * - tv-bidder: OPEN tenders only (GSI query)
 * - tv-evaluator: OPEN + CLOSED tenders (two GSI queries)
 */
export async function handler(event, context) {
  const requestId = context.awsRequestId;

  try {
    const { userId, groups, ipAddress, userAgent } = extractRequestContext(event);
    const role = groups[0] || 'NONE';
    let tenders = [];

    if (groups.includes('tv-admin')) {
      // Admin: scan all tenders
      const result = await scanItems(TENDERS_TABLE);
      tenders = result.items;
    } else if (groups.includes('tv-bidder')) {
      // Bidder: only OPEN tenders
      const result = await queryItems(TENDERS_TABLE, {
        indexName: 'status-createdAt-index',
        keyConditionExpression: '#status = :status',
        expressionAttributeNames: { '#status': 'status' },
        expressionAttributeValues: { ':status': 'OPEN' },
      });
      tenders = result.items;
    } else if (groups.includes('tv-evaluator')) {
      // Evaluator: OPEN + CLOSED tenders
      const [openResult, closedResult] = await Promise.all([
        queryItems(TENDERS_TABLE, {
          indexName: 'status-createdAt-index',
          keyConditionExpression: '#status = :status',
          expressionAttributeNames: { '#status': 'status' },
          expressionAttributeValues: { ':status': 'OPEN' },
        }),
        queryItems(TENDERS_TABLE, {
          indexName: 'status-createdAt-index',
          keyConditionExpression: '#status = :status',
          expressionAttributeNames: { '#status': 'status' },
          expressionAttributeValues: { ':status': 'CLOSED' },
        }),
      ]);
      tenders = [...openResult.items, ...closedResult.items];
    } else {
      return errorResponse('AUTH_INSUFFICIENT_ROLE', 'No valid role found', 403, requestId);
    }

    // Compute effective status: if OPEN but deadline passed → treat as CLOSED
    const now = Date.now();
    tenders = tenders.map(tender => {
      if (tender.status === 'OPEN' && new Date(tender.deadline).getTime() <= now) {
        return { ...tender, status: 'CLOSED' };
      }
      return tender;
    });

    // Sort by deadline ASC
    tenders.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    // Write audit event
    await writeAuditEvent({
      action: 'TENDER_LISTED',
      userId,
      userRole: role,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    return successResponse(200, { tenders, count: tenders.length });
  } catch (error) {
    console.error('[LIST_TENDERS_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
