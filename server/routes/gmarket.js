const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const { fetchWithUA, parsePrice, getCachedResult, setCachedResult } = require('../utils/helpers');

/**
 * G마켓 크롤링
 * GET /api/gmarket?keyword=노트북
 */
router.get('/', async (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ source: 'gmarket', available: false, products: [], error: '검색어 필요' });
  }

  const cacheKey = `gmarket:${keyword}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://browse.gmarket.co.kr/search?keyword=${encodeURIComponent(keyword)}`;
    const response = await fetchWithUA(url);

    if (!response.ok) {
      throw new Error(`G마켓 요청 실패: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const products = [];

    // G마켓 검색 결과 파싱
    $('div.box__item-container, li.box__item-container').each((i, el) => {
      if (i >= 20) return false;
      const $el = $(el);
      const title = $el.find('span.text__item-title, a.link__item-title, .text__item').text().trim();
      const priceText = $el.find('strong.text__value, span.text__value, .box__price-seller strong').text().trim();
      const price = parsePrice(priceText);
      const link = $el.find('a.link__item, a[href*="item.gmarket"]').attr('href') || '';
      const image = $el.find('img').attr('data-original') || $el.find('img').attr('src') || '';

      if (title && price > 0) {
        products.push({
          title,
          price,
          link: link.startsWith('//') ? `https:${link}` : link,
          image: image.startsWith('//') ? `https:${image}` : image,
          mallName: 'G마켓',
        });
      }
    });

    const result = { source: 'gmarket', available: true, products };
    setCachedResult(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.json({ source: 'gmarket', available: false, products: [], error: err.message });
  }
});

module.exports = router;
