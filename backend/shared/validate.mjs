import { AppError } from './errors.mjs';

/**
 * Validate tender creation request body.
 * @param {object} body
 * @returns {{ title: string, description: string, deadline: string }} Validated body
 * @throws {AppError} VALIDATION_ERROR with fields array
 */
export function validateTenderBody(body) {
  const errors = [];

  if (!body.title || typeof body.title !== 'string') {
    errors.push({ field: 'title', message: 'Title is required and must be a string' });
  } else if (body.title.length < 3 || body.title.length > 200) {
    errors.push({ field: 'title', message: 'Title must be 3-200 characters' });
  }

  if (!body.description || typeof body.description !== 'string') {
    errors.push({ field: 'description', message: 'Description is required and must be a string' });
  } else if (body.description.length < 10 || body.description.length > 2000) {
    errors.push({ field: 'description', message: 'Description must be 10-2000 characters' });
  }

  if (!body.deadline || typeof body.deadline !== 'string') {
    errors.push({ field: 'deadline', message: 'Deadline is required and must be an ISO 8601 string' });
  } else {
    const deadlineDate = new Date(body.deadline);
    if (isNaN(deadlineDate.getTime())) {
      errors.push({ field: 'deadline', message: 'Deadline must be a valid ISO 8601 datetime' });
    } else {
      const minDeadline = Date.now() + (60 * 60 * 1000); // now + 1 hour
      if (deadlineDate.getTime() <= minDeadline) {
        errors.push({ field: 'deadline', message: 'Deadline must be at least 1 hour in the future' });
      }
    }
  }

  if (errors.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'Request validation failed', 400, errors);
  }

  return {
    title: body.title.trim(),
    description: body.description.trim(),
    deadline: body.deadline,
  };
}

/**
 * Validate bid upload URL request body.
 * @param {object} body
 * @returns {{ fileName: string, contentType: string, fileSize: number }} Validated body
 * @throws {AppError} VALIDATION_ERROR with fields array
 */
export function validateBidUploadRequest(body) {
  const errors = [];
  const MAX_FILE_SIZE = 52428800; // 50 MB

  if (!body.fileName || typeof body.fileName !== 'string') {
    errors.push({ field: 'fileName', message: 'fileName is required and must be a string' });
  } else if (!body.fileName.toLowerCase().endsWith('.pdf')) {
    errors.push({ field: 'fileName', message: 'fileName must end with .pdf' });
  }

  if (!body.contentType || body.contentType !== 'application/pdf') {
    errors.push({ field: 'contentType', message: 'contentType must be exactly "application/pdf"' });
  }

  if (body.fileSize === undefined || body.fileSize === null || typeof body.fileSize !== 'number') {
    errors.push({ field: 'fileSize', message: 'fileSize is required and must be a number' });
  } else if (body.fileSize < 1 || body.fileSize > MAX_FILE_SIZE) {
    errors.push({ field: 'fileSize', message: `fileSize must be between 1 and ${MAX_FILE_SIZE} bytes (50MB)` });
  }

  if (errors.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'Request validation failed', 400, errors);
  }

  return {
    fileName: body.fileName,
    contentType: body.contentType,
    fileSize: body.fileSize,
  };
}

/**
 * Validate restore version request body.
 * @param {object} body
 * @returns {{ versionId: string }} Validated body
 * @throws {AppError} VALIDATION_ERROR
 */
export function validateRestoreVersionBody(body) {
  if (!body.versionId || typeof body.versionId !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'versionId is required and must be a string', 400, [
      { field: 'versionId', message: 'versionId is required' },
    ]);
  }
  return { versionId: body.versionId };
}
