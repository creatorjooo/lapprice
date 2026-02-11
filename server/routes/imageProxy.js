const express = require('express');
const router = express.Router();

const DEFAULT_ALLOWED_HOSTS = ['shopping-phinf.pstatic.net'];
const MAX_IMAGE_BYTES = parseInt(process.env.IMAGE_PROXY_MAX_BYTES || `${8 * 1024 * 1024}`, 10);
const CACHE_SECONDS = parseInt(process.env.IMAGE_PROXY_CACHE_SECONDS || '86400', 10);
const FETCH_TIMEOUT_MS = parseInt(process.env.IMAGE_PROXY_TIMEOUT_MS || '5000', 10);

function getAllowedHosts() {
  const env = process.env.IMAGE_PROXY_ALLOWED_HOSTS;
  if (!env) return DEFAULT_ALLOWED_HOSTS;
  return env
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return getAllowedHosts().some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

router.get('/', async (req, res) => {
  const target = String(req.query.url || '').trim();
  if (!target) {
    return res.status(400).json({ error: 'url 파라미터가 필요합니다.' });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).json({ error: '유효한 URL이 아닙니다.' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'http/https URL만 허용됩니다.' });
  }
  if (!isAllowedHost(parsed.hostname)) {
    return res.status(403).json({ error: '허용되지 않은 이미지 호스트입니다.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let upstream;
    try {
      upstream = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LapPriceImageProxy/1.0)',
          'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `upstream 오류: ${upstream.status}` });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({ error: '이미지 응답이 아닙니다.' });
    }

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) {
      return res.status(413).json({ error: '이미지 크기가 너무 큽니다.' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`);
    const etag = upstream.headers.get('etag');
    if (etag) res.setHeader('ETag', etag);
    return res.status(200).send(bytes);
  } catch (err) {
    const msg = err && err.message ? err.message : '이미지 프록시 오류';
    return res.status(502).json({ error: msg });
  }
});

module.exports = router;
