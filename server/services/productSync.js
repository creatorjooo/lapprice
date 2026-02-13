/**
 * 상품 자동 동기화 서비스
 * 
 * 역할:
 * 1. 네이버 쇼핑 API에서 카테고리별 인기 상품을 주기적으로 수집
 * 2. 수집된 상품의 가격을 실시간으로 업데이트
 * 3. 신제품 자동 추가
 * 4. 가격 변동 히스토리 기록
 * 5. 쿠팡 어필리에이트 링크 자동 생성
 * 
 * 흐름: 네이버API → 정규화 → JSON 카탈로그 저장 → 프론트엔드 API 서빙
 */

const fs = require('fs');
const path = require('path');
const { stripHtml, delay, withTimeout } = require('../utils/helpers');
const { cacheImageFromUrl, isImageCacheEnabled } = require('./imageCache');

const AFFILIATE_LINKS_PATH = path.join(__dirname, '..', 'config', 'affiliate-links.json');

const CATALOG_DIR = path.join(__dirname, '..', 'data', 'catalog');
const PRICE_HISTORY_DIR = path.join(__dirname, '..', 'data', 'catalog', 'history');
const PLATFORM_KEYS = ['naver', 'coupang', '11st', 'gmarket', 'auction', 'danawa', 'ennuri', 'ssg', 'lotteon', 'interpark'];
const PLATFORM_LABELS = {
  naver: '네이버',
  coupang: '쿠팡',
  '11st': '11번가',
  gmarket: 'G마켓',
  auction: '옥션',
  danawa: '다나와',
  ennuri: '에누리',
  ssg: 'SSG닷컴',
  lotteon: '롯데ON',
  interpark: '인터파크',
};
const ENABLE_ALL_PLATFORM_ENRICH = process.env.ENABLE_ALL_PLATFORM_ENRICH !== 'false';
const PLATFORM_ENRICH_TIMEOUT_MS = Math.max(3000, parseInt(process.env.PLATFORM_ENRICH_TIMEOUT_MS || '12000', 10) || 12000);
const PLATFORM_ENRICH_RESULT_LIMIT = Math.max(5, Math.min(30, parseInt(process.env.PLATFORM_ENRICH_RESULT_LIMIT || '12', 10) || 12));
const PLATFORM_MATCH_SCORE_THRESHOLD = Math.max(0, Math.min(100, parseInt(process.env.PLATFORM_MATCH_SCORE_THRESHOLD || '45', 10) || 45));
const PLATFORM_STORES_PER_SOURCE = Math.max(1, Math.min(3, parseInt(process.env.PLATFORM_STORES_PER_SOURCE || '2', 10) || 2));
const PLATFORM_ENRICH_CONCURRENCY = Math.max(1, Math.min(8, parseInt(process.env.PLATFORM_ENRICH_CONCURRENCY || '3', 10) || 3));
const NAVER_FETCH_TIMEOUT_MS = Math.max(3000, parseInt(process.env.NAVER_FETCH_TIMEOUT_MS || '12000', 10) || 12000);

// 카테고리별 검색 키워드 (네이버 쇼핑 API용)
const SEARCH_QUERIES = {
  laptop: [
    { query: '게이밍 노트북', category: 'gaming', display: 30 },
    { query: '울트라북 노트북', category: 'ultrabook', display: 20 },
    { query: '비즈니스 노트북', category: 'business', display: 20 },
    { query: '영상편집 노트북', category: 'creator', display: 20 },
    { query: '가성비 노트북', category: 'budget', display: 20 },
    { query: '맥북', category: 'apple', display: 15 },
    { query: '노트북 신제품 2025', category: 'budget', display: 15 },
    { query: '노트북 신제품 2026', category: 'budget', display: 15 },
  ],
  monitor: [
    { query: '게이밍 모니터 144hz', category: 'gaming', display: 25 },
    { query: '4K 모니터', category: 'professional', display: 20 },
    { query: '울트라와이드 모니터', category: 'ultrawide', display: 15 },
    { query: 'OLED 모니터', category: 'gaming', display: 15 },
    { query: '가성비 모니터 IPS', category: 'general', display: 20 },
    { query: 'USB-C 모니터', category: 'professional', display: 15 },
  ],
  desktop: [
    { query: '게이밍 데스크탑 PC', category: 'gaming', display: 25 },
    { query: '미니PC', category: 'minipc', display: 20 },
    { query: '맥미니 M4', category: 'mac', display: 15 },
    { query: 'iMac', category: 'mac', display: 12 },
    { query: '맥 스튜디오', category: 'mac', display: 10 },
    { query: '올인원 PC', category: 'allinone', display: 15 },
    { query: '사무용 데스크탑', category: 'office', display: 15 },
    { query: '조립 PC 완제품', category: 'gaming', display: 15 },
  ],
};

// 제품 타입별 가격 범위 (노이즈 필터링)
const PRICE_RANGES = {
  laptop: { min: 300000, max: 8000000 },
  monitor: { min: 80000, max: 5000000 },
  desktop: { min: 200000, max: 10000000 },
};

// 제외 키워드 (악세서리, 부품 등 필터링)
const EXCLUDE_KEYWORDS = [
  '케이스', '가방', '파우치', '스킨', '필름', '보호', '스탠드', '거치대',
  '키보드', '마우스', '충전기', '어댑터', '케이블', '허브', 'USB',
  '메모리', 'RAM', 'SSD', 'HDD', '하드디스크',
  '중고', '리퍼', '전시', '반품', '스크래치',
  '부품', '수리', '교체',
];

/**
 * 디렉토리 초기화
 */
