import { getItem, updateItem } from '../../shared/db.mjs';
import { copyObjectVersion } from '../../shared/s3.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext, parseBody, AppError } from '../../shared/errors.mjs';
import { validateRestoreVersionBody } from '../../shared/validate.mjs';

const BIDS_TABLE = process.env.BIDS_TABLE;
const BIDS_BUCKET = process.env.BIDS_BUCKET;

/**
 * POST /tenders/{tenderId}/bids/{bidderId}/restore — Restore a previous version.
 * Copies the specified S3 version to the same key (creates new current version).
 * tv-admin only.
 */
export async function handler(event, context) {
  const requestId = context.awsRequestId;

  try {
    const { userId, groups, ipAddress, userAgent } = extractRequestContext(event);
    const tenderId = event.pathParameters?.tenderId;
    const bidderId = event.pathParameters?.bidderId;

    // 1. Role check — tv-admin only
    if (!groups.includes('tv-admin')) {
      return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only officers can restore versions', 403, requestId);
    }

    // 2. Validate body
    const body = parseBody(event);
    const { versionId } = validateRestoreVersionBody(body);

    // 3. Fetch bid
    const bid = await getItem(BIDS_TABLE, { tenderId, bidderId });
    if (!bid) {
      return errorResponse('BID_NOT_FOUND', 'No bid found for this bidder on this tender', 404, requestId);
    }

    // 4. Copy specified version to same key (makes it the new latest)
    const { newVersionId } = await copyObjectVersion({
      bucket: BIDS_BUCKET,
      key: bid.s3Key,
      versionId,
    });

    // 5. Update BidsTable with new current version
    const now = new Date().toISOString();
    await updateItem(
      BIDS_TABLE,
      { tenderId, bidderId },
      'SET currentVersionId = :vid, updatedAt = :now',
      { ':vid': newVersionId, ':now': now }
    );

    // 6. Write audit event
    await writeAuditEvent({
      action: 'VERSION_RESTORED',
      userId,
      userRole: 'tv-admin',
      tenderId,
      versionId: newVersionId,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { restoredFrom: versionId, bidderId },
    });

    return successResponse(200, {
      message: 'Version restored successfully',
      newVersionId,
      restoredFrom: versionId,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.statusCode, requestId, error.fields);
    }
    console.error('[RESTORE_VERSION_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
