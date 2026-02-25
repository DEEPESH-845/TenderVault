import { getItem } from '../../shared/db.mjs';
import { listObjectVersions } from '../../shared/s3.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext } from '../../shared/errors.mjs';

const BIDS_TABLE = process.env.BIDS_TABLE;
const BIDS_BUCKET = process.env.BIDS_BUCKET;

/**
 * GET /tenders/{tenderId}/bids/{bidderId}/versions — List all versions of a bid.
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
      return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only officers can view version history', 403, requestId);
    }

    // 2. Fetch bid to get S3 key prefix
    const bid = await getItem(BIDS_TABLE, { tenderId, bidderId });
    if (!bid) {
      return errorResponse('BID_NOT_FOUND', 'No bid found for this bidder on this tender', 404, requestId);
    }

    // 3. List S3 object versions
    // Use tenderId/bidderId/ as the prefix to get all versions
    const prefix = `${tenderId}/${bidderId}/`;
    const versions = await listObjectVersions({
      bucket: BIDS_BUCKET,
      prefix,
    });

    // 4. Write audit event
    await writeAuditEvent({
      action: 'VERSIONS_LISTED',
      userId,
      userRole: 'tv-admin',
      tenderId,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { bidderId, versionCount: String(versions.length) },
    });

    return successResponse(200, { versions });
  } catch (error) {
    console.error('[LIST_VERSIONS_ERROR]', error);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
  }
}