function ensureDirectories() {
  [CATALOG_DIR, PRICE_HISTORY_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * 카탈로그 파일 읽기
 */
function loadCatalog(productType) {
  const filePath = path.join(CATALOG_DIR, `${productType}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const catalog = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(catalog.products)) {
        let touched = false;
        for (const product of catalog.products) {
          if (Array.isArray(product?.stores)) {
            for (const store of product.stores) {
              if (normalizeStoredStore(store)) {
                touched = true;
              }
            }
          }
          const before = Number(product?.prices?.current) || 0;
          syncPriceFromStores(product);
          if ((Number(product?.prices?.current) || 0) !== before) {
            touched = true;
          }
        }
        // 과거 데이터 정합성 자동 보정
        if (touched) {
          fs.writeFileSync(filePath, JSON.stringify(catalog, null, 2), 'utf-8');
        }
      }
      return catalog;
    }
  } catch (err) {
    console.error(`[ProductSync] 카탈로그 로드 오류 (${productType}):`, err.message);
  }
  return { products: [], lastSync: null, syncCount: 0 };
}

/**
 * 카탈로그 파일 저장
 */
function saveCatalog(productType, catalogData) {
  const filePath = path.join(CATALOG_DIR, `${productType}.json`);
  fs.writeFileSync(filePath, JSON.stringify(catalogData, null, 2), 'utf-8');
}

/**
 * 가격 히스토리 기록
 */
function recordPriceHistory(productId, price, store) {
  const today = new Date().toISOString().split('T')[0];
  const filePath = path.join(PRICE_HISTORY_DIR, `${productId}.json`);

  let history = [];
  try {
    if (fs.existsSync(filePath)) {
      history = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* ignore */ }

  // 오늘 날짜에 이미 기록이 있으면 가격이 변동된 경우만 업데이트
  const todayEntry = history.find(h => h.date === today);
  if (todayEntry) {
    if (todayEntry.price !== price) {
      todayEntry.price = price;
      todayEntry.store = store;
    } else {
      return; // 변동 없으면 스킵
    }
  } else {
    history.push({ date: today, price, store });
  }

  // 최대 365일치 보관
  if (history.length > 365) {
    history = history.slice(-365);
  }

  fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf-8');
}

/**
 * 가격 히스토리 조회
 */
function getPriceHistory(productId) {
  const filePath = path.join(PRICE_HISTORY_DIR, `${productId}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

/**
 * 실사용 가능한 상품 이미지 URL인지 검증
 */
function isUsableProductImage(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http')) return false;
  const lower = trimmed.toLowerCase();
  if (lower.includes('placehold.co')) return false;
  if (lower.includes('placeholder')) return false;
  return true;
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim());
}

function normalizePlatformSource(source) {
  const key = String(source || '').trim().toLowerCase();
  if (PLATFORM_KEYS.includes(key)) return key;
  if (key === '11번가') return '11st';
  if (key === 'ssg닷컴') return 'ssg';
  return 'unknown';
}

function normalizeStoreName(value, source = 'unknown') {
  const text = String(value || '').trim();
  if (text) return text;
  return PLATFORM_LABELS[source] || '스토어';
}

function canonicalizeStoreUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/g, '');
    const searchParams = new URLSearchParams(parsed.search);
    [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'lptag', 'traceid', 'requestid', 'subid',
    ].forEach((key) => searchParams.delete(key));
    const query = searchParams.toString();
    return `${host}${pathname}${query ? `?${query}` : ''}`.toLowerCase();
  } catch {
    return raw
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/+$/g, '')
      .toLowerCase();
  }
}

function isLikelySearchStoreUrl(url) {
  const raw = String(url || '').trim();
  if (!isHttpUrl(raw)) return false;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const queryKeys = [...parsed.searchParams.keys()].map((key) => String(key || '').toLowerCase());

    if (queryKeys.some((key) => ['q', 'query', 'keyword', 'k', 'search', 'sort', 'page', 'pagingindex'].includes(key))) {
      return true;
    }

    if (host.includes('search.shopping.naver.com') && pathname.includes('/search/')) return true;
    if (host.endsWith('coupang.com') && pathname.startsWith('/np/search')) return true;
    if (host.endsWith('11st.co.kr') && pathname.includes('/search')) return true;
    if (host.endsWith('gmarket.co.kr') && (pathname.includes('/search') || pathname.includes('/n/list'))) return true;
    if (host.endsWith('auction.co.kr') && (pathname.includes('/search') || pathname.includes('/n/list'))) return true;
    if (host.endsWith('danawa.com') && pathname.includes('/search')) return true;
    if (host.endsWith('enuri.com') && pathname.includes('/search')) return true;
    if (host.endsWith('ssg.com') && pathname.includes('/search')) return true;
    if (host.endsWith('lotteon.com') && pathname.includes('/search')) return true;
    if (host.endsWith('interpark.com') && pathname.includes('/search')) return true;

    return false;
  } catch {
    return false;
  }
}

function getStoreUrlQuality(url) {
  if (!isHttpUrl(url)) return 'invalid';
  return isLikelySearchStoreUrl(url) ? 'search' : 'pdp';
}

function enrichStoreUrlMetadata(store) {
  if (!store || typeof store !== 'object') return false;
  let changed = false;

  const sourceUrl = isHttpUrl(store.sourceUrl)
    ? String(store.sourceUrl).trim()
    : (isHttpUrl(store.url) ? String(store.url).trim() : '');
  if ((store.sourceUrl || '') !== sourceUrl) {
    store.sourceUrl = sourceUrl;
    changed = true;
  }

  const sourceQuality = getStoreUrlQuality(sourceUrl);
  const pdpUrl = sourceQuality === 'pdp' ? sourceUrl : '';
  if ((store.pdpUrl || '') !== pdpUrl) {
    store.pdpUrl = pdpUrl;
    changed = true;
  }

  const canonicalUrl = canonicalizeStoreUrl(pdpUrl || sourceUrl);
  if ((store.canonicalUrl || '') !== canonicalUrl) {
    store.canonicalUrl = canonicalUrl;
    changed = true;
  }

  const isPdpUrl = !!pdpUrl;
  if (Boolean(store.isPdpUrl) !== isPdpUrl) {
    store.isPdpUrl = isPdpUrl;
    changed = true;
  }

  const urlQuality = sourceQuality;
  if ((store.urlQuality || '') !== urlQuality) {
    store.urlQuality = urlQuality;
    changed = true;
  }

  return changed;
}

function normalizeComparisonText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeComparisonText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function tokenOverlapRatio(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  return intersection / Math.max(setA.size, setB.size);
}

function computeMatchScore(product, candidateTitle) {
  const seed = `${product.name || ''} ${product.model || ''}`.trim();
  const normalizedSeed = normalizeForComparison(seed);
  const normalizedTitle = normalizeForComparison(candidateTitle);
  const jaccard = similarity(normalizedSeed, normalizedTitle);
  const overlap = tokenOverlapRatio(seed, candidateTitle);
  const brand = String(product.brand || '').trim();
  const brandBonus = brand && normalizeComparisonText(candidateTitle).includes(normalizeComparisonText(brand)) ? 0.08 : 0;
  const weighted = (jaccard * 0.65) + (overlap * 0.35) + brandBonus;
  return Math.max(0, Math.min(100, Math.round(weighted * 100)));
}

