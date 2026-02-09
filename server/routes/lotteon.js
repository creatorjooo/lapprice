const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const { fetchWithUA, parsePrice, getCachedResult, setCachedResult } = require('../utils/helpers');

/**
 * 롯데ON 크롤링
 * GET /api/lotteon?q=노트북
 */
router.get('/', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ source: 'lotteon', available: false, products: [], error: '검색어 필요' });
  }

  const cacheKey = `lotteon:${q}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  try {
    // 롯데ON 내부 검색 API 시도
    const apiUrl = `https://www.lotteon.com/search/search/search.ecn?render=search&platform=pc&q=${encodeURIComponent(q)}&mallId=1`;
    const response = await fetchWithUA(apiUrl, {
      headers: {
        'Referer': 'https://www.lotteon.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`롯데ON 요청 실패: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const products = [];

    // 롯데ON 검색 결과 HTML 파싱
    $('li.srchProductItem, .srchProductList li, [class*="product-item"], .search_list li').each((i, el) => {
      if (i >= 20) return false;
      const $el = $(el);
      const title = $el.find('.srchProductInfo .name, .product-name, a.product_name, .prd_name').text().trim();
      const priceText = $el.find('.srchProductInfo .price, .product-price .final, .s_price, .prd_price').text().trim();
      const price = parsePrice(priceText);
      const link = $el.find('a').first().attr('href') || '';
      const image = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';

      if (title && price > 0) {
        products.push({
          title,
          price,
          link: link.startsWith('/') ? `https://www.lotteon.com${link}` : link,
          image: image.startsWith('//') ? `https:${image}` : image,
          mallName: '롯데ON',
        });
      }
    });

    const result = { source: 'lotteon', available: true, products };
    setCachedResult(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.json({ source: 'lotteon', available: false, products: [], error: err.message });
  }
});

module.exports = router;
