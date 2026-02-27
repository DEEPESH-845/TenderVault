import { updateItem } from '../../shared/db.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext, parseBody, AppError } from '../../shared/errors.mjs';
import { validateUpdateTenderBody } from '../../shared/validate.mjs';

const TENDERS_TABLE = process.env.TENDERS_TABLE;

/**
 * PUT /tenders/{tenderId} — Update a specific tender (tv-admin only).
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
        action: 'TENDER_UPDATED',
        userId,
        userRole: groups[0],
        tenderId,
        result: 'DENIED',
        ipAddress,
        userAgent,
        metadata: { reason: 'Insufficient role' },
      });
      return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only procurement officers can update tenders', 403, requestId);
    }

    // 3. Parse and validate body
    const body = parseBody(event);
    const validated = validateUpdateTenderBody(body);

    // 4. Update in DynamoDB
    const now = new Date().toISOString();
    
    let updateExpression = 'SET updatedAt = :now';
    const expressionAttributeValues = {
      ':now': now,
    };
    const expressionAttributeNames = {};

    if (validated.title) {
      updateExpression += ', title = :title';
      expressionAttributeValues[':title'] = validated.title;
    }
    if (validated.description) {
      updateExpression += ', description = :description';
      expressionAttributeValues[':description'] = validated.description;
    }
    if (validated.deadline) {
      updateExpression += ', deadline = :deadline';
      expressionAttributeValues[':deadline'] = validated.deadline;
    }

    if (validated.status) {
      updateExpression += ', #s = :status';
      expressionAttributeValues[':status'] = validated.status;
      expressionAttributeNames['#s'] = 'status';
    }

    const updatedTender = await updateItem(
      TENDERS_TABLE,
      { tenderId },
      updateExpression,
      expressionAttributeValues,
      Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined
    );

    // 5. Write audit event
    await writeAuditEvent({
      action: 'TENDER_UPDATED',
      userId,
      userRole: 'tv-admin',
      tenderId,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { fieldsUpdated: Object.keys(validated).join(', ') },
    });

    // 6. Return success
    return successResponse(200, updatedTender);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.statusCode, requestId, error.fields);
    }
    console.error('[UPDATE_TENDER_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
