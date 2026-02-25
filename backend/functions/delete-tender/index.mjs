import { deleteItem } from '../../shared/db.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext } from '../../shared/errors.mjs';

const TENDERS_TABLE = process.env.TENDERS_TABLE;

/**
 * DELETE /tenders/{tenderId} — Delete a specific tender (tv-admin only).
 */
export async function handler(event, context) {
  const requestId = context.awsRequestId;

  try {
    // 1. Extract user context
    const { userId, groups, ipAddress, userAgent } = extractRequestContext(event);
    const tenderId = event.pathParameters?.tenderId;

    if (!tenderId) {
      return errorResponse('MISSING_TENDER_ID', 'tenderId path parameter is required', 400, requestId);
    }

    // 2. Check role — tv-admin only
    if (!groups.includes('tv-admin')) {
      await writeAuditEvent({
        action: 'TENDER_DELETED',
        userId,
        userRole: groups[0],
        tenderId,
        result: 'DENIED',
        ipAddress,
        userAgent,
        metadata: { reason: 'Insufficient role' },
      });
      return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only procurement officers can delete tenders', 403, requestId);
    }

    // 3. Delete from DynamoDB
    await deleteItem(TENDERS_TABLE, { tenderId });

    // 4. Write audit event
    await writeAuditEvent({
      action: 'TENDER_DELETED',
      userId,
      userRole: 'tv-admin',
      tenderId,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    // 5. Return success
    return successResponse(200, { message: 'Tender deleted successfully' });
  } catch (error) {
    console.error('[DELETE_TENDER_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
