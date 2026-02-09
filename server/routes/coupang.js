const express = require('express');
const router = express.Router();
const CryptoJS = require('crypto-js');
const { getCachedResult, setCachedResult } = require('../utils/helpers');

/**
 * HMAC-SHA256 서명 생성 (쿠팡 파트너스 API 공통)
 */
function generateHmac(method, apiPath, query) {
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;
  const datetime = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const message = query
    ? `${datetime}${method}${apiPath}${query}`
    : `${datetime}${method}${apiPath}`;
  const signature = CryptoJS.HmacSHA256(message, secretKey).toString(CryptoJS.enc.Hex);

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

/**
 * 쿠팡 URL 배열을 어필리에이트 Deeplink로 변환
 */
async function convertToDeeplinks(urls, subId) {
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;
  if (!accessKey || !secretKey || urls.length === 0) return urls;

  try {
    const apiPath = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
    const authorization = generateHmac('POST', apiPath);

    const coupangUrls = urls.map((url) => {
      if (subId && !url.includes('subId=')) {
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}subId=${encodeURIComponent(subId)}`;
      }
      return url;
    });

    const response = await fetch(`https://api-gateway.coupang.com${apiPath}`, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json;charset=UTF-8',
      },
      body: JSON.stringify({ coupangUrls }),
    });

    if (!response.ok) return urls;

    const data = await response.json();
    const deeplinkData = data?.data || [];

    return urls.map((originalUrl, i) => {
      const dl = deeplinkData[i];
      return dl?.landingUrl || dl?.shortenUrl || originalUrl;
    });
  } catch {
    return urls;
  }
}

/**
 * 쿠팡 파트너스 API
 * GET /api/coupang?keyword=노트북&limit=20
 */
router.get('/', async (req, res) => {
  const { keyword, limit = '20' } = req.query;

  if (!keyword) {
    return res.status(400).json({ source: 'coupang', available: false, products: [], error: '검색어 필요' });
  }

  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    return res.json({ source: 'coupang', available: false, products: [], error: 'API 키 미설정' });
  }

  const cacheKey = `coupang:${keyword}:${limit}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  try {
    const method = 'GET';
    const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search';
    const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
    const authorization = generateHmac(method, path, query);

    const url = `https://api-gateway.coupang.com${path}?${query}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`쿠팡 API 오류: ${response.status}`);
    }

    const data = await response.json();
    const productData = data?.data?.productData || [];

    // 상품 URL 배열 추출 후 Deeplink 변환
    const productUrls = productData.map((item) => item.productUrl || '');
    const subIdPrefix = process.env.COUPANG_AFFILIATE_SUBID_PREFIX || 'lapprice';
    const affiliateUrls = await convertToDeeplinks(
      productUrls.filter(Boolean),
      `${subIdPrefix}_search`
    );

    // URL 인덱스 매핑
    let affiliateIdx = 0;
    const products = productData.map((item) => {
      const originalUrl = item.productUrl || '';
      const affiliateUrl = originalUrl ? affiliateUrls[affiliateIdx++] || originalUrl : '';
      return {
        title: item.productName || '',
        price: item.productPrice || 0,
        originalPrice: item.originalPrice || undefined,
        link: affiliateUrl,
        image: item.productImage || '',
        mallName: '쿠팡',
        category: item.categoryName || '',
        isAffiliate: affiliateUrl !== originalUrl,
      };
    });

    const result = { source: 'coupang', available: true, products };
    setCachedResult(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.json({ source: 'coupang', available: false, products: [], error: err.message });
  }
});

module.exports = router;
module.exports.convertToDeeplinks = convertToDeeplinks;
