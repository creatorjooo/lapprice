const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.CLICK_LOG_PATH
  ? path.dirname(process.env.CLICK_LOG_PATH)
  : path.join(__dirname, '..', 'logs');

const LOG_FILE = process.env.CLICK_LOG_PATH || path.join(LOG_DIR, 'clicks.jsonl');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

// 로그 디렉터리 생성
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * 로그 로테이션: 10MB 초과 시 날짜 suffix 붙여 아카이브
 */
function rotateLogIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const stats = fs.statSync(LOG_FILE);
    if (stats.size >= MAX_LOG_SIZE) {
      const dateStr = new Date().toISOString().split('T')[0];
      const ext = path.extname(LOG_FILE);
      const base = LOG_FILE.slice(0, -ext.length);
      const archivePath = `${base}.${dateStr}${ext}`;
      // 같은 날짜 아카이브가 이미 있으면 타임스탬프 추가
      const finalPath = fs.existsSync(archivePath)
        ? `${base}.${dateStr}-${Date.now()}${ext}`
        : archivePath;
      fs.renameSync(LOG_FILE, finalPath);
      console.log(`[Track] 로그 로테이션: ${path.basename(finalPath)}`);
    }
  } catch (err) {
    console.error('[Track] 로그 로테이션 실패:', err.message);
  }
}

/**
 * 클릭 트래킹
 * POST /api/track/click
 * Body: { productId, platform, source, url, productName }
 */
router.post('/click', (req, res) => {
  try {
    const { productId, platform, source, url, productName } = req.body;

    const logEntry = {
      timestamp: new Date().toISOString(),
      productId: productId || 'unknown',
      platform: platform || 'unknown',
      source: source || 'unknown',
      url: url || '',
      productName: productName || '',
      userAgent: req.headers['user-agent'] || '',
      ip: req.ip || req.connection?.remoteAddress || '',
      referer: req.headers['referer'] || '',
    };

    // 로테이션 체크 (매 기록 시)
    rotateLogIfNeeded();

    // JSONL 형식으로 추가 (비동기 - 응답 차단 안 함)
    fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n', (err) => {
      if (err) console.error('[Track] 로그 기록 실패:', err.message);
    });

    res.status(204).end();
  } catch (err) {
    // 트래킹 실패해도 사용자 경험에 영향 없도록 204 반환
    res.status(204).end();
  }
});

/**
 * 클릭 통계 조회 (관리자용)
 * GET /api/track/stats?days=7
 */
router.get('/stats', (req, res) => {
  try {
    const days = parseInt(req.query.days || '7', 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    if (!fs.existsSync(LOG_FILE)) {
      return res.json({ totalClicks: 0, byPlatform: {}, bySource: {}, topProducts: [] });
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
    const byHour = {};
    const productClicks = {};

    // 시간대별 초기화 (0~23)
    for (let h = 0; h < 24; h++) {
      byHour[h] = 0;
    }

    entries.forEach((e) => {
      byPlatform[e.platform] = (byPlatform[e.platform] || 0) + 1;
      bySource[e.source] = (bySource[e.source] || 0) + 1;
      const day = e.timestamp.split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
      // 시간대별 집계
      const hour = new Date(e.timestamp).getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;
      const key = e.productId || e.productName;
      if (key) {
        productClicks[key] = (productClicks[key] || 0) + 1;
      }
    });

    const topProducts = Object.entries(productClicks)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([product, clicks]) => ({ product, clicks }));

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const todayClicks = entries.filter((e) => e.timestamp.startsWith(todayStr)).length;
    const yesterdayClicks = entries.filter((e) => e.timestamp.startsWith(yesterdayStr)).length;
    const weekClicks = entries.filter((e) => new Date(e.timestamp) >= sevenDaysAgo).length;

    // 이전 기간 비교 (전주 클릭)
    const allEntries = lines
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
    const prevWeekClicks = allEntries.filter((e) => {
      const d = new Date(e.timestamp);
      return d >= fourteenDaysAgo && d < sevenDaysAgo;
    }).length;

    // 추정 수익: 클릭 x 전환율(3%) x 평균단가(150만원) x 커미션(3%)
    const AVG_CONVERSION = 0.03;
    const AVG_PRICE = 1500000;
    const AVG_COMMISSION = 0.03;
    const estimatedRevenue = Math.round(entries.length * AVG_CONVERSION * AVG_PRICE * AVG_COMMISSION);
    const todayRevenue = Math.round(todayClicks * AVG_CONVERSION * AVG_PRICE * AVG_COMMISSION);
    const weekRevenue = Math.round(weekClicks * AVG_CONVERSION * AVG_PRICE * AVG_COMMISSION);

    res.json({
      totalClicks: entries.length,
      todayClicks,
      yesterdayClicks,
      weekClicks,
      period: `${days}일`,
      byPlatform,
      bySource,
      byDay,
      byHour,
      topProducts,
      previousPeriod: {
        weekClicks: prevWeekClicks,
        weekChange: prevWeekClicks > 0 ? Math.round(((weekClicks - prevWeekClicks) / prevWeekClicks) * 100) : 0,
        todayVsYesterday: yesterdayClicks > 0 ? Math.round(((todayClicks - yesterdayClicks) / yesterdayClicks) * 100) : 0,
      },
      estimatedRevenue: {
        total: estimatedRevenue,
        today: todayRevenue,
        week: weekRevenue,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