function getInternalApiBaseUrl() {
  if (process.env.INTERNAL_API_BASE_URL) {
    return String(process.env.INTERNAL_API_BASE_URL).replace(/\/+$/g, '');
  }
  const apiBase = String(process.env.API_BASE_URL || '').trim();
  if (apiBase) {
    return apiBase.replace(/\/+$/g, '');
  }
  const port = process.env.PORT || '3001';
  return `http://127.0.0.1:${port}`;
}

async function fetchWithTimeout(url, timeoutMs = PLATFORM_ENRICH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllPlatformSearchResults(productType, query) {
  if (!ENABLE_ALL_PLATFORM_ENRICH) return [];
  const safeQuery = String(query || '').trim();
  if (!safeQuery) return [];

  const baseUrl = getInternalApiBaseUrl();
  const targetUrl = `${baseUrl}/api/search?query=${encodeURIComponent(safeQuery)}&type=${encodeURIComponent(productType)}&limit=${PLATFORM_ENRICH_RESULT_LIMIT}`;
  try {
    const response = await fetchWithTimeout(targetUrl);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`[ProductSync] 플랫폼 통합 검색 실패 (${productType}/${safeQuery}):`, err.message);
    return [];
  }
}

function buildStoreFromCandidate(source, candidate, product) {
  const price = parseInt(String(candidate?.price || '').replace(/[^0-9]/g, ''), 10) || 0;
  if (price <= 0) return null;
  if (!isHttpUrl(candidate?.link)) return null;

  const sourceKey = normalizePlatformSource(source);
  const title = stripHtml(candidate?.title || '');
  const matchScore = computeMatchScore(product, title);
  if (matchScore < PLATFORM_MATCH_SCORE_THRESHOLD) return null;

  const storeName = normalizeStoreName(candidate?.mallName, sourceKey);
  const nowIso = new Date().toISOString();
  const mappedStore = {
    store: storeName,
    storeLogo: getStoreLogo(storeName),
    source: sourceKey,
    collectedAt: nowIso,
    matchScore,
    price,
    rawPrice: price,
    shipping: 0,
    deliveryDays: '2~3일',
    updatedAt: getStoreUpdatedAt(),
    url: candidate.link,
    sourceUrl: candidate.link,
    isLowest: false,
    verificationStatus: 'stale',
    verificationMethod: 'fallback',
    verifiedPrice: 0,
    verifiedAt: null,
  };
  enrichStoreUrlMetadata(mappedStore);
  return mappedStore;
}

function dedupeStores(stores) {
  const byKey = new Map();
  const urlQualityRank = { pdp: 2, search: 1, invalid: 0 };

  for (const store of stores) {
    enrichStoreUrlMetadata(store);
    const normalizedStoreName = normalizeStoreName(store?.store, normalizePlatformSource(store?.source)).toLowerCase();
    const canonicalUrl = String(store?.canonicalUrl || canonicalizeStoreUrl(store?.sourceUrl || store?.url));
    const key = `${normalizedStoreName}::${canonicalUrl || String(store?.source || 'unknown')}`;
    const previous = byKey.get(key);

    if (!previous) {
      byKey.set(key, store);
      continue;
    }

    const prevScore = Number(previous.matchScore) || 0;
    const nextScore = Number(store.matchScore) || 0;
    const prevPrice = Number(previous.price) || Number.MAX_SAFE_INTEGER;
    const nextPrice = Number(store.price) || Number.MAX_SAFE_INTEGER;
    const prevQuality = urlQualityRank[String(previous.urlQuality || 'invalid')] ?? 0;
    const nextQuality = urlQualityRank[String(store.urlQuality || 'invalid')] ?? 0;

    if (
      nextQuality > prevQuality
      || (nextQuality === prevQuality && nextScore > prevScore)
      || (nextQuality === prevQuality && nextScore === prevScore && nextPrice < prevPrice)
    ) {
      byKey.set(key, { ...previous, ...store });
    }
  }

  return Array.from(byKey.values());
}

function sortStoresByPriceAndScore(stores) {
  stores.sort((a, b) => {
    const priceDiff = (Number(a?.price) || 0) - (Number(b?.price) || 0);
    if (priceDiff !== 0) return priceDiff;
    return (Number(b?.matchScore) || 0) - (Number(a?.matchScore) || 0);
  });
}

async function enrichStoresFromAllPlatforms(productType, product) {
  if (!ENABLE_ALL_PLATFORM_ENRICH || !product) return 0;

  const searchQuery = `${product.brand || ''} ${product.name || product.model || ''}`.trim();
  if (!searchQuery) return 0;

  const platformResults = await fetchAllPlatformSearchResults(productType, searchQuery);
  if (!Array.isArray(platformResults) || platformResults.length === 0) return 0;

  const candidateStores = [];
  const priceRange = PRICE_RANGES[productType];

  for (const platformResult of platformResults) {
    const source = normalizePlatformSource(platformResult?.source);
    if (source === 'unknown') continue;

    const products = Array.isArray(platformResult?.products) ? platformResult.products : [];
    const storesForSource = [];

    for (const candidate of products) {
      const mapped = buildStoreFromCandidate(source, candidate, product);
      if (!mapped) continue;
      if (mapped.price < priceRange.min || mapped.price > priceRange.max) continue;
      storesForSource.push(mapped);
    }

    sortStoresByPriceAndScore(storesForSource);
    candidateStores.push(...storesForSource.slice(0, PLATFORM_STORES_PER_SOURCE));
  }

  if (candidateStores.length === 0) return 0;

  const beforeCount = Array.isArray(product.stores) ? product.stores.length : 0;
  const merged = dedupeStores([...(Array.isArray(product.stores) ? product.stores : []), ...candidateStores]);
  sortStoresByPriceAndScore(merged);
  merged.forEach((store, index) => {
    store.isLowest = index === 0;
  });

  product.stores = merged;
  syncPriceFromStores(product);

  return Math.max(0, merged.length - beforeCount);
}

