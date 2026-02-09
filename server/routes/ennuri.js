const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const { fetchWithUA, parsePrice, getCachedResult, setCachedResult } = require('../utils/helpers');

/**
 * 에누리 크롤링
 * GET /api/ennuri?keyword=노트북
 */
router.get('/', async (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ source: 'ennuri', available: false, products: [], error: '검색어 필요' });
  }

  const cacheKey = `ennuri:${keyword}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://www.enuri.com/search/search.jsp?keyword=${encodeURIComponent(keyword)}`;
    const response = await fetchWithUA(url, {
      headers: {
        'Referer': 'https://www.enuri.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`에누리 요청 실패: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const products = [];

    // 에누리 검색 결과 파싱
    $('li.prod_item, .comm_prd_list li, .search_list li, .prod-list li').each((i, el) => {
      if (i >= 20) return false;
      const $el = $(el);
      const title = $el.find('.prod_name a, .prd_name a, a.name, .tit a').text().trim();
      const priceText = $el.find('.price .num, .prd_price .price, .price_sect strong, .price strong').text().trim();
      const price = parsePrice(priceText);
      const link = $el.find('.prod_name a, .prd_name a, a.name, .tit a').attr('href') || '';
      const image = $el.find('img').attr('data-original') || $el.find('img').attr('src') || '';

      if (title && price > 0) {
        products.push({
          title,
          price,
          link: link.startsWith('/') ? `https://www.enuri.com${link}` : link,
          image: image.startsWith('//') ? `https:${image}` : image,
          mallName: '에누리',
        });
      }
    });

    const result = { source: 'ennuri', available: true, products };
    setCachedResult(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.json({ source: 'ennuri', available: false, products: [], error: err.message });
  }
});

module.exports = router;
