import { queryItems, scanItems } from '../../shared/db.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext } from '../../shared/errors.mjs';

const AUDIT_LOG_TABLE = process.env.AUDIT_LOG_TABLE;

/**
 * GET /audit-logs — List audit log events (paginated, filterable).
 * tv-admin only.
 */
export async function handler(event, context) {
  const requestId = context.awsRequestId;

  try {
    const { userId, groups, ipAddress, userAgent } = extractRequestContext(event);

    // 1. Role check — tv-admin only
    if (!groups.includes('tv-admin')) {
      return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only officers can view audit logs', 403, requestId);
    }

    // 2. Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const filterUserId = queryParams.userId;
    const filterTenderId = queryParams.tenderId;
    const filterAction = queryParams.action;
    const limit = Math.min(parseInt(queryParams.limit) || 50, 100);
    let exclusiveStartKey;

    if (queryParams.nextToken) {
      try {
        exclusiveStartKey = JSON.parse(Buffer.from(queryParams.nextToken, 'base64').toString('utf8'));
      } catch {
        return errorResponse('VALIDATION_ERROR', 'Invalid nextToken', 400, requestId);
      }
    }

    let result;

    // 3. Determine query strategy
    if (filterUserId) {
      // Query Generic GSI-1: User facet
      const params = {
        indexName: 'gsi1-index',
        keyConditionExpression: 'gsi1pk = :pk',
        expressionAttributeValues: { ':pk': `USER#${filterUserId}` },
        scanIndexForward: false,
        limit,
        exclusiveStartKey,
      };
      if (filterAction) {
        params.filterExpression = '#action = :action';
        params.expressionAttributeNames = { '#action': 'action' };
        params.expressionAttributeValues[':action'] = filterAction;
      }
      result = await queryItems(AUDIT_LOG_TABLE, params);
    } else if (filterTenderId) {
      // Query Generic GSI-2: Tender facet
      const params = {
        indexName: 'gsi2-index',
        keyConditionExpression: 'gsi2pk = :pk',
        expressionAttributeValues: { ':pk': `TENDER#${filterTenderId}` },
        scanIndexForward: false,
        limit,
        exclusiveStartKey,
      };
      if (filterAction) {
        params.filterExpression = '#action = :action';
        params.expressionAttributeNames = { '#action': 'action' };
        params.expressionAttributeValues[':action'] = filterAction;
      }
      result = await queryItems(AUDIT_LOG_TABLE, params);
    } else {
      // No filter — scan (acceptable at MVP scale)
      const params = { limit, exclusiveStartKey };
      if (filterAction) {
        params.filterExpression = '#action = :action';
        params.expressionAttributeNames = { '#action': 'action' };
        params.expressionAttributeValues = { ':action': filterAction };
      }
      result = await scanItems(AUDIT_LOG_TABLE, params);
    }

    // 4. Encode pagination token
    let nextToken;
    if (result.lastEvaluatedKey) {
      nextToken = Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString('base64');
    }

    // 5. Write audit event (meta — auditing the audit viewer)
    await writeAuditEvent({
      action: 'AUDIT_LOG_VIEWED',
      userId,
      userRole: 'tv-admin',
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { filterUserId, filterTenderId, filterAction, resultCount: String(result.items.length) },
    });

    return successResponse(200, {
      events: result.items,
      nextToken,
      count: result.items.length,
    });
  } catch (error) {
    console.error('[LIST_AUDIT_LOGS_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