async function processWithConcurrency(items, concurrency, worker) {
  const poolSize = Math.max(1, Math.min(concurrency, items.length || 1));
  const queue = [...items];
  const workers = Array.from({ length: poolSize }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function enrichCatalogStoresFromAllPlatforms(productType, products) {
  if (!ENABLE_ALL_PLATFORM_ENRICH || !Array.isArray(products) || products.length === 0) {
    return { checked: 0, enrichedProducts: 0, addedStores: 0 };
  }

  let checked = 0;
  let enrichedProducts = 0;
  let addedStores = 0;

  await processWithConcurrency(products, PLATFORM_ENRICH_CONCURRENCY, async (product) => {
    checked += 1;
    try {
      const added = await enrichStoresFromAllPlatforms(productType, product);
      if (added > 0) {
        enrichedProducts += 1;
        addedStores += added;
      }
    } catch (err) {
      console.error(`[ProductSync] 스토어 확장 실패 (${productType}/${product?.name || 'unknown'}):`, err.message);
    }
    await delay(80);
  });

  return { checked, enrichedProducts, addedStores };
}

function isCachedImageUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  const publicBase = String(process.env.IMAGE_CACHE_PUBLIC_BASE_URL || '').trim().replace(/\/+$/g, '');
  if (publicBase && value.startsWith(publicBase)) return true;
  if (process.env.IMAGE_CACHE_S3_BUCKET && value.includes(process.env.IMAGE_CACHE_S3_BUCKET)) return true;
  return false;
}

async function cachePrimaryProductImage(product, prefix) {
  if (!isImageCacheEnabled()) return false;
  if (!product || !Array.isArray(product.images) || product.images.length === 0) return false;

  const primary = String(product.images[0] || '').trim();
  if (!isUsableProductImage(primary) || isCachedImageUrl(primary)) return false;

  const result = await cacheImageFromUrl(primary, { prefix });
  if (!result.ok || !isUsableProductImage(result.url)) {
    return false;
  }

  product.images[0] = result.url;
  return true;
}

async function cacheProductImages(products, productType) {
  if (!isImageCacheEnabled() || !Array.isArray(products) || products.length === 0) {
    return { checked: 0, cached: 0 };
  }

  let checked = 0;
  let cached = 0;
  await processWithConcurrency(products, Math.min(4, PLATFORM_ENRICH_CONCURRENCY), async (product) => {
    checked += 1;
    try {
      const ok = await cachePrimaryProductImage(product, `${productType}/thumb`);
      if (ok) cached += 1;
    } catch {
      // ignore cache failures per item
    }
  });

  return { checked, cached };
}

/**
 * 네이버 API에서 상품 검색
 */
async function fetchFromNaver(query, display = 20) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return [];
  }

  try {
    const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=${display}&sort=sim`;
    const response = await withTimeout(fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    }), NAVER_FETCH_TIMEOUT_MS);

    if (!response.ok) {
      console.error(`[ProductSync] 네이버 API 오류: ${response.status} for "${query}"`);
      return [];
    }

    const data = await response.json();
    return data.items || [];
  } catch (err) {
    console.error(`[ProductSync] 네이버 API 요청 실패 (${query}):`, err.message);
    return [];
  }
}

/**
 * 악세서리/부품 등 제외 필터
 */
function isValidProduct(title, productType) {
  const titleLower = title.toLowerCase();
  
  // 제외 키워드 체크
  for (const keyword of EXCLUDE_KEYWORDS) {
    if (titleLower.includes(keyword.toLowerCase())) {
      return false;
    }
  }

  // 제품 타입별 필수 키워드 (최소 하나 포함해야 함)
  const requiredAny = {
    laptop: ['노트북', 'laptop', '맥북', 'macbook', '그램', 'gram', '갤럭시북', 'thinkpad', '씽크패드', 'zenbook', '제니스', 'ideapad', 'victus', 'omen', 'nitro', 'tuf'],
    monitor: ['모니터', 'monitor', '디스플레이', 'display'],
    desktop: ['데스크탑', 'desktop', '미니pc', 'pc', '컴퓨터', 'mac mini', '맥미니', 'imac', '아이맥', '조립', '완제품'],
  };

  const required = requiredAny[productType] || [];
  if (required.length > 0) {
    return required.some(kw => titleLower.includes(kw.toLowerCase()));
  }
  return true;
}

/**
 * 네이버 API 상품을 우리 형식으로 정규화
 */
function normalizeNaverProduct(item, productType, category) {
  const title = stripHtml(item.title);
  const price = parseInt(item.lprice, 10) || 0;
  const originalPrice = parseInt(item.hprice, 10) || price;

  // 고유 ID 생성 (productType + 네이버 상품 ID 또는 타이틀 해시)
  const naverProductId = item.productId || item.link?.match(/pid=(\d+)/)?.[1] || '';
  const id = `auto_${productType[0]}${naverProductId || hashString(title)}`;

  const discount = originalPrice > price
    ? { percent: Math.round(((originalPrice - price) / originalPrice) * 100), amount: originalPrice - price }
    : { percent: 0, amount: 0 };

  const normalizedImage = isUsableProductImage(item.image) ? item.image : '';

  return {
    id,
    productType,
    brand: extractBrand(title, productType),
    name: cleanProductName(title),
    model: title,
    category,
    prices: {
      original: originalPrice > price ? originalPrice : price,
      current: price,
      lowest: price, // 최초 수집 시 현재가 = 최저가
      average: price,
    },
    discount,
    priceIndex: 85, // 초기값, 추후 히스토리 기반 계산
    stores: [
      {
        store: item.mallName || '네이버쇼핑',
        storeLogo: getStoreLogo(item.mallName),
        source: 'naver',
        collectedAt: new Date().toISOString(),
        matchScore: 100,
        price,
        rawPrice: price,
        shipping: 0,
        deliveryDays: '2~3일',
        updatedAt: getStoreUpdatedAt(),
        url: item.link || '',
        sourceUrl: item.link || '',
        pdpUrl: getStoreUrlQuality(item.link || '') === 'pdp' ? (item.link || '') : '',
        canonicalUrl: canonicalizeStoreUrl(item.link || ''),
        isPdpUrl: getStoreUrlQuality(item.link || '') === 'pdp',
        urlQuality: getStoreUrlQuality(item.link || ''),
        isLowest: true,
      },
    ],
    rating: { score: 4.5, count: 0 },
    reviews: [],
    stock: 'in',
    isNew: false,
    isHot: discount.percent >= 15,
    releaseDate: new Date().toISOString().slice(0, 7),
    images: [normalizedImage],
    tags: extractTags(title, productType),
    editorScore: undefined,
    editorPick: undefined,
    editorComment: undefined,
    pros: undefined,
    cons: undefined,
    bestFor: undefined,
    // 메타데이터
    _source: 'naver',
    _naverProductId: naverProductId,
    _lastUpdated: new Date().toISOString(),
    _autoGenerated: true,
  };
}

/**
 * 기존 상품과 병합 (가격 업데이트, 신제품 추가)
 */
function mergeProducts(existingProducts, newProducts) {
  const productMap = new Map();

  // 기존 상품 로드
  for (const p of existingProducts) {
    productMap.set(p.id, p);
  }

  let addedCount = 0;
  let updatedCount = 0;

  for (const newP of newProducts) {
    // 이미 존재하는 상품인지 확인 (ID 또는 이름 유사도)
    const existing = productMap.get(newP.id) || findSimilarProduct(productMap, newP.name);

    if (existing) {
      // 기존 상품: 가격 업데이트
      const oldPrice = existing.prices.current;
      const newPrice = newP.prices.current;
      const incomingStoreName = newP.stores[0]?.store || '평균';
      let changed = false;

      if (newPrice > 0 && newPrice !== oldPrice) {
        existing.prices.current = newPrice;
        existing.prices.lowest = Math.min(existing.prices.lowest, newPrice);
        
        // 평균가 갱신 (이동 평균)
        existing.prices.average = Math.round((existing.prices.average * 0.8) + (newPrice * 0.2));
        
        // 할인율 재계산
        if (existing.prices.original > newPrice) {
          existing.discount = {
            percent: Math.round(((existing.prices.original - newPrice) / existing.prices.original) * 100),
            amount: existing.prices.original - newPrice,
          };
        }

        // 가격지수 재계산
        existing.priceIndex = calculatePriceIndex(newPrice, existing.prices.lowest, existing.prices.average);
        
        // HOT 상태 업데이트
        existing.isHot = existing.discount.percent >= 15 || existing.priceIndex >= 90;

        existing._lastUpdated = new Date().toISOString();
        changed = true;
      }

      // 이미지 자동 갱신: 기존 이미지가 없거나 로컬 경로(/로 시작)면 API 이미지로 교체
      if (isUsableProductImage(newP.images?.[0])) {
        const existingImg = existing.images?.[0] || '';
        if (!isUsableProductImage(existingImg)) {
          existing.images = newP.images;
          console.log(`[ProductSync] 이미지 업데이트: ${existing.name} → ${newP.images[0].substring(0, 60)}...`);
        }
      }

      // 스토어 정보 업데이트/추가
      mergeStores(existing, newP);
      // 대표가를 스토어 최저가 기준으로 동기화
      syncPriceFromStores(existing);

      // 스토어 병합으로 최저가가 바뀔 수 있으므로 최종 current를 기준으로 히스토리 기록
      if (existing.prices.current > 0 && existing.prices.current !== oldPrice) {
        changed = true;
        const lowestStore = findLowestStore(existing.stores);
        recordPriceHistory(existing.id, existing.prices.current, lowestStore?.store || incomingStoreName);
      }
      if (changed) {
        updatedCount++;
      }
    } else {
      // 신제품 추가
      syncPriceFromStores(newP);
      newP.isNew = true;
      productMap.set(newP.id, newP);
      addedCount++;

      // 첫 가격 히스토리 기록
      recordPriceHistory(newP.id, newP.prices.current, newP.stores[0]?.store || '평균');
    }
  }

  const mergedProducts = Array.from(productMap.values());
  for (const product of mergedProducts) {
    if (!Array.isArray(product?.stores)) continue;
    for (const store of product.stores) {
      normalizeStoredStore(store);
    }
  }

  return {
    products: mergedProducts,
    addedCount,
    updatedCount,
  };
}

/**
 * 스토어 정보 병합
 */
function mergeStores(existing, newProduct) {
  const incomingStores = Array.isArray(newProduct?.stores) ? newProduct.stores : [];
  if (!Array.isArray(existing.stores)) {
    existing.stores = [];
  }

  if (incomingStores.length === 0) return;

  for (const newStoreRaw of incomingStores) {
    if (!newStoreRaw) continue;
    const newStore = { ...newStoreRaw };
    enrichStoreUrlMetadata(newStore);
    const canonicalNewUrl = newStore.canonicalUrl || canonicalizeStoreUrl(newStore.sourceUrl || newStore.url);
    const normalizedNewName = normalizeStoreName(newStore.store, normalizePlatformSource(newStore.source)).toLowerCase();

    const existingStore = existing.stores.find((store) => {
      enrichStoreUrlMetadata(store);
      const canonicalExistingUrl = store.canonicalUrl || canonicalizeStoreUrl(store.sourceUrl || store.url);
      const normalizedExistingName = normalizeStoreName(store.store, normalizePlatformSource(store.source)).toLowerCase();
      if (canonicalExistingUrl && canonicalNewUrl) {
        return canonicalExistingUrl === canonicalNewUrl;
      }
      return normalizedExistingName === normalizedNewName;
    });

    if (existingStore) {
      const merged = {
        ...existingStore,
        ...newStore,
        source: normalizePlatformSource(newStore.source || existingStore.source),
        store: normalizeStoreName(newStore.store || existingStore.store, normalizePlatformSource(newStore.source || existingStore.source)),
        storeLogo: newStore.storeLogo || existingStore.storeLogo || getStoreLogo(newStore.store || existingStore.store),
        price: Number(newStore.price) > 0 ? Number(newStore.price) : Number(existingStore.price) || 0,
        rawPrice: Number(newStore.rawPrice) > 0 ? Number(newStore.rawPrice) : Number(newStore.price) || Number(existingStore.rawPrice) || Number(existingStore.price) || 0,
        matchScore: Math.max(Number(existingStore.matchScore) || 0, Number(newStore.matchScore) || 0),
        collectedAt: newStore.collectedAt || existingStore.collectedAt || getStoreUpdatedAt(),
        updatedAt: getStoreUpdatedAt(),
      };
      Object.assign(existingStore, merged);
      enrichStoreUrlMetadata(existingStore);
    } else {
      const createdStore = {
        ...newStore,
        source: normalizePlatformSource(newStore.source),
        store: normalizeStoreName(newStore.store, normalizePlatformSource(newStore.source)),
        storeLogo: newStore.storeLogo || getStoreLogo(newStore.store),
        rawPrice: Number(newStore.rawPrice) > 0 ? Number(newStore.rawPrice) : Number(newStore.price) || 0,
        collectedAt: newStore.collectedAt || getStoreUpdatedAt(),
        updatedAt: newStore.updatedAt || getStoreUpdatedAt(),
        isLowest: false,
      };
      enrichStoreUrlMetadata(createdStore);
      existing.stores.push(createdStore);
    }
  }

  existing.stores = dedupeStores(existing.stores);
  sortStoresByPriceAndScore(existing.stores);
  const lowestStore = findLowestStore(existing.stores);
  existing.stores.forEach((store) => {
    store.isLowest = !!lowestStore && store === lowestStore;
  });
}

function findLowestStore(stores) {
  if (!Array.isArray(stores) || stores.length === 0) return null;
  const candidates = stores.filter((s) => Number(s?.price) > 0);
  if (candidates.length === 0) return null;
  return candidates.reduce((min, s) => (s.price < min.price ? s : min), candidates[0]);
}

/**
 * 제품 대표가(prices.current)를 스토어 최저가와 일치시킴
 */
function syncPriceFromStores(product) {
  if (!product || !Array.isArray(product.stores) || product.stores.length === 0) return;
  const lowestStore = findLowestStore(product.stores);
  if (!lowestStore) return;

  const current = lowestStore.price;
  product.prices.current = current;
  product.prices.lowest = product.prices.lowest > 0
    ? Math.min(product.prices.lowest, current)
    : current;
  product.prices.average = product.prices.average > 0
    ? product.prices.average
    : current;

  if (!product.prices.original || product.prices.original < current) {
    product.prices.original = current;
  }

  const discountAmount = Math.max(0, product.prices.original - current);
  const discountPercent = product.prices.original > 0
    ? Math.round((discountAmount / product.prices.original) * 100)
    : 0;

  product.discount = {
    percent: discountPercent,
    amount: discountAmount,
  };
  product.priceIndex = calculatePriceIndex(current, product.prices.lowest, product.prices.average);
}

/**
 * 유사 상품 찾기 (이름 기반 퍼지 매칭)
 */
function findSimilarProduct(productMap, newName) {
  const normalizedNew = normalizeForComparison(newName);
  for (const [, product] of productMap) {
    const normalizedExisting = normalizeForComparison(product.name);
    if (normalizedNew === normalizedExisting) return product;
    // 80% 이상 유사하면 같은 상품으로 판단
    if (similarity(normalizedNew, normalizedExisting) > 0.8) return product;
  }
  return null;
}

/**
 * 비교용 이름 정규화
 */
function normalizeForComparison(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '')
    .replace(/\s+/g, '');
}

/**
 * 문자열 유사도 (Jaccard 기반)
 */
function similarity(a, b) {
  if (a === b) return 1;
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * 가격 지수 계산 (0~100, 높을수록 좋은 가격)
 */
function calculatePriceIndex(current, lowest, average) {
  if (current <= lowest) return 100;
  if (average <= 0) return 50;
  
  const ratio = (average - current) / average;
  // -0.3 ~ +0.3 범위를 0~100으로 매핑
  const index = Math.round(50 + ratio * 150);
  return Math.max(0, Math.min(100, index));
}

/**
 * 브랜드 추출
 */
function extractBrand(title, productType) {
  const brands = {
    laptop: ['ASUS', 'MSI', 'HP', 'LG', '삼성', '레노버', '에이서', '기가바이트', '애플', '한성', '델', 'Lenovo', 'Acer', 'Dell', 'Apple', 'Samsung', 'Gigabyte'],
    monitor: ['LG', '삼성', 'ASUS', 'BenQ', '델', 'MSI', 'ViewSonic', 'Dell', 'Samsung', 'AOC', '필립스', 'Philips'],
    desktop: ['HP', '레노버', 'MSI', 'ASUS', '한성', '애플', '델', 'Lenovo', 'Dell', 'Apple', 'Samsung', '삼성'],
  };

  const titleLower = title.toLowerCase();
  for (const brand of (brands[productType] || [])) {
    if (titleLower.includes(brand.toLowerCase())) {
      // 한국어 브랜드명으로 통일
      const brandMap = {
        'asus': 'ASUS', 'msi': 'MSI', 'hp': 'HP', 'lg': 'LG전자',
        'samsung': '삼성전자', '삼성': '삼성전자', 'lenovo': '레노버', '레노버': '레노버',
        'acer': '에이서', 'dell': '델', 'apple': '애플', '애플': '애플',
        'gigabyte': '기가바이트', 'benq': 'BenQ', 'viewsonic': 'ViewSonic',
        '한성': '한성컴퓨터', 'aoc': 'AOC', 'philips': '필립스', '필립스': '필립스',
      };
      return brandMap[brand.toLowerCase()] || brand;
    }
  }
  return '기타';
}

/**
 * 상품명 정리
 */
function cleanProductName(title) {
  return title
    .replace(/\[.*?\]/g, '') // [특가] 등 제거
    .replace(/\(.*?\)/g, '') // (정품) 등 제거
    .replace(/무료배송/g, '')
    .replace(/당일발송/g, '')
    .replace(/공식판매점/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80); // 최대 80자
}

/**
 * 태그 추출
 */
function extractTags(title, productType) {
  const tags = [];
  const titleLower = title.toLowerCase();

  const tagKeywords = {
    laptop: {
      '게이밍': ['게이밍', 'gaming', 'rtx', 'gtx'],
      '울트라북': ['울트라', 'slim', '슬림', '경량'],
      '가성비': ['가성비', '입문'],
      'OLED': ['oled'],
      '신제품': ['2025', '2026', '신제품', 'new'],
    },
    monitor: {
      '게이밍': ['게이밍', 'gaming', '144hz', '165hz', '240hz'],
      '4K': ['4k', 'uhd', '3840'],
      'OLED': ['oled'],
      '울트라와이드': ['울트라와이드', 'ultrawide', '34인치', '49인치'],
      'USB-C': ['usb-c', 'usbc', 'type-c'],
      '커브드': ['커브드', 'curved', '곡면'],
    },
    desktop: {
      '게이밍': ['게이밍', 'gaming', 'rtx', 'gtx'],
      '미니PC': ['미니', 'mini', 'nuc', '소형'],
      '올인원': ['올인원', 'all-in-one', 'aio', 'imac'],
      '애플': ['mac', '맥', 'apple', '애플'],
    },
  };

  const typeKeywords = tagKeywords[productType] || {};
  for (const [tag, keywords] of Object.entries(typeKeywords)) {
    if (keywords.some(kw => titleLower.includes(kw))) {
      tags.push(tag);
    }
  }

  return tags.length > 0 ? tags : [productType];
}

/**
 * 스토어 로고
 */
function getStoreLogo(mallName) {
  const logos = {
    '쿠팡': '🛒',
    'G마켓': '🛍️',
    '11번가': '🏪',
    '옥션': '🏷️',
    '네이버': '🟢',
    '네이버쇼핑': '🟢',
    'SSG': '🔴',
    'SSG닷컴': '🔴',
    '롯데ON': '🟡',
    '다나와': '💻',
    '에누리': '🧾',
    '인터파크': '🎫',
  };
  return logos[mallName] || '🏪';
}

function getStoreUpdatedAt() {
  return new Date().toISOString();
}

function inferSourceFromStore(store) {
  const raw = String(store?.source || '').trim().toLowerCase();
  if (PLATFORM_KEYS.includes(raw)) return raw;

  const storeName = String(store?.store || '').toLowerCase();
  if (storeName.includes('쿠팡')) return 'coupang';
  if (storeName.includes('네이버')) return 'naver';
  if (storeName.includes('11')) return '11st';
  if (storeName.includes('g마켓') || storeName.includes('gmarket')) return 'gmarket';
  if (storeName.includes('옥션')) return 'auction';
  if (storeName.includes('다나와')) return 'danawa';
  if (storeName.includes('에누리')) return 'ennuri';
  if (storeName.includes('ssg')) return 'ssg';
  if (storeName.includes('롯데')) return 'lotteon';
  if (storeName.includes('인터파크')) return 'interpark';

  const url = String(store?.sourceUrl || store?.url || '').toLowerCase();
  if (url.includes('coupang')) return 'coupang';
  if (url.includes('naver')) return 'naver';
  if (url.includes('11st')) return '11st';
  if (url.includes('gmarket')) return 'gmarket';
  if (url.includes('auction')) return 'auction';
  if (url.includes('danawa')) return 'danawa';
  if (url.includes('enuri')) return 'ennuri';
  if (url.includes('ssg')) return 'ssg';
  if (url.includes('lotteon')) return 'lotteon';
  if (url.includes('interpark')) return 'interpark';
  return 'unknown';
}

function normalizeStoredStore(store) {
  if (!store || typeof store !== 'object') return false;
  let changed = false;

  const source = inferSourceFromStore(store);
  if (store.source !== source) {
    store.source = source;
    changed = true;
  }

  if (!store.collectedAt) {
    store.collectedAt = store.updatedAt || getStoreUpdatedAt();
    changed = true;
  }

  const score = Number.isFinite(Number(store.matchScore)) ? Number(store.matchScore) : 0;
  if (Number(store.matchScore) !== score) {
    store.matchScore = score;
    changed = true;
  }

  if (!store.storeLogo) {
    store.storeLogo = getStoreLogo(store.store);
    changed = true;
  }

  const price = Number(store.price) || 0;
  const rawPrice = Number(store.rawPrice) || price;
  if (!store.rawPrice || Number(store.rawPrice) !== rawPrice) {
    store.rawPrice = rawPrice;
    changed = true;
  }

  if (!store.updatedAt) {
    store.updatedAt = getStoreUpdatedAt();
    changed = true;
  }

  if (enrichStoreUrlMetadata(store)) {
    changed = true;
  }

  return changed;
}

/**
 * 문자열 해시 (간단한 해시)
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * 어필리에이트 링크 보강: 수집된 상품의 스토어 URL에 어필리에이트 매칭 적용
 */
function enrichWithAffiliateLinks(products) {
  let affiliateConfig = { naver: {} };
  try {
    if (fs.existsSync(AFFILIATE_LINKS_PATH)) {
      affiliateConfig = JSON.parse(fs.readFileSync(AFFILIATE_LINKS_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }

  const naverLinks = affiliateConfig.naver || {};

  for (const product of products) {
    for (const store of product.stores) {
      // 네이버 어필리에이트 매칭 (상품명 부분 일치)
      if (store.store && (store.store.includes('네이버') || store.url?.includes('naver.com') || store.url?.includes('search.shopping'))) {
        const titleLower = product.name.toLowerCase();
        for (const [keyword, url] of Object.entries(naverLinks)) {
          if (keyword.startsWith('_')) continue;
          if (!url) continue;
          if (titleLower.includes(keyword.toLowerCase())) {
            store.url = url;
            store.isAffiliate = true;
            break;
          }
        }
      }

      // 쿠팡 URL 마킹 (프론트엔드에서 딥링크 변환)
      if (store.url?.includes('coupang.com')) {
        store.isAffiliate = true;
      }
    }
  }

  return products;
}

/**
 * 전체 동기화 실행
 */
async function syncAll() {
  console.log(`\n🔄 [ProductSync] 전체 동기화 시작 (${new Date().toLocaleString('ko-KR')})`);
  ensureDirectories();

  const results = {};

  for (const [productType, queries] of Object.entries(SEARCH_QUERIES)) {
    console.log(`  📦 ${productType} 동기화 중...`);
    
    const catalog = loadCatalog(productType);
    const existingProducts = catalog.products || [];
    const allNewProducts = [];
    const priceRange = PRICE_RANGES[productType];

    for (const { query, category, display } of queries) {
      try {
        const items = await fetchFromNaver(query, display);
        
        for (const item of items) {
          const title = stripHtml(item.title);
          const price = parseInt(item.lprice, 10) || 0;
          
          // 유효성 검사
          if (!isValidProduct(title, productType)) continue;
          if (price < priceRange.min || price > priceRange.max) continue;
          
          const normalized = normalizeNaverProduct(item, productType, category);
          allNewProducts.push(normalized);
        }

        // API 속도 제한 준수 (네이버: 초당 10회)
        await delay(150);
      } catch (err) {
        console.error(`    ❌ "${query}" 검색 실패:`, err.message);
      }
    }

    // 기존 + 신규 병합
    const { products, addedCount, updatedCount } = mergeProducts(existingProducts, allNewProducts);

    // 전 플랫폼 가격 비교 스토어 확장
    const enrichSummary = await enrichCatalogStoresFromAllPlatforms(productType, products);
    if (enrichSummary.addedStores > 0) {
      console.log(`    🔎 ${productType}: 스토어 확장 +${enrichSummary.addedStores} (제품 ${enrichSummary.enrichedProducts}/${enrichSummary.checked})`);
    }

    // 어필리에이트 링크 보강
    enrichWithAffiliateLinks(products);

    // 썸네일 외부 캐시 (선택)
    const imageCacheSummary = await cacheProductImages(products, productType);
    if (imageCacheSummary.cached > 0) {
      console.log(`    🖼️ ${productType}: 이미지 캐시 ${imageCacheSummary.cached}/${imageCacheSummary.checked}`);
    }

    // 가격순 정렬
    products.sort((a, b) => b.discount.percent - a.discount.percent);

    // 카탈로그 저장
    saveCatalog(productType, {
      products,
      lastSync: new Date().toISOString(),
      syncCount: (catalog.syncCount || 0) + 1,
      stats: {
        total: products.length,
        autoGenerated: products.filter(p => p._autoGenerated).length,
        manual: products.filter(p => !p._autoGenerated).length,
        added: addedCount,
        updated: updatedCount,
      },
    });

    results[productType] = { total: products.length, added: addedCount, updated: updatedCount };
    console.log(`    ✅ ${productType}: ${products.length}개 (신규 +${addedCount}, 업데이트 ${updatedCount})`);
  }

  console.log(`✅ [ProductSync] 동기화 완료\n`);
  return results;
}

/**
 * 단일 제품 타입만 동기화
 */
async function syncProductType(productType) {
  const queries = SEARCH_QUERIES[productType];
  if (!queries) {
    throw new Error(`알 수 없는 제품 타입: ${productType}`);
  }

  ensureDirectories();
  const catalog = loadCatalog(productType);
  const existingProducts = catalog.products || [];
  const allNewProducts = [];
  const priceRange = PRICE_RANGES[productType];

  for (const { query, category, display } of queries) {
    try {
      const items = await fetchFromNaver(query, display);
      for (const item of items) {
        const title = stripHtml(item.title);
        const price = parseInt(item.lprice, 10) || 0;
        if (!isValidProduct(title, productType)) continue;
        if (price < priceRange.min || price > priceRange.max) continue;
        allNewProducts.push(normalizeNaverProduct(item, productType, category));
      }
      await delay(150);
    } catch (err) {
      console.error(`[ProductSync] "${query}" 실패:`, err.message);
    }
  }

  const { products, addedCount, updatedCount } = mergeProducts(existingProducts, allNewProducts);

  const enrichSummary = await enrichCatalogStoresFromAllPlatforms(productType, products);
  if (enrichSummary.addedStores > 0) {
    console.log(`[ProductSync] ${productType}: 스토어 확장 +${enrichSummary.addedStores}`);
  }

  enrichWithAffiliateLinks(products);
  const imageCacheSummary = await cacheProductImages(products, productType);
  if (imageCacheSummary.cached > 0) {
    console.log(`[ProductSync] ${productType}: 이미지 캐시 ${imageCacheSummary.cached}/${imageCacheSummary.checked}`);
  }

  products.sort((a, b) => b.discount.percent - a.discount.percent);

  saveCatalog(productType, {
    products,
    lastSync: new Date().toISOString(),
    syncCount: (catalog.syncCount || 0) + 1,
    stats: { total: products.length, autoGenerated: products.filter(p => p._autoGenerated).length, manual: products.filter(p => !p._autoGenerated).length, added: addedCount, updated: updatedCount },
  });

  return { total: products.length, added: addedCount, updated: updatedCount };
}

/**
 * 이미지 자동 보충 (healImages)
 * 카탈로그에서 이미지가 없거나 플레이스홀더인 제품에 대해
 * 네이버 쇼핑 API에서 이미지를 자동으로 가져옴
 */
async function healImages(productType) {
  ensureDirectories();
  const catalog = loadCatalog(productType);
  const products = catalog.products || [];
  let updatedCount = 0;

  const productsNeedingImages = products.filter(p => {
    const img = p.images?.[0] || '';
    return !isUsableProductImage(img);
  });

  if (productsNeedingImages.length === 0) {
    return { productType, checked: products.length, updated: 0, message: '모든 제품에 이미지가 있습니다' };
  }

  console.log(`[HealImages] ${productType}: ${productsNeedingImages.length}개 제품 이미지 보충 시작`);

  for (const product of productsNeedingImages) {
    try {
      // 제품명으로 네이버 검색하여 이미지 가져오기
      const searchQuery = `${product.brand} ${product.name}`.trim();
      const items = await fetchFromNaver(searchQuery, 3);
      
      const firstValidImage = items.find((x) => isUsableProductImage(x.image))?.image || '';
      if (firstValidImage) {
        product.images = [firstValidImage];
        await cachePrimaryProductImage(product, `${productType}/thumb`);
        product._lastUpdated = new Date().toISOString();
        updatedCount++;
        console.log(`[HealImages] ✅ ${product.name} → ${firstValidImage.substring(0, 60)}...`);
      }

      // API 부하 방지
      await delay(200);
    } catch (err) {
      console.error(`[HealImages] ❌ ${product.name}: ${err.message}`);
    }
  }

  if (updatedCount > 0) {
    catalog.products = products;
    saveCatalog(productType, catalog);
    console.log(`[HealImages] ${productType}: ${updatedCount}개 이미지 업데이트 완료`);
  }

  return { productType, checked: products.length, needsImage: productsNeedingImages.length, updated: updatedCount };
}

/**
 * 전체 카탈로그 이미지 보충
 */
async function healAllImages() {
  const results = [];
  for (const type of ['laptop', 'monitor', 'desktop']) {
    const result = await healImages(type);
    results.push(result);
  }
  return results;
}

/**
 * 단일 제품 이미지 검색 (API 엔드포인트용)
 */
async function searchProductImage(productName) {
  const items = await fetchFromNaver(productName, 3);
  const firstValidImage = items.find((x) => isUsableProductImage(x.image));
  if (firstValidImage) {
    let image = firstValidImage.image;
    if (isImageCacheEnabled()) {
      const cached = await cacheImageFromUrl(image, { prefix: 'search/thumb' });
      if (cached.ok && isUsableProductImage(cached.url)) {
        image = cached.url;
      }
    }
    return {
      image,
      source: 'naver',
      title: stripHtml(firstValidImage.title),
    };
  }
  return null;
}

module.exports = {
  syncAll,
  syncProductType,
  loadCatalog,
  getPriceHistory,
  ensureDirectories,
  healImages,
  healAllImages,
  searchProductImage,
};
