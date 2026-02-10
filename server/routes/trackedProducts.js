const express = require('express');
const router = express.Router();
const {
  listTrackedProducts,
  addTrackedProduct,
  deleteTrackedProduct,
  getTrackedProduct,
  getTrackedPriceHistory,
  refreshAllTrackedProducts,
} = require('../services/trackedProducts');

router.get('/', (req, res) => {
  const items = listTrackedProducts();
  res.json({ total: items.length, items });
});

router.post('/', (req, res) => {
  const { source, title, link, query, image, mallName, price, originalPrice, productType } = req.body || {};

  if (!source || !title || !link) {
    return res.status(400).json({ error: 'source, title, link는 필수입니다.' });
  }

  const tracked = addTrackedProduct({
    source,
    title,
    link,
    query,
    image,
    mallName,
    price: Number(price) || 0,
    originalPrice: Number(originalPrice) || Number(price) || 0,
    productType,
  });

  return res.json({ success: true, item: tracked });
});

router.delete('/:id', (req, res) => {
  const ok = deleteTrackedProduct(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: '추적 대상을 찾을 수 없습니다.' });
  }
  return res.json({ success: true });
});

router.get('/:id/history', (req, res) => {
  const tracked = getTrackedProduct(req.params.id);
  if (!tracked) {
    return res.status(404).json({ error: '추적 대상을 찾을 수 없습니다.' });
  }
  const history = getTrackedPriceHistory(req.params.id);
  return res.json({ id: req.params.id, history });
});

router.post('/refresh', async (req, res) => {
  try {
    const apiBaseUrl = process.env.API_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3001}`;
    const result = await refreshAllTrackedProducts(apiBaseUrl);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
