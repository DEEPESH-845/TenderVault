import { getItem, updateItem } from '../../shared/db.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { errorResponse, successResponse, extractRequestContext, parseBody, AppError } from '../../shared/errors.mjs';
import { validateScoreBody } from '../../shared/validate.mjs';

const TENDERS_TABLE = process.env.TENDERS_TABLE;
const BIDS_TABLE = process.env.BIDS_TABLE;

/**
 * PUT /tenders/{tenderId}/bids/{bidderId}/score — Score a bid (tv-evaluator or tv-admin).
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

        // Role check — tv-evaluator or tv-admin
        if (!groups.includes('tv-evaluator') && !groups.includes('tv-admin')) {
            return errorResponse('AUTH_INSUFFICIENT_ROLE', 'Only evaluators and officers can score bids', 403, requestId);
        }

        // Verify tender exists and deadline has passed (time-lock)
        const tender = await getItem(TENDERS_TABLE, { tenderId });
        if (!tender) {
            return errorResponse('TENDER_NOT_FOUND', 'Tender does not exist', 404, requestId);
        }
        if (new Date(tender.deadline).getTime() > Date.now()) {
            return errorResponse('TENDER_LOCKED', 'Bids cannot be scored before the tender deadline', 423, requestId);
        }

        // Verify bid exists
        const bid = await getItem(BIDS_TABLE, { tenderId, bidderId });
        if (!bid) {
            return errorResponse('BID_NOT_FOUND', 'Bid does not exist', 404, requestId);
        }

        // Parse and validate
        const body = parseBody(event);
        const { score, notes } = validateScoreBody(body);

        const now = new Date().toISOString();

        // First: Initialize map if missing
        await updateItem(
            BIDS_TABLE,
            { tenderId, bidderId },
            'SET evaluationScores = if_not_exists(evaluationScores, :empty), updatedAt = :now',
            { ':empty': {}, ':now': now }
        );

        // Second: Set individual score entry
        const finalBid = await updateItem(
            BIDS_TABLE,
            { tenderId, bidderId },
            'SET evaluationScores.#uid = :entry, updatedAt = :now',
            { ':entry': { score, notes: notes ?? null, scoredAt: now }, ':now': now },
            { '#uid': userId }
        );

        await writeAuditEvent({
            action: 'BID_SCORED',
            userId, userRole: groups.includes('tv-admin') ? 'tv-admin' : 'tv-evaluator',
            tenderId, result: 'SUCCESS', ipAddress, userAgent,
            metadata: { bidderId, score: String(score) },
        });

        return successResponse(200, finalBid);
    } catch (error) {
        if (error instanceof AppError) {
            return errorResponse(error.code, error.message, error.statusCode, requestId, error.fields);
        }
        console.error('[SCORE_BID_ERROR]', error);
        return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, requestId);
    }
}
