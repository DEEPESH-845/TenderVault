const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

/**
 * Custom application error class with HTTP status code and machine-readable error code.
 */
export class AppError extends Error {
  /**
   * @param {string} code - Machine-readable error code (e.g., 'TENDER_NOT_FOUND')
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {Array} [fields] - Validation error fields (for VALIDATION_ERROR)
   */
  constructor(code, message, statusCode, fields) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.fields = fields;
    this.name = 'AppError';
  }
}

/**
 * Build a standardized error HTTP response.
 * @param {string} code - Machine-readable error code
 * @param {string} message - Human-readable error message
 * @param {number} statusCode - HTTP status code
 * @param {string} [requestId] - Lambda request ID
 * @param {Array} [fields] - Validation error fields
 * @returns {object} API Gateway response object
 */
export function errorResponse(code, message, statusCode, requestId, fields) {
  const body = {
    error: code,
    message,
    requestId: requestId || 'unknown',
    timestamp: new Date().toISOString(),
  };

  if (fields && fields.length > 0) {
    body.fields = fields;
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Build a standardized success HTTP response.
 * @param {number} statusCode - HTTP status code (200, 201)
 * @param {object} body - Response body
 * @returns {object} API Gateway response object
 */
export function successResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Extract request context from the API Gateway event.
 * @param {object} event - API Gateway v2 event
 * @returns {{userId: string, groups: string[], email: string, ipAddress: string, userAgent: string}}
 */
export function extractRequestContext(event) {
  const authorizer = event.requestContext?.authorizer?.lambda || {};
  const userId = authorizer.userId || 'UNKNOWN';
  const groups = authorizer.groups ? JSON.parse(authorizer.groups) : [];
  const email = authorizer.email || 'UNKNOWN';
  const ipAddress = event.requestContext?.http?.sourceIp || 'UNKNOWN';
  const userAgent = event.headers?.['user-agent'] || 'UNKNOWN';

  return { userId, groups, email, ipAddress, userAgent };
}

/**
 * Parse JSON body from API Gateway event.
 * @param {object} event
 * @returns {object} Parsed body
 * @throws {AppError} If body is invalid JSON
 */
export function parseBody(event) {
  try {
    if (!event.body) {
      throw new AppError('VALIDATION_ERROR', 'Request body is required', 400);
    }
    return JSON.parse(event.body);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('VALIDATION_ERROR', 'Invalid JSON in request body', 400);
  }
}
