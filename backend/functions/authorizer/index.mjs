import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { writeAuditEvent } from '../../shared/audit.mjs';

const USER_POOL_ID = process.env.USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID;

// Create verifier (caches JWKS keys automatically)
const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: 'access',
  clientId: USER_POOL_CLIENT_ID,
});

/**
 * Lambda Authorizer for API Gateway HTTP API (payload format 2.0).
 * Verifies Cognito JWT access tokens and extracts user context.
 */
export async function handler(event) {
  const sourceIp = event.requestContext?.http?.sourceIp || 'UNKNOWN';
  const userAgent = event.headers?.['user-agent'] || 'UNKNOWN';

  try {
    // 1. Extract Authorization header
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (!authHeader) {
      await writeAuditEvent({
        action: 'AUTH_VERIFY',
        result: 'DENIED',
        ipAddress: sourceIp,
        userAgent,
        metadata: { reason: 'Missing Authorization header' },
      });
      return { isAuthorized: false };
    }

    // 2. Strip "Bearer " prefix
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!token) {
      await writeAuditEvent({
        action: 'AUTH_VERIFY',
        result: 'DENIED',
        ipAddress: sourceIp,
        userAgent,
        metadata: { reason: 'Empty token' },
      });
      return { isAuthorized: false };
    }

    // 3. Verify token (signature, expiry, issuer, audience, token use)
    const payload = await verifier.verify(token);

    // 4. Extract user info from payload
    const userId = payload.sub;
    const groups = payload['cognito:groups'] || [];
    const email = payload.email || payload.username || userId;

    // 5. Write success audit event
    await writeAuditEvent({
      action: 'AUTH_VERIFY',
      userId,
      userRole: groups[0] || 'NONE',
      result: 'SUCCESS',
      ipAddress: sourceIp,
      userAgent,
    });

    // 6. Return authorized response with user context
    return {
      isAuthorized: true,
      context: {
        userId,
        groups: JSON.stringify(groups),
        email,
      },
    };
  } catch (error) {
    // ANY error → deny access, log to CloudWatch
    console.error('[AUTH_FAILURE]', {
      error: error.message,
      sourceIp,
    });

    await writeAuditEvent({
      action: 'AUTH_VERIFY',
      result: 'DENIED',
      ipAddress: sourceIp,
      userAgent,
      metadata: { error: error.message },
    });

    return { isAuthorized: false };
  }
}
