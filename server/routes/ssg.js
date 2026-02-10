const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const { fetchWithUA, parsePrice, getCachedResult, setCachedResult } = require('../utils/helpers');

/**
 * SSG닷컴 크롤링
 * GET /api/ssg?query=노트북
 */
router.get('/', async (req, res) => {
  const { query, limit = '20' } = req.query;

  if (!query) {
    return res.status(400).json({ source: 'ssg', available: false, products: [], error: '검색어 필요' });
  }

  const parsedLimit = Math.max(5, Math.min(100, parseInt(limit, 10) || 20));
  const cacheKey = `ssg:${query}:${parsedLimit}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  try {
    // SSG는 내부 API를 사용할 가능성이 있으므로 먼저 JSON API 시도
    const apiUrl = `https://www.ssg.com/search.ssg?query=${encodeURIComponent(query)}&target=all`;
    const response = await fetchWithUA(apiUrl, {
      headers: {
        'Referer': 'https://www.ssg.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`SSG 요청 실패: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const products = [];

    // SSG 검색 결과 HTML 파싱
    $('li.cunit_t232, li.cunit_t211, .csrch_unit li, [data-unittype]').each((i, el) => {
      if (i >= parsedLimit) return false;
      const $el = $(el);
      const title = $el.find('.cunit_info .title a, .csrch_name a, .cunit_md .title').text().trim();
      const priceText = $el.find('.cunit_price .ssg_price, .opt_price .ssg_price, em.ssg_price').text().trim();
      const price = parsePrice(priceText);
      const link = $el.find('.cunit_info .title a, .csrch_name a').attr('href') || '';
      const image = $el.find('img.i_img, img.cunit_img').attr('data-original')
        || $el.find('img.i_img, img.cunit_img').attr('src')
        || $el.find('img').attr('src')
        || '';

      if (title && price > 0) {
        products.push({
          title,
          price,
          link: link.startsWith('/') ? `https://www.ssg.com${link}` : link,
          image: image.startsWith('//') ? `https:${image}` : image,
          mallName: 'SSG닷컴',
        });
      }
    });

    const result = { source: 'ssg', available: true, products };
    setCachedResult(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.json({ source: 'ssg', available: false, products: [], error: err.message });
  }
});

module.exports = router;
