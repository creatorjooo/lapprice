const express = require('express');

const {
  enqueueOfferVerification,
  enqueueBatchVerification,
  getVerificationMetrics,
} = require('../services/offerVerification');

const router = express.Router();

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() !== 'false';
}

function isAdminAuthenticated(req) {
  const authHeader = req.headers.authorization;
  const adminPassword = process.env.ADMIN_PASSWORD || 'lapprice2026admin';
  const password = req.body?.password || req.query?.password;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      if (parsed.role === 'admin' && parsed.exp > Date.now()) {
        return true;
      }
    } catch {
      // invalid token
    }
  }

  return password === adminPassword;
}

/**
 * POST /api/offers/:offerId/verify
 * 단건 강제 검증
 */
router.post('/:offerId/verify', async (req, res) => {
  if (!isAdminAuthenticated(req)) {
    return res.status(401).json({ error: '인증 필요' });
  }

  const { offerId } = req.params;
  if (!offerId) {
    return res.status(400).json({ error: 'offerId 필요' });
  }

  try {
    const result = await enqueueOfferVerification(offerId, {
      trigger: 'manual',
      force: parseBoolean(req.body?.force, true),
    });

    if (!result.ok && result.code === 'OFFER_NOT_FOUND') {
      return res.status(404).json(result);
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/offers/verify-batch
 * 배치 검증 트리거
 */
router.post('/verify-batch', async (req, res) => {
  if (!isAdminAuthenticated(req)) {
    return res.status(401).json({ error: '인증 필요' });
  }

  const type = req.body?.type;
  const limit = req.body?.limit;

  if (type && !['laptop', 'monitor', 'desktop'].includes(type)) {
    return res.status(400).json({ error: 'type은 laptop|monitor|desktop만 허용' });
  }

  try {
    const result = await enqueueBatchVerification(type, {
      trigger: 'batch',
      force: parseBoolean(req.body?.force, false),
      limit,
    });

    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/offers/metrics
 * 검증/불일치 운영 지표
 */
router.get('/metrics', (req, res) => {
  if (!isAdminAuthenticated(req)) {
    return res.status(401).json({ error: '인증 필요' });
  }

  const hours = Math.max(1, parseInt(req.query.hours || '24', 10) || 24);
  const metrics = getVerificationMetrics(hours);
  return res.json(metrics);
});

module.exports = router;
