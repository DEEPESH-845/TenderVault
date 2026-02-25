import { randomUUID } from 'crypto';
import { putItem } from '../../shared/db.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext, parseBody, AppError } from '../../shared/errors.mjs';
import { validateTenderBody } from '../../shared/validate.mjs';

const TENDERS_TABLE = process.env.TENDERS_TABLE;

/**
 * POST /tenders — Create a new tender (tv-admin only).
 */
export async function handler(event, context) {
  const requestId = context.awsRequestId;

  try {
    // 1. Extract user context from authorizer
    const { userId, groups, email, ipAddress, userAgent } = extractRequestContext(event);

    // 2. Check role — tv-admin only
    if (!groups.includes('tv-admin')) {
      await writeAuditEvent({
        action: 'TENDER_CREATED',
        userId,
        userRole: groups[0],
        result: 'DENIED',
        ipAddress,
        userAgent,
        metadata: { reason: 'Insufficient role' },
      });
      return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only procurement officers can create tenders', 403, requestId);
    }

    // 3. Parse and validate request body
    const body = parseBody(event);
    const { title, description, deadline } = validateTenderBody(body);

    // 4. Generate tender
    const now = new Date().toISOString();
    const tenderId = randomUUID();
    const tender = {
      tenderId,
      title,
      description,
      deadline,
      createdBy: userId,
      status: 'OPEN',
      createdAt: now,
      updatedAt: now,
    };

    // 5. Persist to DynamoDB
    await putItem(TENDERS_TABLE, tender);

    // 6. Write audit event
    await writeAuditEvent({
      action: 'TENDER_CREATED',
      userId,
      userRole: 'tv-admin',
      tenderId,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
    });

    // 7. Return 201 with created tender
    return successResponse(201, tender);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.statusCode, requestId, error.fields);
    }
    console.error('[CREATE_TENDER_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
