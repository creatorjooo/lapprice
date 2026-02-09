const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const { fetchWithUA, parsePrice, getCachedResult, setCachedResult } = require('../utils/helpers');

/**
 * 인터파크 크롤링
 * GET /api/interpark?q=노트북
 */
router.get('/', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ source: 'interpark', available: false, products: [], error: '검색어 필요' });
  }

  const cacheKey = `interpark:${q}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://shopping.interpark.com/search?q=${encodeURIComponent(q)}`;
    const response = await fetchWithUA(url, {
      headers: {
        'Referer': 'https://shopping.interpark.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`인터파크 요청 실패: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const products = [];

    // 인터파크 검색 결과 HTML 파싱
    $('li.prod_item, .search_result li, [class*="product-card"], .prd_list li, .prod-list li').each((i, el) => {
      if (i >= 20) return false;
      const $el = $(el);
      const title = $el.find('.prod_name a, .prd_name a, .name a, a.product_name').text().trim();
      const priceText = $el.find('.price .num, .prd_price, .prod_price strong, .price strong').text().trim();
      const price = parsePrice(priceText);
      const link = $el.find('.prod_name a, .prd_name a, .name a, a').first().attr('href') || '';
      const image = $el.find('img').attr('data-original') || $el.find('img').attr('src') || '';

      if (title && price > 0) {
        products.push({
          title,
          price,
          link: link.startsWith('/') ? `https://shopping.interpark.com${link}` : link,
          image: image.startsWith('//') ? `https:${image}` : image,
          mallName: '인터파크',
        });
      }
    });

    const result = { source: 'interpark', available: true, products };
    setCachedResult(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.json({ source: 'interpark', available: false, products: [], error: err.message });
  }
});

module.exports = router;
