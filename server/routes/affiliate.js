const express = require('express');
const router = express.Router();

const { getCachedResult, setCachedResult } = require('../utils/helpers');
const { buildCoupangAuthorization } = require('../utils/coupangAuth');
const { takeToken, setCooldownUntil } = require('../services/deeplinkRateLimiter');

const DEEPLINK_CACHE_TTL = parseInt(process.env.DEEPLINK_CACHE_TTL || '86400', 10);
const DEEPLINK_FAIL_COOLDOWN_MS = parseInt(process.env.DEEPLINK_FAIL_COOLDOWN_MS || '900000', 10);
const DEEPLINK_LOCAL_COOLDOWN_MS = Math.max(
  15000,
  parseInt(process.env.DEEPLINK_LOCAL_COOLDOWN_MS || '60000', 10) || 60000,
);

let lastDeeplinkAuthLogAt = 0;
let lastDeeplinkRateLogAt = 0;

function buildFallbackLinks(urls, options = {}) {
  const {
    mode,
    warning = '',
    error = '',
    retryAt = null,
  } = options;

  return {
    mode,
    retryAt: retryAt || undefined,
    warning: warning || undefined,
    error: error || undefined,
    links: urls.map((url) => ({
      originalUrl: url,
      affiliateUrl: url,
      shortenUrl: url,
    })),
  };
}

function buildFallbackSingle(url, options = {}) {
  const {
    mode,
    warning = '',
    error = '',
    retryAt = null,
  } = options;

  return {
    mode,
    retryAt: retryAt || undefined,
    warning: warning || undefined,
    error: error || undefined,
    originalUrl: url,
    affiliateUrl: url,
    shortenUrl: url,
  };
}

