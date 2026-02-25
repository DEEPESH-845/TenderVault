import { randomUUID } from 'crypto';
import { putItem } from './db.mjs';

const AUDIT_LOG_TABLE = process.env.AUDIT_LOG_TABLE;
const RETENTION_DAYS = 365;

/**
 * Write an audit event to the AuditLog DynamoDB table.
 * NEVER throws — catches all errors internally and logs to CloudWatch.
 *
 * @param {object} params
 * @param {string} params.action - Action enum (e.g., 'TENDER_CREATED', 'DOWNLOAD_DENIED_TIMELOCKED')
 * @param {string} [params.userId] - Cognito user ID (sub)
 * @param {string} [params.userRole] - Cognito group name
 * @param {string} [params.tenderId] - Target tender ID
 * @param {string} [params.fileKey] - S3 key if applicable
 * @param {string} [params.versionId] - S3 version ID if applicable
 * @param {string} [params.ipAddress] - Client IP address
 * @param {string} [params.userAgent] - Client User-Agent header
 * @param {string} params.result - 'SUCCESS' | 'DENIED' | 'ERROR'
 * @param {object} [params.metadata] - Additional context
 */
export async function writeAuditEvent(params) {
  try {
    const now = new Date();
    const auditEvent = {
      auditId: randomUUID(),
      timestamp: now.toISOString(),
      userId: params.userId || 'SYSTEM',
      userRole: params.userRole || 'UNKNOWN',
      action: params.action,
      tenderId: params.tenderId,
      fileKey: params.fileKey,
      versionId: params.versionId,
      ipAddress: params.ipAddress || 'UNKNOWN',
      userAgent: params.userAgent || 'UNKNOWN',
      result: params.result,
      metadata: params.metadata,
      retentionExpiry: Math.floor(now.getTime() / 1000) + (RETENTION_DAYS * 24 * 60 * 60),
    };

    // Generic GSI Pattern: gsi1 = User facet, gsi2 = Tender facet
    if (params.userId) {
      auditEvent.gsi1pk = `USER#${params.userId}`;
      auditEvent.gsi1sk = auditEvent.timestamp;
    }
    if (params.tenderId) {
      auditEvent.gsi2pk = `TENDER#${params.tenderId}`;
      auditEvent.gsi2sk = auditEvent.timestamp;
    }

    // Remove undefined values
    Object.keys(auditEvent).forEach(key => {
      if (auditEvent[key] === undefined) {
        delete auditEvent[key];
      }
    });

    await putItem(AUDIT_LOG_TABLE, auditEvent);
  } catch (error) {
    // NEVER throw from audit — log to CloudWatch instead
    console.error('[AUDIT_WRITE_FAILURE]', {
      action: params.action,
      userId: params.userId,
      error: error.message,
      stack: error.stack,
    });
  }
}
