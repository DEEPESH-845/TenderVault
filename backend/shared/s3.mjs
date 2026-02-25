import { S3Client, GetObjectCommand, CopyObjectCommand, ListObjectVersionsCommand } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({});

const PRESIGNED_URL_EXPIRY = 900; // 15 minutes — non-configurable

/**
 * Generate a pre-signed PUT URL for file upload.
 * @param {object} params
 * @param {string} params.bucket
 * @param {string} params.key
 * @param {string} params.contentType
 * @returns {Promise<string>} Pre-signed PUT URL
 */
export async function generatePresignedPut({ bucket, key, contentType }) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_URL_EXPIRY });
}

/**
 * Generate a pre-signed GET URL for file download.
 * @param {object} params
 * @param {string} params.bucket
 * @param {string} params.key
 * @param {string} [params.versionId]
 * @param {string} [params.fileName]
 * @returns {Promise<string>} Pre-signed GET URL
 */
export async function generatePresignedGet({ bucket, key, versionId, fileName }) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    VersionId: versionId,
    ResponseContentDisposition: fileName ? `attachment; filename="${fileName}"` : undefined,
  });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_URL_EXPIRY });
}

/**
 * List all versions of an object in S3.
 * @param {object} params
 * @param {string} params.bucket
 * @param {string} params.prefix - Key prefix to filter versions
 * @returns {Promise<Array<{versionId: string, lastModified: string, size: number, isLatest: boolean}>>}
 */
export async function listObjectVersions({ bucket, prefix }) {
  const result = await s3Client.send(new ListObjectVersionsCommand({
    Bucket: bucket,
    Prefix: prefix,
  }));

  const versions = (result.Versions || []).map(v => ({
    versionId: v.VersionId,
    lastModified: v.LastModified?.toISOString(),
    size: v.Size,
    isLatest: v.IsLatest || false,
    key: v.Key,
  }));

  return versions.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
}

/**
 * Copy a specific version of an object to make it the current version.
 * @param {object} params
 * @param {string} params.bucket
 * @param {string} params.key
 * @param {string} params.versionId - Source version to copy
 * @returns {Promise<{newVersionId: string}>}
 */
export async function copyObjectVersion({ bucket, key, versionId }) {
  const result = await s3Client.send(new CopyObjectCommand({
    Bucket: bucket,
    Key: key,
    CopySource: `${bucket}/${key}?versionId=${versionId}`,
    ServerSideEncryption: 'AES256',
  }));

  return {
    newVersionId: result.VersionId,
  };
}

export { PRESIGNED_URL_EXPIRY };
