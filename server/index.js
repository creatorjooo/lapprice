const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { getCachedResult, setCachedResult, withTimeout } = require('./utils/helpers');
const { syncAll, ensureDirectories, healAllImages } = require('./services/productSync');
const { verifyAllOffers, ensureVerificationStorage, batchConvertDeeplinks } = require('./services/offerVerification');
let ensureTrackedStorage = () => {};
let refreshAllTrackedProducts = async () => ({ checked: 0, updated: 0, changed: 0 });
try {
  ({ ensureTrackedStorage, refreshAllTrackedProducts } = require('./services/trackedProducts'));
} catch {
  // tracked-products 모듈이 없는 배포에서도 서버는 계속 동작
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3001;
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '300', 10);
const API_BASE_URL = process.env.API_BASE_URL || `http://127.0.0.1:${PORT}`;

// ─── 자동 수집 상품 카탈로그 API ───
app.use('/api/products', require('./routes/products'));

// ─── 어필리에이트 & 트래킹 라우트 ───
app.use('/api/affiliate', require('./routes/affiliate'));
app.use('/api/track', require('./routes/track'));

// ─── 관리자 & 뉴스레터 라우트 ───
app.use('/api/admin', require('./routes/admin'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/offers', require('./routes/offers'));
try {
  app.use('/api/tracked-products', require('./routes/trackedProducts'));
} catch {
  // tracked-products 라우트가 없는 경우 스킵
}
app.use('/api/image-proxy', require('./routes/imageProxy'));
app.use('/r', require('./routes/redirect'));

// ─── 개별 플랫폼 라우트 ───
app.use('/api/naver', require('./routes/naver'));
app.use('/api/coupang', require('./routes/coupang'));
app.use('/api/11st', require('./routes/11st'));
app.use('/api/gmarket', require('./routes/gmarket'));
app.use('/api/auction', require('./routes/auction'));
app.use('/api/danawa', require('./routes/danawa'));
app.use('/api/ennuri', require('./routes/ennuri'));
app.use('/api/ssg', require('./routes/ssg'));
app.use('/api/lotteon', require('./routes/lotteon'));
app.use('/api/interpark', require('./routes/interpark'));

// ─── 통합 검색 엔드포인트: 10개 플랫폼 동시 호출 ───
app.get('/api/search', async (req, res) => {
  const { query, type, limit } = req.query;
  if (!query) {
    return res.status(400).json({ error: '검색어(query)가 필요합니다.' });
  }

  // 제품 타입에 따라 검색어에 키워드 추가
  let searchQuery = query;
  if (type === 'monitor') searchQuery = `모니터 ${query}`;
  else if (type === 'desktop') searchQuery = `데스크탑 ${query}`;
  else if (type === 'laptop') searchQuery = `노트북 ${query}`;

  const parsedLimit = Math.max(5, Math.min(100, parseInt(limit || '20', 10) || 20));
  const cacheKey = `unified:${type || 'all'}:${query}:${parsedLimit}`;
  const cached = getCachedResult(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const q = encodeURIComponent(searchQuery);
  const platformFetchers = [
    { source: 'naver', fn: () => fetchPlatform(`${API_BASE_URL}/api/naver?query=${q}&display=${parsedLimit}`) },
    { source: 'coupang', fn: () => fetchPlatform(`${API_BASE_URL}/api/coupang?keyword=${q}&limit=${parsedLimit}`) },
    { source: '11st', fn: () => fetchPlatform(`${API_BASE_URL}/api/11st?keyword=${q}&pageSize=${parsedLimit}`) },
    { source: 'gmarket', fn: () => fetchPlatform(`${API_BASE_URL}/api/gmarket?keyword=${q}&limit=${parsedLimit}`) },
    { source: 'auction', fn: () => fetchPlatform(`${API_BASE_URL}/api/auction?keyword=${q}&limit=${parsedLimit}`) },
    { source: 'danawa', fn: () => fetchPlatform(`${API_BASE_URL}/api/danawa?query=${q}&limit=${parsedLimit}`) },
    { source: 'ennuri', fn: () => fetchPlatform(`${API_BASE_URL}/api/ennuri?keyword=${q}&limit=${parsedLimit}`) },
    { source: 'ssg', fn: () => fetchPlatform(`${API_BASE_URL}/api/ssg?query=${q}&limit=${parsedLimit}`) },
    { source: 'lotteon', fn: () => fetchPlatform(`${API_BASE_URL}/api/lotteon?q=${q}&limit=${parsedLimit}`) },
    { source: 'interpark', fn: () => fetchPlatform(`${API_BASE_URL}/api/interpark?q=${q}&limit=${parsedLimit}`) },
  ];

  const results = await Promise.allSettled(
    platformFetchers.map(({ source, fn }) =>
      withTimeout(fn(), 10000).then((data) => ({ source, ...data })).catch((err) => ({
        source,
        available: false,
        products: [],
        error: err.message,
      }))
    )
  );

  const response = results.map((r) => {
    if (r.status === 'fulfilled') return r.value;
    return { source: 'unknown', available: false, products: [], error: r.reason?.message };
  });

  setCachedResult(cacheKey, response, CACHE_TTL);
  res.json(response);
});

async function fetchPlatform(url) {
  const resp = await fetch(url);
  return resp.json();
}

// ─── 프로덕션: 정적 파일 서빙 ───
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

// ─── 서버 시작 ───
app.listen(PORT, () => {
  console.log(`✅ LapPrice API 서버 실행 중: http://localhost:${PORT}`);
  console.log(`📡 연동 플랫폼: 네이버, 쿠팡, 11번가, G마켓, 옥션, 다나와, 에누리, SSG, 롯데ON, 인터파크`);

  // API 키 상태 출력
  const apis = [
    { name: '네이버', key: process.env.NAVER_CLIENT_ID },
    { name: '쿠팡', key: process.env.COUPANG_ACCESS_KEY },
    { name: '11번가', key: process.env.ELEVENTH_ST_API_KEY },
  ];
  apis.forEach(({ name, key }) => {
    console.log(`  ${key ? '✅' : '⬜'} ${name} API: ${key ? '활성' : '키 미설정 (스킵)'}`);
  });
  console.log(`  ✅ G마켓, 옥션, 다나와, 에누리, SSG, 롯데ON, 인터파크: 크롤링 (키 불필요)`);

  // 어필리에이트 상태 출력
  const affiliateEnabled = process.env.AFFILIATE_ENABLED !== 'false';
  console.log(`\n💰 어필리에이트 수익화:`);
  console.log(`  ${affiliateEnabled ? '✅' : '⬜'} 어필리에이트: ${affiliateEnabled ? '활성' : '비활성'}`);
  console.log(`  ${process.env.COUPANG_ACCESS_KEY ? '✅' : '⬜'} 쿠팡 파트너스 Deeplink API: ${process.env.COUPANG_ACCESS_KEY ? '활성' : '키 미설정'}`);
  console.log(`  📊 클릭 트래킹: 활성 (${process.env.CLICK_LOG_PATH || 'server/logs/clicks.jsonl'})`);
  console.log(`  📋 SubID 프리픽스: ${process.env.COUPANG_AFFILIATE_SUBID_PREFIX || 'lapprice'}`);
  console.log(`\n🔐 관리자 패널: http://localhost:${PORT}/#admin`);
  console.log(`  비밀번호: ${process.env.ADMIN_PASSWORD ? '설정됨 (.env)' : 'lapprice2026admin (기본값)'}`);
  console.log(`📧 뉴스레터 API: /api/newsletter`);
  console.log(`📦 상품 카탈로그 API: /api/products?type=laptop|monitor|desktop`);

  // ─── 자동 동기화 스케줄러 ───
  const SYNC_INTERVAL_HOURS = parseInt(process.env.SYNC_INTERVAL_HOURS || '24', 10);
  const SYNC_ENABLED = process.env.AUTO_SYNC_ENABLED !== 'false';

  ensureDirectories();
  ensureTrackedStorage();
  ensureVerificationStorage();

  if (SYNC_ENABLED) {
    // 서버 시작 30초 후 첫 동기화 (API가 완전히 준비된 후)
    console.log(`\n🔄 자동 동기화: 활성 (${SYNC_INTERVAL_HOURS}시간마다)`);
    setTimeout(async () => {
      try {
        console.log('🔄 [초기 동기화] 시작...');
        await syncAll();
        // 동기화 후 이미지 자동 보충
        console.log('🖼️ [이미지 보충] 시작...');
        const healResults = await healAllImages();
        healResults.forEach(r => {
          if (r.updated > 0) console.log(`  🖼️ ${r.productType}: ${r.updated}개 이미지 보충`);
        });
        console.log('✅ [가격 검증] 시작...');
        const verificationSummaries = await verifyAllOffers({ trigger: 'batch', force: true });
        verificationSummaries.forEach((summary) => {
          console.log(`  🔎 ${summary.productType}: 검증 ${summary.attempted}건, 성공 ${summary.verified}, 실패 ${summary.failed}`);
        });
        console.log('🔗 [딥링크 배치] 시작...');
        const dlResult = await batchConvertDeeplinks();
        if (dlResult.converted > 0 || dlResult.failed > 0) {
          console.log(`  🔗 딥링크: 변환 ${dlResult.converted}개, 실패 ${dlResult.failed}개`);
        }
        const trackedResults = await refreshAllTrackedProducts(API_BASE_URL);
        if (trackedResults.checked > 0) {
          console.log(`📈 [추적 상품] 점검 ${trackedResults.checked}개 · 갱신 ${trackedResults.updated}개 · 변동 ${trackedResults.changed}개`);
        }
      } catch (err) {
        console.error('❌ [초기 동기화] 실패:', err.message);
      }
    }, 30 * 1000);

    // 주기적 동기화
    setInterval(async () => {
      try {
        await syncAll();
        // 동기화 후 이미지 자동 보충
        await healAllImages();
        await verifyAllOffers({ trigger: 'batch', force: true });
        await batchConvertDeeplinks();
        await refreshAllTrackedProducts(API_BASE_URL);
      } catch (err) {
        console.error('❌ [주기 동기화] 실패:', err.message);
      }
    }, SYNC_INTERVAL_HOURS * 60 * 60 * 1000);
  } else {
    console.log(`\n🔄 자동 동기화: 비활성 (AUTO_SYNC_ENABLED=false)`);
  }
});
