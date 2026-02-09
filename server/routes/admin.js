const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const AFFILIATE_LINKS_FILE = path.join(__dirname, '..', 'config', 'affiliate-links.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'lapprice2026admin';

// 인증 미들웨어
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: '비밀번호가 올바르지 않습니다.' });
  }

  next();
}

// 어필리에이트 링크 읽기
function readAffiliateLinks() {
  try {
    const data = fs.readFileSync(AFFILIATE_LINKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { naver: {}, coupang: {} };
  }
}

// 어필리에이트 링크 저장
function writeAffiliateLinks(data) {
  fs.writeFileSync(AFFILIATE_LINKS_FILE, JSON.stringify(data, null, 2));
}

/**
 * 로그인 확인
 * POST /api/admin/login
 * Body: { password }
 */
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(403).json({ error: '비밀번호가 올바르지 않습니다.' });
  }
});

/**
 * 전체 어필리에이트 링크 목록 조회
 * GET /api/admin/affiliate-links
 */
router.get('/affiliate-links', requireAuth, (req, res) => {
  try {
    const data = readAffiliateLinks();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 어필리에이트 링크 추가/수정
 * POST /api/admin/affiliate-links
 * Body: { platform, productKey, url }
 */
router.post('/affiliate-links', requireAuth, (req, res) => {
  try {
    const { platform, productKey, url } = req.body;

    if (!platform || !productKey) {
      return res.status(400).json({ error: 'platform과 productKey가 필요합니다.' });
    }

    const data = readAffiliateLinks();

    if (!data[platform]) {
      data[platform] = {};
    }

    data[platform][productKey] = url || '';

    writeAffiliateLinks(data);

    res.json({ success: true, message: '링크가 저장되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 어필리에이트 링크 삭제
 * DELETE /api/admin/affiliate-links
 * Body: { platform, productKey }
 */
router.delete('/affiliate-links', requireAuth, (req, res) => {
  try {
    const { platform, productKey } = req.body;

    if (!platform || !productKey) {
      return res.status(400).json({ error: 'platform과 productKey가 필요합니다.' });
    }

    const data = readAffiliateLinks();

    if (data[platform] && data[platform][productKey] !== undefined) {
      delete data[platform][productKey];
      writeAffiliateLinks(data);
    }

    res.json({ success: true, message: '링크가 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 클릭 통계 대시보드 데이터
 * GET /api/admin/click-stats?days=7
 */
router.get('/click-stats', requireAuth, (req, res) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const LOG_FILE = process.env.CLICK_LOG_PATH || path.join(__dirname, '..', 'logs', 'clicks.jsonl');

    if (!fs.existsSync(LOG_FILE)) {
      return res.json({
        totalClicks: 0,
        byPlatform: {},
        bySource: {},
        byDay: {},
        topProducts: [],
      });
    }

    const lines = fs.readFileSync(LOG_FILE, 'utf-8').split('\n').filter(Boolean);
    const entries = lines
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter((e) => e && new Date(e.timestamp) >= since);

    const byPlatform = {};
    const bySource = {};
    const byDay = {};
    const productClicks = {};

    entries.forEach((e) => {
      byPlatform[e.platform] = (byPlatform[e.platform] || 0) + 1;
      bySource[e.source] = (bySource[e.source] || 0) + 1;

      // 일별 분류
      const day = e.timestamp.split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;

      const key = e.productName || e.productId || 'unknown';
      productClicks[key] = (productClicks[key] || 0) + 1;
    });

    const topProducts = Object.entries(productClicks)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([product, clicks]) => ({ product, clicks }));

    // 오늘, 7일, 30일 구분
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const todayClicks = entries.filter((e) => e.timestamp.startsWith(todayStr)).length;
    const weekClicks = entries.filter((e) => new Date(e.timestamp) >= sevenDaysAgo).length;

    res.json({
      totalClicks: entries.length,
      todayClicks,
      weekClicks,
      period: `${days}일`,
      byPlatform,
      bySource,
      byDay,
      topProducts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
