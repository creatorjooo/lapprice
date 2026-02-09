const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { stripHtml, getCachedResult, setCachedResult } = require('../utils/helpers');

/**
 * 네이버 쇼핑커넥트 어필리에이트 링크 매칭
 * affiliate-links.json에서 상품명과 퍼지 매칭하여 어필리에이트 URL 반환
 */
function getNaverAffiliateLink(productTitle) {
  try {
    const configPath = path.join(__dirname, '..', 'config', 'affiliate-links.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const naverLinks = config.naver || {};
    const titleLower = productTitle.toLowerCase();

    for (const [keyword, url] of Object.entries(naverLinks)) {
      if (keyword.startsWith('_')) continue; // _설명, _등록방법 등 메타 필드 스킵
      if (!url) continue; // 빈 URL 스킵
      if (titleLower.includes(keyword.toLowerCase())) {
        return url;
      }
    }
  } catch {
    // 설정 파일 없거나 파싱 오류 시 무시
  }
  return null;
}

/**
 * 네이버 쇼핑 API
 * GET /api/naver?query=노트북&display=20&sort=sim
 */
router.get('/', async (req, res) => {
  const { query, display = '20', sort = 'sim' } = req.query;

  if (!query) {
    return res.status(400).json({ source: 'naver', available: false, products: [], error: '검색어 필요' });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.json({ source: 'naver', available: false, products: [], error: 'API 키 미설정' });
  }

  const cacheKey = `naver:${query}:${display}:${sort}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;
    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`네이버 API 오류: ${response.status}`);
    }

    const data = await response.json();
    const products = (data.items || []).map((item) => {
      const title = stripHtml(item.title);
      const affiliateLink = getNaverAffiliateLink(title);

      return {
        title,
        price: parseInt(item.lprice, 10) || 0,
        originalPrice: parseInt(item.hprice, 10) || undefined,
        link: affiliateLink || item.link,
        image: item.image,
        mallName: item.mallName || '네이버쇼핑',
        category: item.category1 || '',
        isAffiliate: !!affiliateLink,
      };
    });

    const result = { source: 'naver', available: true, products };
    setCachedResult(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.json({ source: 'naver', available: false, products: [], error: err.message });
  }
});

module.exports = router;
