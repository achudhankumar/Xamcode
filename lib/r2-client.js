'use strict';

const crypto = require('crypto');

/**
 * Cloudflare R2 Client (S3-Compatible) with zero external dependencies.
 * Issues AWS SigV4 presigned URLs expiring within 300 seconds (5 minutes).
 */
class R2Client {
  constructor(options = {}) {
    this.accountId = options.accountId || process.env.R2_ACCOUNT_ID || 'dummy-account-id';
    this.accessKeyId = options.accessKeyId || process.env.R2_ACCESS_KEY_ID || 'dummy-access-key';
    this.secretAccessKey = options.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || 'dummy-secret-key';
    this.bucketName = options.bucketName || process.env.R2_BUCKET_NAME || 'xamcode-storage';
    this.endpoint = options.endpoint || (this.accountId ? `https://${this.accountId}.r2.cloudflarestorage.com` : 'https://storage.xamcode.internal');
  }

  /**
   * Generates an AWS Signature Version 4 presigned GET URL for a private object.
   *
   * @param {string} key - Object key in bucket
   * @param {number} [expiresInSeconds=300] - URL validity in seconds (max 300 per security policy)
   * @param {Date} [requestDate=new Date()] - Date of signature generation
   * @returns {string} Presigned URL
   */
  getPresignedUrl(key, expiresInSeconds = 300, requestDate = new Date()) {
    // Security constraint: signed URLs must expire in 5 minutes (300 seconds) or less
    const expires = Math.min(300, Math.max(1, expiresInSeconds));
    const cleanKey = key.replace(/^\/+/, '');
    
    const amzDate = requestDate.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const region = 'auto';
    const service = 's3';

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const host = new URL(this.endpoint).host;

    const queryParams = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expires),
      'X-Amz-SignedHeaders': 'host'
    };

    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&');

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      'GET',
      `/${this.bucketName}/${encodeURIComponent(cleanKey)}`,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex')
    ].join('\n');

    // Calculate Signature Key
    const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    return `${this.endpoint}/${this.bucketName}/${encodeURIComponent(cleanKey)}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }
}

module.exports = {
  R2Client
};

