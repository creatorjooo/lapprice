const express = require('express');
const router = express.Router();
const CryptoJS = require('crypto-js');
const { getCachedResult, setCachedResult } = require('../utils/helpers');

// Deeplink 전용 캐시 TTL (24시간 - 어필리에이트 링크는 자주 변하지 않음)
const DEEPLINK_CACHE_TTL = parseInt(process.env.DEEPLINK_CACHE_TTL || '86400', 10);

/**
 * 쿠팡 파트너스 Deeplink API
 * POST /api/affiliate/deeplink
 * Body: { "urls": ["https://www.coupang.com/..."], "subId": "lapprice_productcard" }
 * Response: { "links": [{ "originalUrl": "...", "affiliateUrl": "...", "shortenUrl": "..." }] }
 */
router.post('/deeplink', async (req, res) => {
  const { urls, subId } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URL 배열이 필요합니다.', links: [] });
  }

  // 최대 50개 URL 제한 (API 제한 대응)
  const limitedUrls = urls.slice(0, 50);

  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    return res.json({
      error: '쿠팡 파트너스 API 키 미설정',
      links: limitedUrls.map((url) => ({
        originalUrl: url,
        affiliateUrl: url,
        shortenUrl: url,
      })),
    });
  }

  // 캐시 확인 (URL 배열을 정렬하여 일관된 캐시 키 생성)
  const cacheKey = `deeplink:${limitedUrls.sort().join('|')}:${subId || ''}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  try {
    const method = 'POST';
    const apiPath = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
    const datetime = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    // HMAC-SHA256 서명 생성
    const message = `${datetime}${method}${apiPath}`;
    const signature = CryptoJS.HmacSHA256(message, secretKey).toString(CryptoJS.enc.Hex);
    const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;

    // subId가 있으면 URL에 추가
    const coupangUrls = limitedUrls.map((url) => {
      if (subId && !url.includes('subId=')) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}subId=${encodeURIComponent(subId)}`;
      }
      return url;
    });

    const apiUrl = `https://api-gateway.coupang.com${apiPath}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify({ coupangUrls }),
    });

    if (!response.ok) {
      throw new Error(`쿠팡 Deeplink API 오류: ${response.status}`);
    }

    const data = await response.json();
    const deeplinkData = data?.data || [];

    const links = limitedUrls.map((originalUrl, index) => {
      const deeplink = deeplinkData[index];
      return {
        originalUrl,
        affiliateUrl: deeplink?.landingUrl || originalUrl,
        shortenUrl: deeplink?.shortenUrl || deeplink?.landingUrl || originalUrl,
      };
    });

    const result = { links };
    setCachedResult(cacheKey, result, DEEPLINK_CACHE_TTL);
    res.json(result);
  } catch (err) {
    console.error('[Affiliate] Deeplink API 오류:', err.message);
    // 실패 시 원본 URL 반환 (서비스 중단 방지)
    res.json({
      error: err.message,
      links: limitedUrls.map((url) => ({
        originalUrl: url,
        affiliateUrl: url,
        shortenUrl: url,
      })),
    });
  }
});

/**
 * 단일 URL 변환 (GET 방식 - 간편 사용)
 * GET /api/affiliate/convert?url=https://www.coupang.com/...&subId=lapprice
 */
router.get('/convert', async (req, res) => {
  const { url, subId } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL이 필요합니다.' });
  }

  // 쿠팡 URL이 아닌 경우 그대로 반환
  if (!url.includes('coupang.com')) {
    return res.json({ originalUrl: url, affiliateUrl: url, shortenUrl: url });
  }

  const cacheKey = `deeplink:single:${url}:${subId || ''}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    return res.json({ originalUrl: url, affiliateUrl: url, shortenUrl: url });
  }

  try {
    const method = 'POST';
    const apiPath = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
    const datetime = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const message = `${datetime}${method}${apiPath}`;
    const signature = CryptoJS.HmacSHA256(message, secretKey).toString(CryptoJS.enc.Hex);
    const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;

    const targetUrl = subId && !url.includes('subId=')
      ? `${url}${url.includes('?') ? '&' : '?'}subId=${encodeURIComponent(subId)}`
      : url;

    const apiUrl = `https://api-gateway.coupang.com${apiPath}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify({ coupangUrls: [targetUrl] }),
    });

    if (!response.ok) throw new Error(`API 오류: ${response.status}`);

    const data = await response.json();
    const deeplink = data?.data?.[0];

    const result = {
      originalUrl: url,
      affiliateUrl: deeplink?.landingUrl || url,
      shortenUrl: deeplink?.shortenUrl || deeplink?.landingUrl || url,
    };

    setCachedResult(cacheKey, result, DEEPLINK_CACHE_TTL);
    res.json(result);
  } catch (err) {
    res.json({ originalUrl: url, affiliateUrl: url, shortenUrl: url, error: err.message });
  }
});

module.exports = router;