function parseRetryUntilMsFromMessage(message) {
  const text = String(message || '');
  const match = text.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
  if (!match?.[1]) return 0;
  const raw = match[1].replace(/\.(\d{3})\d+$/, '.$1');
  const parsed = Date.parse(raw) || Date.parse(`${raw}Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRateLimitError(message, status = 0) {
  const text = String(message || '');
  return status === 429
    || text.includes('429')
    || text.includes('분당 50회')
    || text.toLowerCase().includes('rate limit');
}

async function consumeDeeplinkQuota() {
  const quota = await takeToken();
  if (quota.allowed) {
    return { blocked: false, mode: 'deeplink', retryAt: null };
  }

  return {
    blocked: true,
    mode: quota.reason === 'cooldown' ? 'fallback_cooldown' : 'fallback_rate_limited',
    retryAt: quota.retryAt || undefined,
  };
}

async function callCoupangDeeplinkApi(urls, subId) {
  const apiPath = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
  const authorization = buildCoupangAuthorization({ method: 'POST', apiPath });
  if (!authorization) {
    throw Object.assign(new Error('쿠팡 파트너스 API 키 미설정'), { statusCode: 401, fallbackMode: 'fallback_no_key' });
  }

  const coupangUrls = urls.map((url) => {
    if (subId && !url.includes('subId=')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}subId=${encodeURIComponent(subId)}`;
    }
    return url;
  });

  const response = await fetch(`https://api-gateway.coupang.com${apiPath}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({ coupangUrls }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error(`쿠팡 Deeplink API 오류: ${response.status}${body ? ` - ${body.slice(0, 240)}` : ''}`);
    err.statusCode = response.status;
    throw err;
  }

  const data = await response.json();
  return data?.data || [];
}

function logRateLimitOnce(message) {
  if (Date.now() - lastDeeplinkRateLogAt <= 60000) return;
  console.error('[Affiliate] Deeplink API rate limit 감지:', message.slice(0, 180));
  lastDeeplinkRateLogAt = Date.now();
}

function logAuthErrorOnce() {
  if (Date.now() - lastDeeplinkAuthLogAt <= 60000) return;
  console.error('[Affiliate] Deeplink API 401 감지: 호출을 일시 중단합니다.', `cooldownMs=${DEEPLINK_FAIL_COOLDOWN_MS}`);
  lastDeeplinkAuthLogAt = Date.now();
}

/**
 * 쿠팡 파트너스 Deeplink API
 * POST /api/affiliate/deeplink
 * Body: { "urls": ["https://www.coupang.com/..."], "subId": "lapprice_productcard" }
 */
router.post('/deeplink', async (req, res) => {
  const { urls, subId } = req.body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URL 배열이 필요합니다.', links: [] });
  }

  const limitedUrls = urls.slice(0, 50).map((url) => String(url || '').trim()).filter(Boolean);
  if (limitedUrls.length === 0) {
    return res.status(400).json({ error: '유효한 URL이 필요합니다.', links: [] });
  }

  if (!process.env.COUPANG_ACCESS_KEY || !process.env.COUPANG_SECRET_KEY) {
    return res.json(buildFallbackLinks(limitedUrls, {
      mode: 'fallback_no_key',
      error: '쿠팡 파트너스 API 키 미설정',
    }));
  }

  const cacheKey = `deeplink:${[...limitedUrls].sort().join('|')}:${subId || ''}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  const quota = await consumeDeeplinkQuota();
  if (quota.blocked) {
    const fallback = buildFallbackLinks(limitedUrls, {
      mode: quota.mode,
      retryAt: quota.retryAt,
      warning: quota.mode === 'fallback_cooldown'
        ? '쿠팡 Deeplink 일시 중단(쿨다운 중)'
        : '쿠팡 Deeplink 호출이 많아 잠시 원본 링크로 대체됩니다.',
    });
    setCachedResult(cacheKey, fallback, 60);
    return res.json(fallback);
  }

  try {
    const deeplinkData = await callCoupangDeeplinkApi(limitedUrls, subId);
    const links = limitedUrls.map((originalUrl, index) => {
      const deeplink = deeplinkData[index];
      return {
        originalUrl,
        affiliateUrl: deeplink?.landingUrl || originalUrl,
        shortenUrl: deeplink?.shortenUrl || deeplink?.landingUrl || originalUrl,
      };
    });

    const result = { mode: 'deeplink', links };
    setCachedResult(cacheKey, result, DEEPLINK_CACHE_TTL);
    return res.json(result);
  } catch (err) {
    const msg = (err && err.message) ? err.message : 'unknown error';
    const statusCode = Number(err?.statusCode || 0);

    if (statusCode === 401 || msg.includes('401')) {
      const retryAtIso = await setCooldownUntil(Date.now() + DEEPLINK_FAIL_COOLDOWN_MS);
      logAuthErrorOnce();
      const fallback = buildFallbackLinks(limitedUrls, {
        mode: 'fallback_no_key',
        retryAt: retryAtIso,
        error: msg,
      });
      setCachedResult(cacheKey, fallback, 300);
      return res.json(fallback);
    }

    if (isRateLimitError(msg, statusCode)) {
      const parsedRetryAtMs = parseRetryUntilMsFromMessage(msg);
      const cooldownUntilMs = Math.max(Date.now() + DEEPLINK_LOCAL_COOLDOWN_MS, parsedRetryAtMs + 1000);
      const retryAtIso = await setCooldownUntil(cooldownUntilMs);
      logRateLimitOnce(msg);
      const fallback = buildFallbackLinks(limitedUrls, {
        mode: 'fallback_rate_limited',
        retryAt: retryAtIso,
        warning: '쿠팡 Deeplink 호출이 많아 잠시 원본 링크로 대체됩니다.',
        error: msg,
      });
      setCachedResult(cacheKey, fallback, 120);
      return res.json(fallback);
    }

    console.error('[Affiliate] Deeplink API 오류:', msg);
    const fallback = buildFallbackLinks(limitedUrls, {
      mode: 'fallback_no_key',
      error: msg,
    });
    setCachedResult(cacheKey, fallback, 120);
    return res.json(fallback);
  }
});

