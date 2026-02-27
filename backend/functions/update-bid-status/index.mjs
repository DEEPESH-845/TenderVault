import { getItem, updateItem } from '../../shared/db.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext, parseBody, AppError } from '../../shared/errors.mjs';
import { validateBidStatusBody } from '../../shared/validate.mjs';
import { sendEmail } from '../../shared/email.mjs';
// Email import to be added in Task 4, but leaving out for now to avoid errors before email.mjs exists. Or wait, the plan Task 4 adds it. I'll just follow the Task 2 code exactly snippet by snippet.

const TENDERS_TABLE = process.env.TENDERS_TABLE;
const BIDS_TABLE = process.env.BIDS_TABLE;

/**
 * PATCH /tenders/{tenderId}/bids/{bidderId}/status — Update bid evaluation status (tv-admin only).
 */
export async function handler(event, context) {
    const requestId = context.awsRequestId;

    try {
        const { userId, groups, ipAddress, userAgent } = extractRequestContext(event);
        const tenderId = event.pathParameters?.tenderId;
        const bidderId = event.pathParameters?.bidderId;

        if (!tenderId || !bidderId) {
            return errorResponse('MISSING_PARAMS', 'tenderId and bidderId are required', 400, requestId);
        }

        // Role check — tv-admin only
        if (!groups.includes('tv-admin')) {
            await writeAuditEvent({
                action: 'BID_STATUS_UPDATED',
                userId, userRole: groups[0], tenderId,
                result: 'DENIED', ipAddress, userAgent,
                metadata: { reason: 'Insufficient role' },
            });
            return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only officers can update bid status', 403, requestId);
        }

        // Verify tender exists
        const tender = await getItem(TENDERS_TABLE, { tenderId });
        if (!tender) {
            return errorResponse('TENDER_NOT_FOUND', 'Tender does not exist', 404, requestId);
        }

        // Verify bid exists
        const bid = await getItem(BIDS_TABLE, { tenderId, bidderId });
        if (!bid) {
            return errorResponse('BID_NOT_FOUND', 'Bid does not exist', 404, requestId);
        }

        // Parse and validate
        const body = parseBody(event);
        const { bidStatus } = validateBidStatusBody(body);

        // Update in DynamoDB
        const now = new Date().toISOString();
        const updatedBid = await updateItem(
            BIDS_TABLE,
            { tenderId, bidderId },
            'SET bidStatus = :bidStatus, updatedAt = :now',
            { ':bidStatus': bidStatus, ':now': now }
        );

        // Audit
        await writeAuditEvent({
            action: 'BID_STATUS_UPDATED',
            userId, userRole: 'tv-admin', tenderId,
            result: 'SUCCESS', ipAddress, userAgent,
            metadata: { bidderId, bidStatus },
        });

        // Send email if bidderEmail is available
        const bidderEmail = bid.bidderEmail || updatedBid.bidderEmail;
        if (bidderEmail) {
            try {
                await sendEmail(
                    bidderEmail,
                    'TenderVault: Bid Status Update',
                    `Your bid for tender ${tenderId} has been updated to: ${bidStatus}.\n\nPlease check your dashboard for further details.`
                );
                console.log(`[UPDATE_BID_STATUS] Email sent to ${bidderEmail}`);
            } catch (err) {
                console.error('[UPDATE_BID_STATUS] Failed to send email, ignoring error', err);
            }
        } else {
            console.log('[UPDATE_BID_STATUS] Status updated — no bidderEmail found on bid record, skipping email');
        }

        return successResponse(200, updatedBid);
    } catch (error) {
        if (error instanceof AppError) {
            return errorResponse(error.code, error.message, error.statusCode, requestId, error.fields);
        }
        console.error('[UPDATE_BID_STATUS_ERROR]', error);
        return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
    }
}
