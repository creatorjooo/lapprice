const crypto = require('crypto');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

let cachedClient = null;
let cachedConfigKey = '';

function getConfig() {
  return {
    provider: String(process.env.IMAGE_CACHE_PROVIDER || '').trim().toLowerCase(),
    endpoint: String(process.env.IMAGE_CACHE_S3_ENDPOINT || '').trim(),
    bucket: String(process.env.IMAGE_CACHE_S3_BUCKET || '').trim(),
    region: String(process.env.IMAGE_CACHE_S3_REGION || 'auto').trim(),
    accessKeyId: String(process.env.IMAGE_CACHE_S3_ACCESS_KEY || '').trim(),
    secretAccessKey: String(process.env.IMAGE_CACHE_S3_SECRET_KEY || '').trim(),
    publicBaseUrl: String(process.env.IMAGE_CACHE_PUBLIC_BASE_URL || '').trim().replace(/\/+$/g, ''),
    maxBytes: Math.max(1, parseInt(process.env.IMAGE_CACHE_MAX_BYTES || `${8 * 1024 * 1024}`, 10) || (8 * 1024 * 1024)),
    timeoutMs: Math.max(1000, parseInt(process.env.IMAGE_CACHE_TIMEOUT_MS || '8000', 10) || 8000),
  };
}

function isImageCacheEnabled() {
  const cfg = getConfig();
  return cfg.provider === 's3'
    && cfg.bucket
    && cfg.accessKeyId
    && cfg.secretAccessKey;
}

function buildClient(cfg) {
  const key = JSON.stringify({
    endpoint: cfg.endpoint,
    region: cfg.region,
    accessKeyId: cfg.accessKeyId,
    bucket: cfg.bucket,
  });

  if (cachedClient && cachedConfigKey === key) {
    return cachedClient;
  }

  cachedClient = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint || undefined,
    forcePathStyle: !!cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  cachedConfigKey = key;
  return cachedClient;
}

function sanitizePrefix(prefix) {
  return String(prefix || 'products')
    .trim()
    .replace(/[^a-z0-9/_-]/gi, '-')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '') || 'products';
}

function guessExtension(url, contentType) {
  const type = String(contentType || '').toLowerCase();
  if (type.includes('image/jpeg')) return '.jpg';
  if (type.includes('image/png')) return '.png';
  if (type.includes('image/webp')) return '.webp';
  if (type.includes('image/gif')) return '.gif';
  if (type.includes('image/avif')) return '.avif';

  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext && ext.length <= 8) return ext;
  } catch {
    // ignore
  }

  return '.jpg';
}

function buildObjectKey(url, prefix, extension) {
  const hash = crypto.createHash('sha1').update(String(url || '')).digest('hex');
  const safePrefix = sanitizePrefix(prefix);
  return `${safePrefix}/${hash.slice(0, 2)}/${hash}${extension}`;
}

function buildPublicUrl(cfg, key) {
  if (cfg.publicBaseUrl) {
    return `${cfg.publicBaseUrl}/${key}`;
  }

  if (cfg.endpoint) {
    const endpoint = cfg.endpoint.replace(/\/+$/g, '');
    return `${endpoint}/${cfg.bucket}/${key}`;
  }

  return `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${key}`;
}

async function fetchImage(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LapPriceImageCache/1.0)',
        'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function cacheImageFromUrl(imageUrl, options = {}) {
  const cfg = getConfig();
  const sourceUrl = String(imageUrl || '').trim();
  if (!isImageCacheEnabled()) {
    return { ok: false, reason: 'DISABLED', url: sourceUrl };
  }
  if (!/^https?:\/\//i.test(sourceUrl)) {
    return { ok: false, reason: 'INVALID_URL', url: sourceUrl };
  }

  try {
    const response = await fetchImage(sourceUrl, cfg.timeoutMs);
    if (!response.ok) {
      return { ok: false, reason: `UPSTREAM_${response.status}`, url: sourceUrl };
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return { ok: false, reason: 'NOT_IMAGE', url: sourceUrl };
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > cfg.maxBytes) {
      return { ok: false, reason: 'INVALID_SIZE', url: sourceUrl };
    }

    const extension = guessExtension(sourceUrl, contentType);
    const key = buildObjectKey(sourceUrl, options.prefix || 'products', extension);
    const client = buildClient(cfg);

    await client.send(new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: 'public, max-age=2592000, immutable',
    }));

    return {
      ok: true,
      key,
      url: buildPublicUrl(cfg, key),
      bytes: bytes.length,
      contentType,
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'CACHE_ERROR',
      message: err.message,
      url: sourceUrl,
    };
  }
}

module.exports = {
  isImageCacheEnabled,
  cacheImageFromUrl,
};
