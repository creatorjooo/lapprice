const express = require('express');
const router = express.Router();
const { getPriceHistory, syncAll, syncProductType, healAllImages, searchProductImage } = require('../services/productSync');
const {
  prepareCatalogForResponse,
  verifyAllOffers,
  isVerifiedOnlyMode,
  isStrictPriceGuardEnabled,
  getListingPriceTtlSec,
  getDisplayPriceFreshMinutes,
} = require('../services/offerVerification');

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() !== 'false';
}

function normalizeStoreVisibility(value, fallback = 'all') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'verified') return 'verified';
  if (normalized === 'all') return 'all';
  return fallback;
}

function buildCoverage(products) {
  const safeProducts = Array.isArray(products) ? products : [];
  const storeCounts = safeProducts.map((product) => Array.isArray(product?.stores) ? product.stores.length : 0);
  const totalStores = storeCounts.reduce((sum, count) => sum + count, 0);
  const avgStoresPerProduct = safeProducts.length > 0
    ? Number((totalStores / safeProducts.length).toFixed(2))
    : 0;

  const platformCoverage = {};
  for (const product of safeProducts) {
    const seenPerProduct = new Set();
    for (const store of product?.stores || []) {
      const source = String(store?.source || 'unknown').trim().toLowerCase() || 'unknown';
      if (seenPerProduct.has(source)) continue;
      seenPerProduct.add(source);
      platformCoverage[source] = (platformCoverage[source] || 0) + 1;
    }
  }

  return { avgStoresPerProduct, platformCoverage };
}

function normalizePriceMode(value, fallback = 'strict') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'strict') return 'strict';
  if (normalized === 'verifiedonly' || normalized === 'verified_only') return 'strict';
  if (normalized === 'legacy') return 'legacy';
  if (normalized === 'default') return 'legacy';
  return fallback;
}

/**
 * GET /api/products
 * 자동 수집된 상품 목록 반환
 * 
 * Query params:
 *   type: 'laptop' | 'monitor' | 'desktop' (필수)
 *   category: 카테고리 필터 (선택)
 *   brand: 브랜드 필터 (선택)
 *   minPrice: 최소 가격 (선택)
 *   maxPrice: 최대 가격 (선택)
 *   sort: 정렬 기준 (선택, 기본값 'discount')
 *   limit: 최대 개수 (선택, 기본값 100)
 *   offset: 건너뛸 개수 (선택, 기본값 0)
 *   storeVisibility: 'all' | 'verified' (선택, 기본값 all)
 *   priceMode: 'strict' | 'legacy' (선택, 기본값 strict)
 *   verifiedOnly: 레거시 호환 파라미터 (선택)
 */
router.get('/', (req, res) => {
  const {
    type,
    category,
    brand,
    minPrice,
    maxPrice,
    sort = 'discount',
    limit = '100',
    offset = '0',
    q,
    storeVisibility,
    priceMode,
    verifiedOnly,
  } = req.query;

  if (!type || !['laptop', 'monitor', 'desktop'].includes(type)) {
    return res.status(400).json({ error: 'type 파라미터 필요 (laptop | monitor | desktop)' });
  }

  const fallbackVisibility = isVerifiedOnlyMode() ? 'verified' : 'all';
  const visibility = verifiedOnly !== undefined
    ? (parseBoolean(verifiedOnly, false) ? 'verified' : 'all')
    : normalizeStoreVisibility(storeVisibility, fallbackVisibility);
  const resolvedPriceMode = normalizePriceMode(priceMode, 'strict');

  const catalog = prepareCatalogForResponse(type, {
    storeVisibility: visibility,
    priceMode: resolvedPriceMode,
    strictGuard: isStrictPriceGuardEnabled(),
  });
  let products = catalog.products || [];

  // 검색어 필터
  if (q) {
    const query = q.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query) ||
      p.model.toLowerCase().includes(query) ||
      (p.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }

  // 카테고리 필터
  if (category) {
    products = products.filter(p => p.category === category);
  }

  // 브랜드 필터
  if (brand) {
    const brands = brand.split(',').map(b => b.trim().toLowerCase());
    products = products.filter(p => brands.includes(p.brand.toLowerCase()));
  }

  // 가격 범위 필터
  if (minPrice) {
    products = products.filter(p => p.prices.current >= parseInt(minPrice, 10));
  }
  if (maxPrice) {
    products = products.filter(p => p.prices.current <= parseInt(maxPrice, 10));
  }

  // 정렬
  switch (sort) {
    case 'price-asc':
      products.sort((a, b) => a.prices.current - b.prices.current);
      break;
    case 'price-desc':
      products.sort((a, b) => b.prices.current - a.prices.current);
      break;
    case 'discount':
      products.sort((a, b) => b.discount.percent - a.discount.percent);
      break;
    case 'price-index':
      products.sort((a, b) => b.priceIndex - a.priceIndex);
      break;
    case 'rating':
      products.sort((a, b) => b.rating.score - a.rating.score);
      break;
    case 'newest':
      products.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
      break;
  }

  // 페이지네이션
  const offsetNum = parseInt(offset, 10) || 0;
  const limitNum = Math.min(parseInt(limit, 10) || 100, 200);
  const paginatedProducts = products.slice(offsetNum, offsetNum + limitNum);
  const coverage = buildCoverage(products);
  const verifiedOnlyMode = visibility === 'verified';

  res.json({
    type,
    storeVisibility: visibility,
    priceMode: resolvedPriceMode,
    verifiedOnly: verifiedOnlyMode,
    total: products.length,
    offset: offsetNum,
    limit: limitNum,
    lastSync: catalog.lastSync,
    syncCount: catalog.syncCount,
    stats: catalog.stats,
    meta: {
      priceMode: resolvedPriceMode,
      listingPriceTtlSec: getListingPriceTtlSec(),
      displayPriceFreshMinutes: getDisplayPriceFreshMinutes(),
      generatedAt: catalog.generatedAt || new Date().toISOString(),
      strictGuard: isStrictPriceGuardEnabled(),
      coverage,
    },
    coverage,
    products: paginatedProducts,
  });
});

