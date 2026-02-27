import { updateItem } from '../../shared/db.mjs';
import { writeAuditEvent } from '../../shared/audit.mjs';
import { sendEmail } from '../../shared/email.mjs';

const BIDS_TABLE = process.env.BIDS_TABLE;

/**
 * S3 ObjectCreated trigger — Confirm bid upload.
 * Updates BidsTable with SUBMITTED status and S3 versionId.
 * Must be idempotent (S3 may deliver events more than once).
 */
export async function handler(event) {
  for (const record of event.Records) {
    try {
      // 1. Extract from S3 event
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      const versionId = record.s3.object.versionId;
      const size = record.s3.object.size;

      // 2. Parse key to extract tenderId and bidderId
      // Key format: {tenderId}/{bidderId}/{timestamp}-{fileName}
      const parts = key.split('/');
      if (parts.length < 3) {
        console.error('[CONFIRM_UPLOAD] Invalid key structure:', key);
        continue;
      }
      const tenderId = parts[0];
      const bidderId = parts[1];

      // 3. Update bid record in DynamoDB
      const now = new Date().toISOString();
      const updatedBidItem = await updateItem(
        BIDS_TABLE,
        { tenderId, bidderId },
        'SET #status = :status, currentVersionId = :vid, updatedAt = :now, fileSize = :size',
        {
          ':status': 'SUBMITTED',
          ':vid': versionId,
          ':now': now,
          ':size': size,
        },
        {
          '#status': 'status',
        }
      );

      if (updatedBidItem?.bidderEmail) {
        await sendEmail({
          to: updatedBidItem.bidderEmail,
          subject: 'TenderVault — Bid Submitted Successfully',
          body: `Your bid document has been successfully submitted.\n\nTender ID: ${tenderId}\nFile: ${updatedBidItem.fileName}\nSubmitted at: ${now}\n\nLog in to TenderVault to track your submission status.`,
        });
      }

      // 4. Write audit event
      await writeAuditEvent({
        action: 'BID_SUBMITTED',
        userId: bidderId,
        userRole: 'tv-bidder',
        tenderId,
        fileKey: key,
        versionId,
        result: 'SUCCESS',
        metadata: { bucket, size: String(size) },
      });

      console.log('[CONFIRM_UPLOAD] Successfully processed:', { tenderId, bidderId, versionId });
    } catch (error) {
      // Log but don't throw — allow other records in the batch to process
      console.error('[CONFIRM_UPLOAD_ERROR]', {
        record: JSON.stringify(record.s3),
        error: error.message,
        stack: error.stack,
      });
    }
  }
}
