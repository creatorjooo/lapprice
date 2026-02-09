const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const { fetchWithUA, parsePrice, getCachedResult, setCachedResult } = require('../utils/helpers');

/**
 * 다나와 크롤링
 * GET /api/danawa?query=노트북
 */
router.get('/', async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ source: 'danawa', available: false, products: [], error: '검색어 필요' });
  }

  const cacheKey = `danawa:${query}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(query)}&tab=goods&checkedInfo=N`;
    const response = await fetchWithUA(url, {
      headers: {
        'Referer': 'https://www.danawa.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`다나와 요청 실패: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const products = [];

    // 다나와 검색 결과 파싱
    $('li.prod_item, .product_list li').each((i, el) => {
      if (i >= 20) return false;
      const $el = $(el);
      const title = $el.find('p.prod_name a, .prod_name .text').text().trim();
      const priceText = $el.find('p.price_sect a strong, .price_sect strong').text().trim();
      const price = parsePrice(priceText);
      const link = $el.find('p.prod_name a, .prod_name a').attr('href') || '';
      const image = $el.find('div.thumb_image img').attr('data-original')
        || $el.find('div.thumb_image img').attr('src')
        || $el.find('.thumb_image img').attr('data-original')
        || '';

      if (title && price > 0) {
        products.push({
          title,
          price,
          link: link.startsWith('//') ? `https:${link}` : (link.startsWith('/') ? `https://www.danawa.com${link}` : link),
          image: image.startsWith('//') ? `https:${image}` : image,
          mallName: '다나와',
        });
      }
    });

    const result = { source: 'danawa', available: true, products };
    setCachedResult(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.json({ source: 'danawa', available: false, products: [], error: err.message });
  }
});

module.exports = router;