/**
 * GET /api/products/price-history/:id
 * 특정 상품의 가격 히스토리
 */
router.get('/price-history/:id', (req, res) => {
  const { id } = req.params;
  const history = getPriceHistory(id);
  res.json({ productId: id, history });
});

/**
 * GET /api/products/stats
 * 전체 카탈로그 통계
 */
router.get('/stats', (req, res) => {
  const types = ['laptop', 'monitor', 'desktop'];
  const stats = {};

  for (const type of types) {
    const catalog = prepareCatalogForResponse(type, { storeVisibility: 'all' });
    stats[type] = {
      total: (catalog.products || []).length,
      lastSync: catalog.lastSync,
      syncCount: catalog.syncCount,
      ...(catalog.stats || {}),
    };
  }

  stats.overall = {
    totalProducts: Object.values(stats).reduce((sum, s) => sum + (s.total || 0), 0),
  };

  res.json(stats);
});

/**
 * POST /api/products/sync
 * 수동 동기화 트리거 (관리자용)
 */
router.post('/sync', async (req, res) => {
  // Bearer token 또는 비밀번호 인증
  const { password, type } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'lapprice2026admin';
  const authHeader = req.headers.authorization;
  
  // Bearer token 인증 (admin 라우트에서 발급한 토큰)
  let authenticated = false;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    // /api/admin/login returns ADMIN_PASSWORD as the Bearer token.
    if (token === adminPassword) authenticated = true;
  }
  
  // 레거시: 비밀번호 인증
  if (!authenticated && password === adminPassword) {
    authenticated = true;
  }
  
  if (!authenticated) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  try {
    let results;
    if (type && ['laptop', 'monitor', 'desktop'].includes(type)) {
      results = { [type]: await syncProductType(type) };
    } else {
      results = await syncAll();
    }

    // 수동 동기화 직후 이미지 자동 보충까지 연계
    const healResults = await healAllImages();
    const verification = await verifyAllOffers({ trigger: 'batch', force: true });
    res.json({ success: true, results, healResults, verification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/products/hot-deals
 * 전 카테고리 통합 핫딜
 */
router.get('/hot-deals', (req, res) => {
  const { limit = '12' } = req.query;
  const limitNum = Math.min(parseInt(limit, 10) || 12, 50);

  const allProducts = [];
  for (const type of ['laptop', 'monitor', 'desktop']) {
    const catalog = prepareCatalogForResponse(type, { storeVisibility: 'all' });
    allProducts.push(...(catalog.products || []));
  }

  const hotDeals = allProducts
    .filter(p => p.discount.percent > 0 && p.stock !== 'out')
    .sort((a, b) => {
      const scoreA = a.discount.percent * 0.6 + a.priceIndex * 0.4;
      const scoreB = b.discount.percent * 0.6 + b.priceIndex * 0.4;
      return scoreB - scoreA;
    })
    .slice(0, limitNum);

  res.json({ total: hotDeals.length, products: hotDeals });
});

/**
 * POST /api/products/heal-images
 * 이미지 없는 제품에 대해 네이버에서 자동으로 이미지 검색/보충
 * (관리자 전용)
 */
router.post('/heal-images', async (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'lapprice2026admin';
  const authHeader = req.headers.authorization;

  // sync 엔드포인트와 동일한 인증 방식 사용
  let authenticated = false;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token === adminPassword) authenticated = true;
  }

  if (!authenticated && password === adminPassword) {
    authenticated = true;
  }

  if (!authenticated) {
    return res.status(401).json({ error: '인증 필요' });
  }

  try {
    const results = await healAllImages();
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/products/search-image
 * 특정 제품명으로 이미지 검색 (관리자용)
 */
router.get('/search-image', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q 파라미터 필요' });

  try {
    const result = await searchProductImage(q);
    if (result) {
      res.json(result);
    } else {
      res.json({ image: null, message: '이미지를 찾을 수 없습니다' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
