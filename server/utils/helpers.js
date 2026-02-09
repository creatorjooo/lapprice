/**
 * 공통 유틸리티 함수
 */

// HTML 태그 제거 (네이버 API 등에서 <b> 태그 포함된 응답 처리)
function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

// 가격 문자열을 숫자로 변환: "1,590,000원" -> 1590000
function parsePrice(str) {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

// 딜레이 (크롤링 간 대기)
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 랜덤 User-Agent (크롤링 차단 방지)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// 타임아웃 래퍼 (플랫폼별 최대 대기 시간)
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// 인메모리 캐시 (동일 검색어 일정 시간 캐싱)
const cache = new Map();

function getCachedResult(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedResult(key, data, ttlSeconds = 300) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  // 캐시 사이즈 제한 (최대 500개)
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

// 공통 fetch 헬퍼 (User-Agent 포함)
async function fetchWithUA(url, options = {}) {
  const headers = {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers });
  return response;
}

module.exports = {
  stripHtml,
  parsePrice,
  delay,
  getRandomUserAgent,
  withTimeout,
  getCachedResult,
  setCachedResult,
  fetchWithUA,
};
