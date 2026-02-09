const express = require('express');
const router = express.Router();
const xml2js = require('xml2js');
const { getCachedResult, setCachedResult } = require('../utils/helpers');

/**
 * 11번가 Open API
 * GET /api/11st?keyword=노트북&pageSize=20
 */
router.get('/', async (req, res) => {
  const { keyword, pageSize = '20' } = req.query;

  if (!keyword) {
    return res.status(400).json({ source: '11st', available: false, products: [], error: '검색어 필요' });
  }

  const apiKey = process.env.ELEVENTH_ST_API_KEY;
  if (!apiKey) {
    return res.json({ source: '11st', available: false, products: [], error: 'API 키 미설정' });
  }

  const cacheKey = `11st:${keyword}:${pageSize}`;
  const cached = getCachedResult(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `http://openapi.11st.co.kr/openapi/OpenApiService.tmall?key=${apiKey}&apiCode=ProductSearch&keyword=${encodeURIComponent(keyword)}&pageSize=${pageSize}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`11번가 API 오류: ${response.status}`);
    }

    const xmlText = await response.text();
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
    const parsed = await parser.parseStringPromise(xmlText);

    let items = [];
    const productsNode = parsed?.ProductSearchResponse?.Products?.Product;
    if (Array.isArray(productsNode)) {
      items = productsNode;
    } else if (productsNode) {
      items = [productsNode];
    }

    const products = items.map((item) => ({
      title: item.ProductName || '',
      price: parseInt(item.ProductPrice, 10) || 0,
      originalPrice: parseInt(item.ProductPriceOrg, 10) || undefined,
      link: item.DetailPageUrl || '',
      image: item.ProductImage300 || item.ProductImage || '',
      mallName: item.SellerNick || '11번가',
      category: item.ProductCategory || '',
    }));

    const result = { source: '11st', available: true, products };
    setCachedResult(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.json({ source: '11st', available: false, products: [], error: err.message });
  }
});

module.exports = router;
