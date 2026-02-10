const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const { fetchWithUA, parsePrice, getCachedResult, setCachedResult } = require('../utils/helpers');

/**
 * 옥션 크롤링
 * GET /api/auction?keyword=노트북
 */
router.get('/', async (req, res) => {
  const { keyword, limit = '20' } = req.query;

  if (!keyword) {
    return res.status(400).json({ source: 'auction', available: false, products: [], error: '검색어 필요' });
  }

  const parsedLimit = Math.max(5, Math.min(100, parseInt(limit, 10) || 20));
  const cacheKey = `auction:${keyword}:${parsedLimit}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://browse.auction.co.kr/search?keyword=${encodeURIComponent(keyword)}`;
    const response = await fetchWithUA(url);

    if (!response.ok) {
      throw new Error(`옥션 요청 실패: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const products = [];

    // 옥션 검색 결과 파싱 (G마켓과 유사한 ESM+ 구조)
    $('div.box__item-container, li.box__item-container, .itemcard').each((i, el) => {
      if (i >= parsedLimit) return false;
      const $el = $(el);
      const title = $el.find('span.text__item-title, a.link__item-title, .text__item, .itemcard__title').text().trim();
      const priceText = $el.find('strong.text__value, span.text__value, .itemcard__price strong').text().trim();
      const price = parsePrice(priceText);
      const link = $el.find('a.link__item, a[href*="itemno"]').attr('href') || '';
      const image = $el.find('img').attr('data-original') || $el.find('img').attr('src') || '';

      if (title && price > 0) {
        products.push({
          title,
          price,
          link: link.startsWith('//') ? `https:${link}` : link,
          image: image.startsWith('//') ? `https:${image}` : image,
          mallName: '옥션',
        });
      }
    });

    const result = { source: 'auction', available: true, products };
    setCachedResult(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.json({ source: 'auction', available: false, products: [], error: err.message });
  }
});

module.exports = router;