/**
 * 단일 URL 변환 (GET 방식 - 간편 사용)
 * GET /api/affiliate/convert?url=https://www.coupang.com/...&subId=lapprice
 */
router.get('/convert', async (req, res) => {
  const { url, subId } = req.query;
  const targetUrl = String(url || '').trim();
  if (!targetUrl) {
    return res.status(400).json({ error: 'URL이 필요합니다.' });
  }

  if (!targetUrl.includes('coupang.com')) {
    return res.json({
      mode: 'deeplink',
      originalUrl: targetUrl,
      affiliateUrl: targetUrl,
      shortenUrl: targetUrl,
    });
  }

  const cacheKey = `deeplink:single:${targetUrl}:${subId || ''}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  if (!process.env.COUPANG_ACCESS_KEY || !process.env.COUPANG_SECRET_KEY) {
    const fallback = buildFallbackSingle(targetUrl, { mode: 'fallback_no_key' });
    setCachedResult(cacheKey, fallback, 300);
    return res.json(fallback);
  }

  const quota = await consumeDeeplinkQuota();
  if (quota.blocked) {
    const fallback = buildFallbackSingle(targetUrl, {
      mode: quota.mode,
      retryAt: quota.retryAt,
      warning: quota.mode === 'fallback_cooldown'
        ? '쿠팡 Deeplink 일시 중단(쿨다운 중)'
        : '쿠팡 Deeplink 호출이 많아 잠시 원본 링크로 대체됩니다.',
    });
    setCachedResult(cacheKey, fallback, 60);
    return res.json(fallback);
  }

  try {
    const deeplinkData = await callCoupangDeeplinkApi([targetUrl], subId);
    const deeplink = deeplinkData[0];
    const result = {
      mode: 'deeplink',
      originalUrl: targetUrl,
      affiliateUrl: deeplink?.landingUrl || targetUrl,
      shortenUrl: deeplink?.shortenUrl || deeplink?.landingUrl || targetUrl,
    };

    setCachedResult(cacheKey, result, DEEPLINK_CACHE_TTL);
    return res.json(result);
  } catch (err) {
    const msg = (err && err.message) ? err.message : 'unknown error';
    const statusCode = Number(err?.statusCode || 0);

    if (statusCode === 401 || msg.includes('401')) {
      const retryAtIso = await setCooldownUntil(Date.now() + DEEPLINK_FAIL_COOLDOWN_MS);
      logAuthErrorOnce();
      const fallback = buildFallbackSingle(targetUrl, {
        mode: 'fallback_no_key',
        retryAt: retryAtIso,
        error: msg,
      });
      setCachedResult(cacheKey, fallback, 300);
      return res.json(fallback);
    }

    if (isRateLimitError(msg, statusCode)) {
      const parsedRetryAtMs = parseRetryUntilMsFromMessage(msg);
      const cooldownUntilMs = Math.max(Date.now() + DEEPLINK_LOCAL_COOLDOWN_MS, parsedRetryAtMs + 1000);
      const retryAtIso = await setCooldownUntil(cooldownUntilMs);
      logRateLimitOnce(`${msg} (single)`);
      const fallback = buildFallbackSingle(targetUrl, {
        mode: 'fallback_rate_limited',
        retryAt: retryAtIso,
        warning: '쿠팡 Deeplink 호출이 많아 잠시 원본 링크로 대체됩니다.',
        error: msg,
      });
      setCachedResult(cacheKey, fallback, 120);
      return res.json(fallback);
    }

    const fallback = buildFallbackSingle(targetUrl, {
      mode: 'fallback_no_key',
      error: msg,
    });
    setCachedResult(cacheKey, fallback, 120);
    return res.json(fallback);
  }
});

module.exports = router;
