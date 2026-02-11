const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { fetchWithUA, withTimeout, delay } = require('../utils/helpers');
const { buildCoupangAuthorization } = require('../utils/coupangAuth');

const PRODUCT_TYPES = ['laptop', 'monitor', 'desktop'];
const CATALOG_DIR = path.join(__dirname, '..', 'data', 'catalog');
const LOG_DIR = path.join(__dirname, '..', 'logs');
const VERIFICATION_LOG_FILE = process.env.VERIFICATION_LOG_PATH || path.join(LOG_DIR, 'verification.jsonl');
const VERIFICATION_LOG_MAX_BYTES = parseInt(process.env.VERIFICATION_LOG_MAX_BYTES || `${10 * 1024 * 1024}`, 10);

const VERIFICATION_STATUSES = new Set(['verified', 'failed', 'stale']);
const VERIFICATION_METHODS = new Set(['api', 'browser', 'fallback']);

const verificationQueue = [];
let queueRunning = false;
let lastNaverRequestAt = 0;
let lastCoupangRequestAt = 0;

function ensureVerificationStorage() {
  if (!fs.existsSync(CATALOG_DIR)) {
    fs.mkdirSync(CATALOG_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getStaleMinutes() {
  return Math.max(1, parseInt(process.env.VERIFICATION_STALE_MINUTES || '360', 10) || 360);
}

function getStaleMs() {
  return getStaleMinutes() * 60 * 1000;
}

function getVerificationTimeoutMs() {
  return Math.max(1500, parseInt(process.env.VERIFICATION_TIMEOUT_MS || '6500', 10) || 6500);
}

function getClickVerifyTimeoutMs() {
  return Math.max(1200, parseInt(process.env.CLICK_VERIFY_TIMEOUT_MS || '2500', 10) || 2500);
}

function getListingPriceTtlSec() {
  return Math.max(30, parseInt(process.env.LISTING_PRICE_TTL_SEC || '300', 10) || 300);
}

function getDisplayPriceFreshMinutes() {
  return Math.max(5, parseInt(process.env.DISPLAY_PRICE_FRESH_MINUTES || `${getStaleMinutes()}`, 10) || getStaleMinutes());
}

function getDisplayPriceFreshMs() {
  return getDisplayPriceFreshMinutes() * 60 * 1000;
}

function isStrictPriceGuardEnabled() {
  return process.env.STRICT_PRICE_GUARD !== 'false';
}

function isDegradedRedirectAllowed() {
  return process.env.ALLOW_DEGRADED_REDIRECT === 'true';
}

function getNaverVerifyMinIntervalMs() {
  return Math.max(100, parseInt(process.env.NAVER_VERIFY_MIN_INTERVAL_MS || '120', 10) || 120);
}

function getCoupangVerifyMinIntervalMs() {
  return Math.max(80, parseInt(process.env.COUPANG_VERIFY_MIN_INTERVAL_MS || '120', 10) || 120);
}

async function throttleApi(platform) {
  if (platform === 'naver') {
    const interval = getNaverVerifyMinIntervalMs();
    const waitMs = Math.max(0, (lastNaverRequestAt + interval) - Date.now());
    if (waitMs > 0) await delay(waitMs);
    lastNaverRequestAt = Date.now();
    return;
  }

  if (platform === 'coupang') {
    const interval = getCoupangVerifyMinIntervalMs();
    const waitMs = Math.max(0, (lastCoupangRequestAt + interval) - Date.now());
    if (waitMs > 0) await delay(waitMs);
    lastCoupangRequestAt = Date.now();
  }
}

function isVerifiedOnlyMode() {
  return process.env.VERIFIED_ONLY_MODE === 'true';
}

function isClickTimeVerifyEnabled() {
  return process.env.CLICK_TIME_VERIFY !== 'false';
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const parsed = parseInt(String(value || '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function normalizeStatus(value, fallback = 'stale') {
  const normalized = String(value || '').toLowerCase();
  return VERIFICATION_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeMethod(value, fallback = 'fallback') {
  const normalized = String(value || '').toLowerCase();
  return VERIFICATION_METHODS.has(normalized) ? normalized : fallback;
}

function isIsoDate(value) {
  if (!value || typeof value !== 'string') return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function canonicalizeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/g, '').toLowerCase();

    const params = [...parsed.searchParams.entries()]
      .filter(([k]) => {
        const key = String(k || '').toLowerCase();
        return ![
          'lptag',
          'traceid',
          'requestid',
          'subid',
          'utm_source',
          'utm_medium',
          'utm_campaign',
          'utm_term',
          'utm_content',
        ].includes(key);
      })
      .sort((a, b) => a[0].localeCompare(b[0]));

    const qs = new URLSearchParams(params).toString();
    return `${host}${pathname}${qs ? `?${qs}` : ''}`;
  } catch {
    return raw.replace(/^https?:\/\//i, '').replace(/\/+$/g, '').toLowerCase();
  }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9가-힣]/g, '');
}

function inferSourceFromStore(store) {
  const sourceRaw = String(store?.source || '').trim().toLowerCase();
  if (sourceRaw && sourceRaw !== 'unknown') return sourceRaw;

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

  const sourceUrl = String(store?.sourceUrl || store?.url || '').toLowerCase();
  if (sourceUrl.includes('coupang')) return 'coupang';
  if (sourceUrl.includes('naver')) return 'naver';
  if (sourceUrl.includes('11st')) return '11st';
  if (sourceUrl.includes('gmarket')) return 'gmarket';
  if (sourceUrl.includes('auction')) return 'auction';
  if (sourceUrl.includes('danawa')) return 'danawa';
  if (sourceUrl.includes('enuri')) return 'ennuri';
  if (sourceUrl.includes('ssg')) return 'ssg';
  if (sourceUrl.includes('lotteon')) return 'lotteon';
  if (sourceUrl.includes('interpark')) return 'interpark';
  return 'unknown';
}

function base64urlEncode(value) {
  const raw = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf-8');
  return raw.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlDecode(value) {
  const input = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4;
  const normalized = input + (pad === 0 ? '' : '='.repeat(4 - pad));
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function getTokenSecret() {
  return String(
    process.env.PRICE_TOKEN_SECRET
    || process.env.ADMIN_PASSWORD
    || process.env.COUPANG_SECRET_KEY
    || 'lapprice-price-token',
  );
}

function signTokenPayload(encodedPayload) {
  return base64urlEncode(
    crypto.createHmac('sha256', getTokenSecret()).update(String(encodedPayload || ''), 'utf-8').digest(),
  );
}

function createSignedToken(payload, ttlSec) {
  const expiresAt = Date.now() + (Math.max(5, ttlSec) * 1000);
  const safePayload = {
    ...payload,
    exp: expiresAt,
  };
  const encoded = base64urlEncode(JSON.stringify(safePayload));
  const signature = signTokenPayload(encoded);
  return `${encoded}.${signature}`;
}

function verifySignedToken(token) {
  const raw = String(token || '').trim();
  if (!raw || !raw.includes('.')) {
    return { ok: false, code: 'TOKEN_MISSING' };
  }

  const [encoded, signature] = raw.split('.');
  if (!encoded || !signature) {
    return { ok: false, code: 'TOKEN_INVALID' };
  }

  const expectedSignature = signTokenPayload(encoded);
  if (signature !== expectedSignature) {
    return { ok: false, code: 'TOKEN_SIGNATURE_INVALID' };
  }

  try {
    const payload = JSON.parse(base64urlDecode(encoded));
    if (!payload || typeof payload !== 'object') {
      return { ok: false, code: 'TOKEN_PAYLOAD_INVALID' };
    }
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp) || exp <= Date.now()) {
      return { ok: false, code: 'TOKEN_EXPIRED', payload };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, code: 'TOKEN_DECODE_FAILED' };
  }
}

function createPriceToken({ offerId, listedPrice, verifiedAt }) {
  const price = toNumber(listedPrice);
  if (!offerId || price <= 0) return null;

  return createSignedToken({
    purpose: 'price',
    offerId: String(offerId),
    listedPrice: price,
    verifiedAt: isIsoDate(verifiedAt) ? new Date(verifiedAt).toISOString() : null,
  }, getListingPriceTtlSec());
}

function verifyPriceToken(token, expectedOfferId) {
  const parsed = verifySignedToken(token);
  if (!parsed.ok) return parsed;

  const payload = parsed.payload || {};
  if (payload.purpose !== 'price') {
    return { ok: false, code: 'TOKEN_PURPOSE_MISMATCH', payload };
  }

  if (expectedOfferId && String(payload.offerId || '') !== String(expectedOfferId)) {
    return { ok: false, code: 'TOKEN_OFFER_MISMATCH', payload };
  }

  const listedPrice = toNumber(payload.listedPrice);
  if (listedPrice <= 0) {
    return { ok: false, code: 'TOKEN_PRICE_INVALID', payload };
  }

  return {
    ok: true,
    payload: {
      ...payload,
      offerId: String(payload.offerId),
      listedPrice,
      verifiedAt: isIsoDate(payload.verifiedAt) ? new Date(payload.verifiedAt).toISOString() : null,
      exp: Number(payload.exp),
    },
  };
}

function createConfirmToken({ offerId, oldPrice, newPrice }) {
  const safeOld = toNumber(oldPrice);
  const safeNew = toNumber(newPrice);
  if (!offerId || safeOld <= 0 || safeNew <= 0) return null;

  return createSignedToken({
    purpose: 'confirm',
    offerId: String(offerId),
    oldPrice: safeOld,
    newPrice: safeNew,
  }, 60);
}

function verifyConfirmToken(token, expectedOfferId) {
  const parsed = verifySignedToken(token);
  if (!parsed.ok) return parsed;

  const payload = parsed.payload || {};
  if (payload.purpose !== 'confirm') {
    return { ok: false, code: 'TOKEN_PURPOSE_MISMATCH', payload };
  }
  if (expectedOfferId && String(payload.offerId || '') !== String(expectedOfferId)) {
    return { ok: false, code: 'TOKEN_OFFER_MISMATCH', payload };
  }

  const oldPrice = toNumber(payload.oldPrice);
  const newPrice = toNumber(payload.newPrice);
  if (oldPrice <= 0 || newPrice <= 0) {
    return { ok: false, code: 'TOKEN_PRICE_INVALID', payload };
  }

  return {
    ok: true,
    payload: {
      ...payload,
      offerId: String(payload.offerId),
      oldPrice,
      newPrice,
      exp: Number(payload.exp),
    },
  };
}

function toSafeString(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function toSafeBool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function toSafeArray(value, fallback = []) {
  if (!Array.isArray(value)) return [...fallback];
  return value;
}

function inferBrand(productName, fallback = '기타') {
  const name = normalizeText(productName);
  if (!name) return fallback;
  if (name.includes('apple') || name.includes('맥북') || name.includes('macbook')) return '애플';
  if (name.includes('삼성') || name.includes('galaxy') || name.includes('갤럭시')) return '삼성';
  if (name.includes('lg') || name.includes('그램')) return 'LG';
  if (name.includes('asus') || name.includes('에이수스') || name.includes('rog') || name.includes('tuf')) return 'ASUS';
  if (name.includes('레노버') || name.includes('lenovo') || name.includes('씽크패드') || name.includes('thinkpad')) return '레노버';
  if (name.includes('msi')) return 'MSI';
  if (name.includes('hp') || name.includes('오멘') || name.includes('victus')) return 'HP';
  if (name.includes('dell') || name.includes('xps') || name.includes('alienware')) return 'Dell';
  return fallback;
}

function inferCpuType(cpuText) {
  const cpu = normalizeText(cpuText);
  if (!cpu) return 'intel';
  if (cpu.includes('ryzen') || cpu.includes('amd')) return 'amd';
  if (cpu.includes('m1') || cpu.includes('m2') || cpu.includes('m3') || cpu.includes('m4') || cpu.includes('apple')) return 'apple';
  return 'intel';
}

function inferLaptopCategory(rawCategory, nameText) {
  const allowed = new Set(['gaming', 'ultrabook', 'business', 'creator', 'budget', 'apple']);
  if (allowed.has(rawCategory)) return rawCategory;

  const name = normalizeText(nameText);
  if (name.includes('맥북') || name.includes('macbook')) return 'apple';
  if (name.includes('게이밍') || name.includes('gaming') || name.includes('rtx') || name.includes('rog') || name.includes('tuf') || name.includes('omen') || name.includes('victus')) return 'gaming';
  if (name.includes('크리에이터') || name.includes('creator') || name.includes('studio')) return 'creator';
  if (name.includes('울트라') || name.includes('ultra') || name.includes('그램') || name.includes('zenbook') || name.includes('air')) return 'ultrabook';
  if (name.includes('비즈니스') || name.includes('business') || name.includes('씽크패드') || name.includes('thinkpad')) return 'business';
  return 'budget';
}

function inferMonitorCategory(rawCategory, nameText) {
  const allowed = new Set(['gaming', 'professional', 'ultrawide', 'general', 'portable']);
  if (allowed.has(rawCategory)) return rawCategory;

  const name = normalizeText(nameText);
  if (name.includes('울트라와이드') || name.includes('ultrawide') || name.includes('219') || name.includes('329')) return 'ultrawide';
  if (name.includes('게이밍') || name.includes('gaming') || name.includes('144') || name.includes('165') || name.includes('240')) return 'gaming';
  if (name.includes('4k') || name.includes('oled') || name.includes('pro') || name.includes('전문') || name.includes('색')) return 'professional';
  if (name.includes('portable') || name.includes('휴대')) return 'portable';
  return 'general';
}

function inferDesktopCategory(rawCategory, nameText) {
  const allowed = new Set(['gaming', 'workstation', 'minipc', 'allinone', 'office', 'mac', 'creator']);
  if (allowed.has(rawCategory)) return rawCategory;

  const name = normalizeText(nameText);
  if (name.includes('맥') || name.includes('imac') || name.includes('macmini')) return 'mac';
  if (name.includes('미니pc') || name.includes('minipc') || name.includes('nuc') || name.includes('타이니')) return 'minipc';
  if (name.includes('올인원') || name.includes('allinone')) return 'allinone';
  if (name.includes('게이밍') || name.includes('gaming') || name.includes('rtx')) return 'gaming';
  if (name.includes('크리에이터') || name.includes('creator') || name.includes('workstation')) return 'creator';
  return 'office';
}

function defaultLaptopSpecs(category) {
  if (category === 'apple') {
    return {
      cpu: 'Apple M4',
      cpuType: 'apple',
      gpu: 'Apple GPU',
      ram: 16,
      ramType: 'Unified',
      storage: 512,
      storageType: 'SSD',
      display: 'Liquid Retina',
      displaySize: 14,
      weight: 1.4,
      battery: '최대 18시간',
    };
  }
  if (category === 'gaming') {
    return {
      cpu: 'Intel Core i7',
      cpuType: 'intel',
      gpu: 'NVIDIA RTX 4060',
      ram: 16,
      ramType: 'DDR5',
      storage: 512,
      storageType: 'SSD',
      display: 'FHD 144Hz',
      displaySize: 16,
      weight: 2.3,
      battery: '최대 8시간',
    };
  }
  return {
    cpu: 'Intel Core i5',
    cpuType: 'intel',
    gpu: '내장 그래픽',
    ram: 16,
    ramType: 'LPDDR5',
    storage: 512,
    storageType: 'SSD',
    display: 'FHD',
    displaySize: 15.6,
    weight: 1.6,
    battery: '최대 12시간',
  };
}

function defaultMonitorSpecs() {
  return {
    panelType: 'IPS',
    resolution: '1920x1080',
    resolutionLabel: 'FHD',
    refreshRate: 60,
    responseTime: '5ms',
    screenSize: 27,
    aspectRatio: '16:9',
    hdr: 'HDR 미지원',
    colorGamut: 'sRGB 99%',
    ports: ['HDMI'],
    speakers: false,
    heightAdjust: false,
    pivot: false,
    vesa: true,
    curved: false,
    curvature: undefined,
  };
}

function defaultDesktopSpecs(category) {
  if (category === 'mac') {
    return {
      cpu: 'Apple M4',
      cpuType: 'apple',
      gpu: 'Apple GPU',
      ram: 16,
      ramType: 'Unified',
      storage: 512,
      storageType: 'SSD',
      formFactor: '미니PC',
      psu: '내장',
      os: 'macOS',
      includedMonitor: '',
      expansion: ['Thunderbolt', 'USB-C'],
    };
  }
  return {
    cpu: 'Intel Core i5',
    cpuType: 'intel',
    gpu: 'Intel UHD Graphics',
    ram: 16,
    ramType: 'DDR5',
    storage: 512,
    storageType: 'SSD',
    formFactor: '미들타워',
    psu: '500W',
    os: 'FreeDOS',
    includedMonitor: '',
    expansion: ['USB 3.2'],
  };
}

function normalizeProductShape(productType, product) {
  const source = product && typeof product === 'object' ? product : {};
  const stores = Array.isArray(source.stores) ? source.stores : [];
  const fallbackPrice = toNumber(stores[0]?.price || stores[0]?.rawPrice);
  const pricesRaw = source.prices && typeof source.prices === 'object' ? source.prices : {};

  const current = toNumber(pricesRaw.current) || fallbackPrice;
  const original = Math.max(current, toNumber(pricesRaw.original) || current);
  const lowest = Math.min(current || toNumber(pricesRaw.lowest) || original, toNumber(pricesRaw.lowest) || current || original);
  const average = Math.max(current || original, toNumber(pricesRaw.average) || current || original);
  const discountAmount = Math.max(0, original - current);
  const discountPercent = original > current ? Math.round((discountAmount / original) * 100) : 0;

  const name = toSafeString(source.name, '상품 정보 준비중');
  const brand = toSafeString(source.brand, inferBrand(name));
  const model = toSafeString(source.model, name);
  const images = toSafeArray(source.images, []).filter((x) => typeof x === 'string' && x);
  const tags = toSafeArray(source.tags, []).filter((x) => typeof x === 'string' && x);

  const normalized = {
    ...source,
    productType,
    name,
    brand,
    model,
    prices: {
      original,
      current,
      lowest: lowest || current || original,
      average,
    },
    discount: {
      percent: toNumber(source.discount?.percent) || discountPercent,
      amount: toNumber(source.discount?.amount) || discountAmount,
    },
    priceIndex: toNumber(source.priceIndex) || 70,
    rating: {
      score: Number.isFinite(Number(source.rating?.score)) ? Number(source.rating.score) : 4.3,
      count: toNumber(source.rating?.count),
    },
    reviews: Array.isArray(source.reviews) ? source.reviews : [],
    stock: ['in', 'low', 'out'].includes(String(source.stock)) ? source.stock : 'in',
    isNew: toSafeBool(source.isNew, false),
    isHot: toSafeBool(source.isHot, false),
    releaseDate: toSafeString(source.releaseDate, new Date().toISOString().slice(0, 7)),
    images: images.length > 0 ? images : [''],
    tags,
  };

  if (productType === 'laptop') {
    const category = inferLaptopCategory(source.category, name);
    const defaults = defaultLaptopSpecs(category);
    const specs = source.specs && typeof source.specs === 'object' ? source.specs : {};
    const cpu = toSafeString(specs.cpu, defaults.cpu);

    return {
      ...normalized,
      category,
      specs: {
        cpu,
        cpuType: ['intel', 'amd', 'apple'].includes(specs.cpuType) ? specs.cpuType : inferCpuType(cpu),
        gpu: toSafeString(specs.gpu, defaults.gpu),
        ram: toNumber(specs.ram) || defaults.ram,
        ramType: toSafeString(specs.ramType, defaults.ramType),
        storage: toNumber(specs.storage) || defaults.storage,
        storageType: toSafeString(specs.storageType, defaults.storageType),
        display: toSafeString(specs.display, defaults.display),
        displaySize: Number.isFinite(Number(specs.displaySize)) ? Number(specs.displaySize) : defaults.displaySize,
        weight: Number.isFinite(Number(specs.weight)) ? Number(specs.weight) : defaults.weight,
        battery: toSafeString(specs.battery, defaults.battery),
      },
    };
  }

  if (productType === 'monitor') {
    const category = inferMonitorCategory(source.category, name);
    const defaults = defaultMonitorSpecs();
    const specs = source.specs && typeof source.specs === 'object' ? source.specs : {};
    return {
      ...normalized,
      category,
      specs: {
        panelType: ['IPS', 'VA', 'OLED', 'TN', 'Mini LED', 'QD-OLED', 'IPS Black'].includes(specs.panelType) ? specs.panelType : defaults.panelType,
        resolution: toSafeString(specs.resolution, defaults.resolution),
        resolutionLabel: toSafeString(specs.resolutionLabel, defaults.resolutionLabel),
        refreshRate: toNumber(specs.refreshRate) || defaults.refreshRate,
        responseTime: toSafeString(specs.responseTime, defaults.responseTime),
        screenSize: Number.isFinite(Number(specs.screenSize)) ? Number(specs.screenSize) : defaults.screenSize,
        aspectRatio: toSafeString(specs.aspectRatio, defaults.aspectRatio),
        hdr: toSafeString(specs.hdr, defaults.hdr),
        colorGamut: toSafeString(specs.colorGamut, defaults.colorGamut),
        ports: Array.isArray(specs.ports) ? specs.ports : defaults.ports,
        speakers: typeof specs.speakers === 'boolean' ? specs.speakers : defaults.speakers,
        heightAdjust: typeof specs.heightAdjust === 'boolean' ? specs.heightAdjust : defaults.heightAdjust,
        pivot: typeof specs.pivot === 'boolean' ? specs.pivot : defaults.pivot,
        vesa: typeof specs.vesa === 'boolean' ? specs.vesa : defaults.vesa,
        curved: typeof specs.curved === 'boolean' ? specs.curved : defaults.curved,
        curvature: toSafeString(specs.curvature, defaults.curvature),
      },
    };
  }

  const category = inferDesktopCategory(source.category, name);
  const defaults = defaultDesktopSpecs(category);
  const specs = source.specs && typeof source.specs === 'object' ? source.specs : {};
  const cpu = toSafeString(specs.cpu, defaults.cpu);
  return {
    ...normalized,
    category,
    specs: {
      cpu,
      cpuType: ['intel', 'amd', 'apple'].includes(specs.cpuType) ? specs.cpuType : inferCpuType(cpu),
      gpu: toSafeString(specs.gpu, defaults.gpu),
      ram: toNumber(specs.ram) || defaults.ram,
      ramType: toSafeString(specs.ramType, defaults.ramType),
      storage: toNumber(specs.storage) || defaults.storage,
      storageType: toSafeString(specs.storageType, defaults.storageType),
      formFactor: toSafeString(specs.formFactor, defaults.formFactor),
      psu: toSafeString(specs.psu, defaults.psu),
      os: toSafeString(specs.os, defaults.os),
      includedMonitor: toSafeString(specs.includedMonitor, defaults.includedMonitor),
      expansion: Array.isArray(specs.expansion) ? specs.expansion : defaults.expansion,
    },
  };
}

function buildOfferId(productId, storeName, sourceUrl) {
  const seed = `${productId || ''}|${storeName || ''}|${canonicalizeUrl(sourceUrl || '')}`;
  const hash = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 18);
  return `offer_${hash}`;
}

function isNaverUrl(value) {
  return /(^|\.)naver\.com$/i.test(getHostname(value));
}

function isCoupangUrl(value) {
  const host = getHostname(value);
  return /(^|\.)coupang\.com$/i.test(host) || /(^|\.)link\.coupang\.com$/i.test(host);
}

function getHostname(value) {
  try {
    return new URL(String(value || '').trim()).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function extractNaverProductId(value) {
  const raw = String(value || '');
  const patterns = [
    /\/products\/(\d{5,})/i,
    /\/catalog\/(\d{5,})/i,
    /[?&]nvMid=(\d{5,})/i,
    /[?&]productId=(\d{5,})/i,
  ];
  for (const pattern of patterns) {
    const matched = raw.match(pattern);
    if (matched?.[1]) return matched[1];
  }
  return '';
}

function extractCoupangProductId(value) {
  const raw = String(value || '');
  const patterns = [
    /\/vp\/products\/(\d{5,})/i,
    /\/products\/(\d{5,})/i,
    /[?&]productId=(\d{5,})/i,
  ];
  for (const pattern of patterns) {
    const matched = raw.match(pattern);
    if (matched?.[1]) return matched[1];
  }
  return '';
}

function readCatalogFile(productType) {
  const filePath = path.join(CATALOG_DIR, `${productType}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`[OfferVerification] 카탈로그 로드 실패 (${productType}):`, err.message);
  }
  return { products: [], lastSync: null, syncCount: 0, stats: null };
}

function saveCatalogFile(productType, catalog) {
  ensureVerificationStorage();
  const filePath = path.join(CATALOG_DIR, `${productType}.json`);
  fs.writeFileSync(filePath, JSON.stringify(catalog, null, 2), 'utf-8');
}

function getFreshUntilIso(verifiedAt) {
  if (!isIsoDate(verifiedAt)) return null;
  const freshUntilMs = Date.parse(verifiedAt) + (getListingPriceTtlSec() * 1000);
  return new Date(freshUntilMs).toISOString();
}

function isVerifiedFreshStore(store, nowMs = Date.now()) {
  if (normalizeStatus(store?.verificationStatus, 'failed') !== 'verified') return false;
  if (!toSafeBool(store?.isActive, false)) return false;
  const verifiedPrice = toNumber(store?.verifiedPrice);
  if (verifiedPrice <= 0) return false;
  if (!isIsoDate(store?.verifiedAt)) return false;
  const verifiedAtMs = Date.parse(store.verifiedAt);
  return (nowMs - verifiedAtMs) <= getDisplayPriceFreshMs();
}

function getStorePriceState(store, nowMs = Date.now()) {
  if (String(store?.priceState || '') === 'personalized') return 'personalized';
  if (isVerifiedFreshStore(store, nowMs)) return 'verified_fresh';
  if (normalizeStatus(store?.verificationStatus, 'failed') === 'verified' && toNumber(store?.verifiedPrice) > 0) {
    return 'verified_stale';
  }
  return 'unverified';
}

function getStoreDisplayPrice(store, nowMs = Date.now()) {
  const state = getStorePriceState(store, nowMs);
  if (state !== 'verified_fresh') return null;
  const verifiedPrice = toNumber(store?.verifiedPrice);
  return verifiedPrice > 0 ? verifiedPrice : null;
}

function computeDeltaPercent(beforePrice, afterPrice) {
  const before = toNumber(beforePrice);
  const after = toNumber(afterPrice);
  if (before <= 0 || after <= 0) return 0;
  return Number((((after - before) / before) * 100).toFixed(2));
}

function markStoreStatusByFreshness(store, nowMs) {
  let changed = false;

  const staleByTime = store.verifiedAt && Number.isFinite(Date.parse(store.verifiedAt))
    ? (nowMs - Date.parse(store.verifiedAt)) > getDisplayPriceFreshMs()
    : true;

  if (store.verificationStatus === 'verified' && staleByTime) {
    store.verificationStatus = 'stale';
    store.isActive = false;
    changed = true;
  }

  if (store.verificationStatus !== 'verified' && store.isActive) {
    store.isActive = false;
    changed = true;
  }

  return changed;
}

function ensureStoreOfferMetadata(product, store) {
  let changed = false;

  if (!store || typeof store !== 'object') return false;

  const currentUrl = String(store.url || '').trim();
  const sourceUrl = isHttpUrl(store.sourceUrl)
    ? String(store.sourceUrl).trim()
    : (isHttpUrl(currentUrl) ? currentUrl : '');
  if (store.sourceUrl !== sourceUrl) {
    store.sourceUrl = sourceUrl;
    changed = true;
  }

  const nextOfferId = store.offerId || buildOfferId(product?.id, store.store, sourceUrl || currentUrl);
  if (store.offerId !== nextOfferId) {
    store.offerId = nextOfferId;
    changed = true;
  }

  const listedPrice = toNumber(store.price);
  const rawPrice = listedPrice > 0 ? listedPrice : toNumber(store.rawPrice);
  if (toNumber(store.rawPrice) !== rawPrice) {
    store.rawPrice = rawPrice;
    changed = true;
  }
  if (listedPrice <= 0 && rawPrice > 0) {
    store.price = rawPrice;
    changed = true;
  }

  const verifiedPrice = toNumber(store.verifiedPrice);
  if (toNumber(store.verifiedPrice) !== verifiedPrice) {
    store.verifiedPrice = verifiedPrice;
    changed = true;
  }

  const normalizedStatus = normalizeStatus(store.verificationStatus, 'stale');
  if (store.verificationStatus !== normalizedStatus) {
    store.verificationStatus = normalizedStatus;
    changed = true;
  }

  const normalizedMethod = normalizeMethod(store.verificationMethod, 'fallback');
  if (store.verificationMethod !== normalizedMethod) {
    store.verificationMethod = normalizedMethod;
    changed = true;
  }

  const normalizedVerifiedAt = isIsoDate(store.verifiedAt) ? new Date(store.verifiedAt).toISOString() : null;
  if (store.verifiedAt !== normalizedVerifiedAt) {
    store.verifiedAt = normalizedVerifiedAt;
    changed = true;
  }

  const normalizedErrorCode = store.lastErrorCode ? String(store.lastErrorCode) : null;
  if (store.lastErrorCode !== normalizedErrorCode) {
    store.lastErrorCode = normalizedErrorCode;
    changed = true;
  }

  const normalizedErrorMessage = store.lastErrorMessage ? String(store.lastErrorMessage) : null;
  if (store.lastErrorMessage !== normalizedErrorMessage) {
    store.lastErrorMessage = normalizedErrorMessage;
    changed = true;
  }

  const initialActive = typeof store.isActive === 'boolean' ? store.isActive : normalizedStatus === 'verified';
  if (store.isActive !== initialActive) {
    store.isActive = initialActive;
    changed = true;
  }

  const now = Date.now();
  if (markStoreStatusByFreshness(store, now)) {
    changed = true;
  }

  const priceState = getStorePriceState(store, now);
  if (store.priceState !== priceState) {
    store.priceState = priceState;
    changed = true;
  }

  const displayPrice = getStoreDisplayPrice(store, now);
  const normalizedDisplayPrice = displayPrice === null ? null : toNumber(displayPrice);
  if ((store.displayPrice ?? null) !== normalizedDisplayPrice) {
    store.displayPrice = normalizedDisplayPrice;
    changed = true;
  }

  const freshUntil = getFreshUntilIso(store.verifiedAt);
  if ((store.freshUntil || null) !== (freshUntil || null)) {
    store.freshUntil = freshUntil;
    changed = true;
  }

  const nextMismatchCount = Math.max(0, parseInt(store.mismatchCount || '0', 10) || 0);
  if (store.mismatchCount !== nextMismatchCount) {
    store.mismatchCount = nextMismatchCount;
    changed = true;
  }

  const nextDelta = Number.isFinite(Number(store.lastDeltaPercent))
    ? Number(store.lastDeltaPercent)
    : 0;
  if (store.lastDeltaPercent !== nextDelta) {
    store.lastDeltaPercent = nextDelta;
    changed = true;
  }

  const nextLatency = Number.isFinite(Number(store.lastVerifyLatencyMs))
    ? Math.max(0, Math.round(Number(store.lastVerifyLatencyMs)))
    : null;
  if ((store.lastVerifyLatencyMs ?? null) !== nextLatency) {
    store.lastVerifyLatencyMs = nextLatency;
    changed = true;
  }

  return changed;
}

function ensureCatalogOfferMetadata(catalog) {
  let changed = false;

  if (!Array.isArray(catalog.products)) {
    catalog.products = [];
    return true;
  }

  for (const product of catalog.products) {
    if (!Array.isArray(product.stores)) {
      product.stores = [];
      changed = true;
      continue;
    }

    for (const store of product.stores) {
      if (ensureStoreOfferMetadata(product, store)) {
        changed = true;
      }
    }
  }

  return changed;
}

function rotateVerificationLogIfNeeded() {
  try {
    if (!fs.existsSync(VERIFICATION_LOG_FILE)) return;
    const stats = fs.statSync(VERIFICATION_LOG_FILE);
    if (stats.size < VERIFICATION_LOG_MAX_BYTES) return;

    const ext = path.extname(VERIFICATION_LOG_FILE);
    const base = VERIFICATION_LOG_FILE.slice(0, -ext.length);
    const date = new Date().toISOString().split('T')[0];
    const dated = `${base}.${date}${ext}`;
    const target = fs.existsSync(dated) ? `${base}.${date}-${Date.now()}${ext}` : dated;
    fs.renameSync(VERIFICATION_LOG_FILE, target);
  } catch (err) {
    console.error('[OfferVerification] 로그 로테이션 실패:', err.message);
  }
}

function appendVerificationLog(entry) {
  try {
    ensureVerificationStorage();
    rotateVerificationLogIfNeeded();
    fs.appendFileSync(VERIFICATION_LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf-8');
  } catch (err) {
    console.error('[OfferVerification] 로그 기록 실패:', err.message);
  }
}

async function fetchNaverItems(query, display = 50) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { ok: false, code: 'NAVER_API_KEY_MISSING', items: [] };
  }

  try {
    await throttleApi('naver');
    const target = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=${display}&sort=sim`;
    const response = await withTimeout(fetch(target, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    }), getVerificationTimeoutMs());

    if (!response.ok) {
      return { ok: false, code: `NAVER_HTTP_${response.status}`, items: [] };
    }

    const data = await response.json();
    return { ok: true, items: Array.isArray(data.items) ? data.items : [] };
  } catch (err) {
    return { ok: false, code: 'NAVER_FETCH_ERROR', message: err.message, items: [] };
  }
}

function scoreNaverItem(item, context) {
  const { sourceCanonicalUrl, targetProductId, productName, storeName } = context;
  const itemProductId = String(item?.productId || '');
  const itemUrl = canonicalizeUrl(item?.link || '');
  const itemTitle = normalizeText(item?.title || '');
  const itemStore = normalizeText(item?.mallName || '');

  let score = 0;

  if (targetProductId && itemProductId === targetProductId) score += 140;
  if (sourceCanonicalUrl && itemUrl === sourceCanonicalUrl) score += 120;

  const normalizedName = normalizeText(productName);
  if (normalizedName && itemTitle.includes(normalizedName.slice(0, Math.min(18, normalizedName.length)))) {
    score += 35;
  }

  const normalizedStore = normalizeText(storeName);
  if (normalizedStore && itemStore && (itemStore.includes(normalizedStore) || normalizedStore.includes(itemStore))) {
    score += 25;
  }

  if (toNumber(item?.lprice) > 0) score += 10;
  return score;
}

function buildNaverQueries(product) {
  const candidates = [
    String(product?.model || ''),
    String(product?.name || ''),
  ]
    .map((q) => q.trim())
    .filter(Boolean)
    .map((q) => q.split(' ').slice(0, 7).join(' '));

  return [...new Set(candidates)].slice(0, 2);
}

async function verifyWithNaverApi(store, product) {
  const sourceUrl = String(store.sourceUrl || store.url || '');
  if (!isNaverUrl(sourceUrl)) {
    return { ok: false, code: 'NOT_NAVER_OFFER', method: 'api' };
  }

  const targetProductId = String(product?._naverProductId || extractNaverProductId(sourceUrl) || '');
  const sourceCanonicalUrl = canonicalizeUrl(sourceUrl);
  const queries = buildNaverQueries(product);

  let best = null;
  let lastFailure = null;

  for (const query of queries) {
    const result = await fetchNaverItems(query, 50);
    if (!result.ok) {
      lastFailure = result;
      continue;
    }

    for (const item of result.items) {
      const score = scoreNaverItem(item, {
        sourceCanonicalUrl,
        targetProductId,
        productName: product?.name,
        storeName: store?.store,
      });

      if (!best || score > best.score) {
        best = { item, score };
      }
    }

    if (best?.score >= 120) break;
  }

  if (!best || best.score < 70) {
    return {
      ok: false,
      code: lastFailure?.code || 'NAVER_MATCH_NOT_FOUND',
      message: lastFailure?.message || '네이버 API에서 매칭 상품을 찾지 못했습니다.',
      method: 'api',
    };
  }

  const verifiedPrice = toNumber(best.item?.lprice);
  if (verifiedPrice <= 0) {
    return { ok: false, code: 'NAVER_PRICE_MISSING', message: '네이버 API 가격 없음', method: 'api' };
  }

  return {
    ok: true,
    method: 'api',
    price: verifiedPrice,
    source: 'naver_api',
    matchedProductId: String(best.item?.productId || ''),
  };
}

async function fetchCoupangProducts(keyword, limit = 50) {
  const accessKey = process.env.COUPANG_ACCESS_KEY;
  const secretKey = process.env.COUPANG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    return { ok: false, code: 'COUPANG_API_KEY_MISSING', items: [] };
  }

  const method = 'GET';
  const apiPath = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search';
  const query = `keyword=${encodeURIComponent(keyword)}&limit=${Math.max(1, Math.min(limit, 50))}`;

  try {
    await throttleApi('coupang');
    const authorization = buildCoupangAuthorization({ method, apiPath, query });
    if (!authorization) {
      return { ok: false, code: 'COUPANG_AUTH_BUILD_FAILED', items: [] };
    }

    const response = await withTimeout(fetch(`https://api-gateway.coupang.com${apiPath}?${query}`, {
      method,
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json;charset=UTF-8',
      },
    }), getVerificationTimeoutMs());

    if (!response.ok) {
      return { ok: false, code: `COUPANG_HTTP_${response.status}`, items: [] };
    }

    const data = await response.json();
    return { ok: true, items: data?.data?.productData || [] };
  } catch (err) {
    return { ok: false, code: 'COUPANG_FETCH_ERROR', message: err.message, items: [] };
  }
}

function scoreCoupangItem(item, context) {
  const { sourceCanonicalUrl, targetProductId, productName } = context;
  const itemProductId = String(item?.productId || '');
  const itemUrl = canonicalizeUrl(item?.productUrl || '');
  const itemTitle = normalizeText(item?.productName || '');
  const normalizedName = normalizeText(productName);

  let score = 0;
  if (targetProductId && itemProductId === targetProductId) score += 150;
  if (sourceCanonicalUrl && itemUrl === sourceCanonicalUrl) score += 120;

  if (normalizedName && itemTitle.includes(normalizedName.slice(0, Math.min(16, normalizedName.length)))) {
    score += 35;
  }

  if (toNumber(item?.productPrice) > 0) score += 10;
  return score;
}

function buildCoupangQueries(product) {
  const candidates = [
    String(product?.model || ''),
    String(product?.name || ''),
  ]
    .map((q) => q.trim())
    .filter(Boolean)
    .map((q) => q.split(' ').slice(0, 6).join(' '));

  return [...new Set(candidates)].slice(0, 2);
}

async function verifyWithCoupangApi(store, product) {
  const sourceUrl = String(store.sourceUrl || store.url || '');
  if (!isCoupangUrl(sourceUrl)) {
    return { ok: false, code: 'NOT_COUPANG_OFFER', method: 'api' };
  }

  const sourceCanonicalUrl = canonicalizeUrl(sourceUrl);
  const targetProductId = extractCoupangProductId(sourceUrl);
  const queries = buildCoupangQueries(product);

  let best = null;
  let lastFailure = null;

  for (const query of queries) {
    const result = await fetchCoupangProducts(query, 50);
    if (!result.ok) {
      lastFailure = result;
      continue;
    }

    for (const item of result.items) {
      const score = scoreCoupangItem(item, {
        sourceCanonicalUrl,
        targetProductId,
        productName: product?.name,
      });

      if (!best || score > best.score) {
        best = { item, score };
      }
    }

    if (best?.score >= 120) break;
  }

  if (!best || best.score < 70) {
    return {
      ok: false,
      code: lastFailure?.code || 'COUPANG_MATCH_NOT_FOUND',
      message: lastFailure?.message || '쿠팡 API 매칭 실패',
      method: 'api',
    };
  }

  const verifiedPrice = toNumber(best.item?.productPrice);
  if (verifiedPrice <= 0) {
    return { ok: false, code: 'COUPANG_PRICE_MISSING', message: '쿠팡 API 가격 없음', method: 'api' };
  }

  return {
    ok: true,
    method: 'api',
    price: verifiedPrice,
    source: 'coupang_api',
    matchedProductId: String(best.item?.productId || ''),
  };
}

function extractPriceCandidates(html) {
  const candidates = new Set();
  const add = (value) => {
    const num = toNumber(value);
    if (num > 0) candidates.add(num);
  };

  const patterns = [
    /property=["']product:price:amount["'][^>]*content=["']([\d,]+)["']/gi,
    /itemprop=["']price["'][^>]*content=["']([\d,]+)["']/gi,
    /["']salePrice["']\s*[:=]\s*["']?([\d,]{4,})["']?/gi,
    /["']discountedSalePrice["']\s*[:=]\s*["']?([\d,]{4,})["']?/gi,
    /["']mobileLowPrice["']\s*[:=]\s*["']?([\d,]{4,})["']?/gi,
    /["']lowPrice["']\s*[:=]\s*["']?([\d,]{4,})["']?/gi,
    /["']price["']\s*[:=]\s*["']?([\d,]{4,})["']?/gi,
    />([\d,]{4,})\s*원</gi,
  ];

  for (const pattern of patterns) {
    let matched;
    let count = 0;
    while ((matched = pattern.exec(html)) && count < 80) {
      add(matched[1]);
      count += 1;
    }
  }

  return [...candidates].sort((a, b) => a - b);
}

function pickBestCandidate(candidates, rawPrice) {
  if (!Array.isArray(candidates) || candidates.length === 0) return 0;

  const normalizedRaw = toNumber(rawPrice);
  if (normalizedRaw <= 0) return candidates[0];

  let best = 0;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const ratio = candidate / normalizedRaw;
    if (ratio < 0.4 || ratio > 2.5) continue;

    const distance = Math.abs(candidate - normalizedRaw);
    const score = -distance;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best || candidates[0];
}

function hasPersonalizedPriceHints(html) {
  const text = String(html || '').toLowerCase();
  return [
    '회원가',
    '회원 할인',
    '쿠폰가',
    '쿠폰 적용',
    '카드할인',
    '와우회원',
    '로그인 후',
    '최종 혜택가',
    '최대혜택가',
  ].some((keyword) => text.includes(keyword.toLowerCase()));
}

async function verifyWithBrowserFallback(store) {
  const sourceUrl = String(store.sourceUrl || store.url || '').trim();
  if (!isHttpUrl(sourceUrl)) {
    return { ok: false, code: 'INVALID_SOURCE_URL', message: '유효한 원본 URL 없음', method: 'browser' };
  }

  try {
    const response = await withTimeout(fetchWithUA(sourceUrl, { redirect: 'follow' }), getVerificationTimeoutMs());
    if (!response.ok) {
      return {
        ok: false,
        code: `BROWSER_HTTP_${response.status}`,
        message: `가격 페이지 요청 실패 (${response.status})`,
        method: 'browser',
      };
    }

    const html = await response.text();
    const candidates = extractPriceCandidates(html);
    const verifiedPrice = pickBestCandidate(candidates, store.rawPrice);

    if (verifiedPrice <= 0) {
      const personalized = hasPersonalizedPriceHints(html);
      return {
        ok: false,
        code: personalized ? 'PERSONALIZED_PRICE' : 'BROWSER_PRICE_NOT_FOUND',
        message: personalized
          ? '개인화/회원 전용 가격으로 고정 가격 검증이 어렵습니다.'
          : '브라우저 파서로 가격을 추출하지 못했습니다.',
        method: 'browser',
      };
    }

    return {
      ok: true,
      method: 'browser',
      price: verifiedPrice,
      source: 'browser_parser',
    };
  } catch (err) {
    return { ok: false, code: 'BROWSER_FETCH_ERROR', message: err.message, method: 'browser' };
  }
}

function isSupportedStore(store) {
  const sourceUrl = String(store?.sourceUrl || store?.url || '');
  return isNaverUrl(sourceUrl) || isCoupangUrl(sourceUrl);
}

async function runOfferVerification(store, product) {
  const startedAt = Date.now();
  const sourceUrl = String(store?.sourceUrl || store?.url || '');

  let primary = null;
  if (isNaverUrl(sourceUrl)) {
    primary = await verifyWithNaverApi(store, product);
  } else if (isCoupangUrl(sourceUrl)) {
    primary = await verifyWithCoupangApi(store, product);
  }

  if (primary?.ok) {
    return {
      ...primary,
      latencyMs: Date.now() - startedAt,
    };
  }

  const browser = await verifyWithBrowserFallback(store, product);
  if (browser.ok) {
    return {
      ...browser,
      latencyMs: Date.now() - startedAt,
    };
  }

  if (primary && !primary.ok) {
    return {
      ok: false,
      code: primary.code || browser.code || 'VERIFY_FAILED',
      message: primary.message || browser.message || '검증 실패',
      method: primary.method || browser.method || 'fallback',
      latencyMs: Date.now() - startedAt,
    };
  }

  return {
    ok: false,
    code: browser.code || 'VERIFY_FAILED',
    message: browser.message || '검증 실패',
    method: browser.method || 'fallback',
    latencyMs: Date.now() - startedAt,
  };
}

function applyVerificationSuccess(store, result) {
  const now = new Date().toISOString();
  const beforeDisplay = toNumber(store.displayPrice || store.verifiedPrice || store.rawPrice || store.price);
  const verifiedPrice = toNumber(result.price);
  const deltaPercent = computeDeltaPercent(beforeDisplay, verifiedPrice);

  store.verifiedPrice = verifiedPrice;
  store.verificationStatus = 'verified';
  store.verificationMethod = normalizeMethod(result.method, 'api');
  store.verifiedAt = now;
  store.freshUntil = getFreshUntilIso(now);
  store.displayPrice = verifiedPrice;
  store.priceState = 'verified_fresh';
  store.price = verifiedPrice;
  store.isActive = true;
  store.lastDeltaPercent = deltaPercent;
  if (beforeDisplay > 0 && verifiedPrice > 0 && beforeDisplay !== verifiedPrice) {
    store.mismatchCount = Math.max(0, parseInt(store.mismatchCount || '0', 10) || 0) + 1;
  }
  store.lastVerifyLatencyMs = Number.isFinite(Number(result?.latencyMs))
    ? Math.max(0, Math.round(Number(result.latencyMs)))
    : null;
  store.lastErrorCode = null;
  store.lastErrorMessage = null;
}

function applyVerificationFailure(store, result) {
  store.verificationStatus = 'failed';
  store.verificationMethod = normalizeMethod(result?.method, 'fallback');
  store.isActive = false;
  store.displayPrice = null;
  store.freshUntil = null;
  store.priceState = String(result?.code || '') === 'PERSONALIZED_PRICE' ? 'personalized' : 'unverified';
  store.lastVerifyLatencyMs = Number.isFinite(Number(result?.latencyMs))
    ? Math.max(0, Math.round(Number(result.latencyMs)))
    : null;
  store.lastErrorCode = String(result?.code || 'VERIFY_FAILED');
  store.lastErrorMessage = String(result?.message || '가격 검증 실패');
}

function markUnsupportedStore(store) {
  store.verificationStatus = 'failed';
  store.verificationMethod = 'fallback';
  store.isActive = false;
  store.lastErrorCode = 'UNSUPPORTED_STORE';
  store.lastErrorMessage = '현재 검증 어댑터 미지원 스토어';
}

function findOfferById(offerId) {
  for (const productType of PRODUCT_TYPES) {
    const catalog = readCatalogFile(productType);
    let changed = ensureCatalogOfferMetadata(catalog);

    for (const product of catalog.products || []) {
      for (const store of product.stores || []) {
        if (String(store.offerId) === String(offerId)) {
          if (changed) saveCatalogFile(productType, catalog);
          return { productType, catalog, product, store };
        }
      }
    }

    if (changed) saveCatalogFile(productType, catalog);
  }

  return null;
}

async function verifyOfferById(offerId, options = {}) {
  const trigger = options.trigger || 'manual';
  const force = options.force !== false;
  const strictGuard = options.strictGuard ?? isStrictPriceGuardEnabled();
  const allowUnverifiedRedirect = options.allowUnverifiedRedirect ?? (!strictGuard || isDegradedRedirectAllowed());
  const listedPrice = toNumber(options.listedPrice);
  const listedVerifiedAt = isIsoDate(options.listedVerifiedAt)
    ? new Date(options.listedVerifiedAt).toISOString()
    : null;

  const found = findOfferById(offerId);
  if (!found) {
    return {
      ok: false,
      offerId,
      verificationStatus: 'failed',
      code: 'OFFER_NOT_FOUND',
      message: '해당 offer를 찾을 수 없습니다.',
    };
  }

  const { productType, catalog, product, store } = found;

  if (ensureStoreOfferMetadata(product, store)) {
    saveCatalogFile(productType, catalog);
  }

  const beforeStatus = store.verificationStatus;
  const beforePrice = toNumber(store.verifiedPrice);
  const now = Date.now();
  const isFresh = isVerifiedFreshStore(store, now)
    && toNumber(store.verifiedPrice) > 0;

  if (!force && isFresh) {
    const currentPrice = toNumber(store.verifiedPrice);
    const priceChanged = listedPrice > 0 && currentPrice > 0 && listedPrice !== currentPrice;
    return {
      ok: true,
      offerId,
      productId: product.id,
      productType,
      verificationStatus: store.verificationStatus,
      verificationMethod: store.verificationMethod,
      verifiedPrice: toNumber(store.verifiedPrice),
      verifiedAt: store.verifiedAt,
      sourceUrl: store.sourceUrl,
      redirectUrl: store.affiliateUrl || store.sourceUrl,
      skipped: true,
      listedPrice: listedPrice || null,
      listedVerifiedAt,
      priceChanged,
      oldPrice: priceChanged ? listedPrice : null,
      newPrice: priceChanged ? currentPrice : null,
    };
  }

  if (!isSupportedStore(store)) {
    markUnsupportedStore(store);
    saveCatalogFile(productType, catalog);

    appendVerificationLog({
      timestamp: new Date().toISOString(),
      trigger,
      offerId,
      productId: product.id,
      productType,
      store: store.store,
      rawPrice: toNumber(store.rawPrice),
      beforeStatus,
      beforeVerifiedPrice: beforePrice,
      success: false,
      verificationStatus: store.verificationStatus,
      verificationMethod: store.verificationMethod,
      listedPrice: listedPrice || null,
      listedVerifiedAt,
      priceChanged: false,
      guarded: strictGuard,
      errorCode: store.lastErrorCode,
      errorMessage: store.lastErrorMessage,
      blocked: trigger === 'click' && !allowUnverifiedRedirect,
    });

    return {
      ok: false,
      offerId,
      productId: product.id,
      productType,
      verificationStatus: store.verificationStatus,
      verificationMethod: store.verificationMethod,
      code: store.lastErrorCode,
      message: store.lastErrorMessage,
      sourceUrl: store.sourceUrl,
      redirectUrl: allowUnverifiedRedirect ? (store.affiliateUrl || store.sourceUrl) : null,
      listedPrice: listedPrice || null,
      listedVerifiedAt,
      priceChanged: false,
      strictGuard,
    };
  }

  const result = await runOfferVerification(store, product);
  if (result.ok) {
    applyVerificationSuccess(store, result);
  } else {
    applyVerificationFailure(store, result);
  }

  saveCatalogFile(productType, catalog);

  const mismatch = result.ok
    ? (toNumber(store.rawPrice) > 0 && toNumber(store.verifiedPrice) > 0 && toNumber(store.rawPrice) !== toNumber(store.verifiedPrice))
    : false;
  const latestVerifiedPrice = toNumber(store.verifiedPrice);
  const priceChanged = result.ok
    ? (listedPrice > 0 && latestVerifiedPrice > 0 && listedPrice !== latestVerifiedPrice)
    : false;

  appendVerificationLog({
    timestamp: new Date().toISOString(),
    trigger,
    offerId,
    productId: product.id,
    productType,
    store: store.store,
    rawPrice: toNumber(store.rawPrice),
    beforeStatus,
    beforeVerifiedPrice: beforePrice,
    success: !!result.ok,
    verificationStatus: store.verificationStatus,
    verificationMethod: store.verificationMethod,
    verifiedPrice: toNumber(store.verifiedPrice),
    verifiedAt: store.verifiedAt,
    mismatch,
    listedPrice: listedPrice || null,
    listedVerifiedAt,
    priceChanged,
    guarded: strictGuard,
    errorCode: result.ok ? null : store.lastErrorCode,
    errorMessage: result.ok ? null : store.lastErrorMessage,
    blocked: trigger === 'click' && !result.ok && !allowUnverifiedRedirect,
  });

  return {
    ok: !!result.ok,
    offerId,
    productId: product.id,
    productType,
    verificationStatus: store.verificationStatus,
    verificationMethod: store.verificationMethod,
    verifiedPrice: toNumber(store.verifiedPrice),
    verifiedAt: store.verifiedAt,
    sourceUrl: store.sourceUrl,
    redirectUrl: (result.ok || allowUnverifiedRedirect) ? (store.affiliateUrl || store.sourceUrl) : null,
    code: result.ok ? null : store.lastErrorCode,
    message: result.ok ? null : store.lastErrorMessage,
    degradedRedirect: !result.ok && allowUnverifiedRedirect,
    listedPrice: listedPrice || null,
    listedVerifiedAt,
    priceChanged,
    oldPrice: priceChanged ? listedPrice : null,
    newPrice: priceChanged ? latestVerifiedPrice : null,
    strictGuard,
  };
}

async function verifyCatalogOffers(productType, options = {}) {
  if (!PRODUCT_TYPES.includes(productType)) {
    throw new Error(`알 수 없는 productType: ${productType}`);
  }

  const catalog = readCatalogFile(productType);
  let changed = ensureCatalogOfferMetadata(catalog);

  const limit = Math.max(1, parseInt(options.limit || '10000', 10) || 10000);
  const trigger = options.trigger || 'batch';
  const force = options.force === true;

  const summary = {
    productType,
    totalOffers: 0,
    attempted: 0,
    verified: 0,
    failed: 0,
    stale: 0,
    skipped: 0,
  };

  let processed = 0;

  for (const product of catalog.products || []) {
    for (const store of product.stores || []) {
      if (processed >= limit) break;
      processed += 1;
      summary.totalOffers += 1;

      if (!isSupportedStore(store)) {
        markUnsupportedStore(store);
        changed = true;
        summary.failed += 1;
        continue;
      }

      const now = Date.now();
      const isFresh = store.verificationStatus === 'verified'
        && store.verifiedAt
        && Number.isFinite(Date.parse(store.verifiedAt))
        && (now - Date.parse(store.verifiedAt)) <= getDisplayPriceFreshMs()
        && toNumber(store.verifiedPrice) > 0;

      if (!force && isFresh) {
        summary.skipped += 1;
        continue;
      }

      summary.attempted += 1;
      const result = await runOfferVerification(store, product);
      if (result.ok) {
        applyVerificationSuccess(store, result);
        summary.verified += 1;
      } else {
        applyVerificationFailure(store, result);
        summary.failed += 1;
      }
      changed = true;

      appendVerificationLog({
        timestamp: new Date().toISOString(),
        trigger,
        offerId: store.offerId,
        productId: product.id,
        productType,
        store: store.store,
        rawPrice: toNumber(store.rawPrice),
        success: !!result.ok,
        verificationStatus: store.verificationStatus,
        verificationMethod: store.verificationMethod,
        verifiedPrice: toNumber(store.verifiedPrice),
        verifiedAt: store.verifiedAt,
        mismatch: result.ok ? (toNumber(store.rawPrice) !== toNumber(store.verifiedPrice)) : false,
        errorCode: result.ok ? null : store.lastErrorCode,
        errorMessage: result.ok ? null : store.lastErrorMessage,
      });
    }

    if (processed >= limit) break;
  }

  for (const product of catalog.products || []) {
    for (const store of product.stores || []) {
      if (store.verificationStatus === 'stale') {
        summary.stale += 1;
      }
    }
  }

  if (changed) {
    saveCatalogFile(productType, catalog);
  }

  return summary;
}

async function verifyAllOffers(options = {}) {
  const summaries = [];
  for (const productType of PRODUCT_TYPES) {
    summaries.push(await verifyCatalogOffers(productType, options));
  }

  return summaries;
}

function toPublicStore(store, options = {}) {
  const nowMs = Number(options.nowMs) || Date.now();
  const strictGuard = options.strictGuard ?? isStrictPriceGuardEnabled();
  const verifiedPrice = toNumber(store.verifiedPrice);
  const priceState = getStorePriceState(store, nowMs);
  const displayPrice = getStoreDisplayPrice(store, nowMs);
  const source = inferSourceFromStore(store);
  const collectedAt = isIsoDate(store.collectedAt)
    ? new Date(store.collectedAt).toISOString()
    : (isIsoDate(store.updatedAt) ? new Date(store.updatedAt).toISOString() : null);
  const matchScore = Number.isFinite(Number(store.matchScore)) ? Math.max(0, Math.min(100, Number(store.matchScore))) : 0;
  const freshUntil = getFreshUntilIso(store.verifiedAt);
  const canClaimLowest = displayPrice !== null && priceState === 'verified_fresh';
  const priceToken = canClaimLowest
    ? createPriceToken({
        offerId: store.offerId,
        listedPrice: displayPrice,
        verifiedAt: store.verifiedAt,
      })
    : null;
  const redirectPath = `/r/${store.offerId}`;
  const redirectUrl = priceToken
    ? `${redirectPath}?priceToken=${encodeURIComponent(priceToken)}`
    : redirectPath;

  return {
    ...store,
    source,
    collectedAt,
    matchScore,
    displayPrice,
    display_price: displayPrice,
    priceState,
    price_state: priceState,
    freshUntil,
    fresh_until: freshUntil,
    canClaimLowest,
    clickPolicy: canClaimLowest
      ? 'recheck_required'
      : (strictGuard ? 'blocked' : 'recheck_required'),
    priceToken,
    price: displayPrice ?? 0,
    verifiedPrice,
    verifiedAt: store.verifiedAt || null,
    verificationStatus: normalizeStatus(store.verificationStatus, 'failed'),
    verificationMethod: normalizeMethod(store.verificationMethod, 'fallback'),
    url: redirectUrl,
    sourceUrl: String(store.sourceUrl || ''),
    isLowest: false,
  };
}

function normalizeStoreVisibility(value, fallback = 'all') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'verified') return 'verified';
  if (normalized === 'all') return 'all';
  return fallback;
}

function computeDiscount(original, current) {
  if (original > current && current > 0) {
    return {
      percent: Math.round(((original - current) / original) * 100),
      amount: original - current,
    };
  }
  return { percent: 0, amount: 0 };
}

function prepareCatalogForResponse(productType, options = {}) {
  const priceMode = String(options.priceMode || 'strict').trim().toLowerCase() || 'strict';
  const fallbackVisibility = isVerifiedOnlyMode() ? 'verified' : 'all';
  const hasLegacyVerifiedOnly = typeof options.verifiedOnly === 'boolean';
  const requestedVisibility = hasLegacyVerifiedOnly
    ? (options.verifiedOnly ? 'verified' : 'all')
    : normalizeStoreVisibility(options.storeVisibility, fallbackVisibility);
  const storeVisibility = normalizeStoreVisibility(requestedVisibility, fallbackVisibility);
  const verifiedOnly = storeVisibility === 'verified';
  const strictGuard = options.strictGuard ?? isStrictPriceGuardEnabled();
  const nowMs = Date.now();
  const catalog = readCatalogFile(productType);
  const changed = ensureCatalogOfferMetadata(catalog);

  if (changed) {
    saveCatalogFile(productType, catalog);
  }

  const products = [];

  for (const product of catalog.products || []) {
    const normalizedProduct = normalizeProductShape(productType, product);
    const stores = (normalizedProduct.stores || []).map((store) => toPublicStore(store, { nowMs, strictGuard }));

    const visibleStoresRaw = verifiedOnly
      ? stores.filter((store) => store.canClaimLowest && Number(store.displayPrice) > 0)
      : stores;

    if (visibleStoresRaw.length === 0 && verifiedOnly) {
      continue;
    }

    const visibleStores = [...visibleStoresRaw];
    visibleStores.sort((a, b) => {
      const aPrice = Number(a.displayPrice) > 0 ? Number(a.displayPrice) : Number.MAX_SAFE_INTEGER;
      const bPrice = Number(b.displayPrice) > 0 ? Number(b.displayPrice) : Number.MAX_SAFE_INTEGER;
      if (aPrice !== bPrice) return aPrice - bPrice;
      return String(a.store || '').localeCompare(String(b.store || ''));
    });

    const lowestStore = visibleStores.find((store) => store.canClaimLowest && Number(store.displayPrice) > 0);
    const lowest = Number(lowestStore?.displayPrice || 0);
    visibleStores.forEach((store) => {
      store.isLowest = !!lowestStore && store.offerId === lowestStore.offerId;
    });

    if (lowest <= 0 && verifiedOnly) {
      continue;
    }

    const originalBase = toNumber(normalizedProduct?.prices?.original);
    const original = lowest > 0 ? Math.max(originalBase, lowest) : originalBase;
    const discount = computeDiscount(original, lowest);

    const nextProduct = {
      ...normalizedProduct,
      priceMode,
      prices: {
        ...normalizedProduct.prices,
        current: lowest > 0 ? lowest : 0,
        original,
        lowest: lowest > 0
          ? Math.min(toNumber(normalizedProduct?.prices?.lowest) || lowest, lowest)
          : toNumber(normalizedProduct?.prices?.lowest),
        average: lowest > 0
          ? Math.max(toNumber(normalizedProduct?.prices?.average) || 0, lowest)
          : toNumber(normalizedProduct?.prices?.average),
      },
      discount,
      stores: visibleStores,
    };

    products.push(nextProduct);
  }

  return {
    ...catalog,
    products,
    priceMode,
    listingPriceTtlSec: getListingPriceTtlSec(),
    displayPriceFreshMinutes: getDisplayPriceFreshMinutes(),
    generatedAt: new Date(nowMs).toISOString(),
    strictGuard,
    storeVisibility,
    verifiedOnly,
  };
}

function readVerificationLogs(hours = 24) {
  if (!fs.existsSync(VERIFICATION_LOG_FILE)) return [];

  const since = Date.now() - (Math.max(1, hours) * 60 * 60 * 1000);
  const lines = fs.readFileSync(VERIFICATION_LOG_FILE, 'utf-8').split('\n').filter(Boolean);

  return lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((entry) => entry && Number.isFinite(Date.parse(entry.timestamp)) && Date.parse(entry.timestamp) >= since);
}

function collectCatalogVerificationStats() {
  const stats = {
    totalOffers: 0,
    verifiedOffers: 0,
    failedOffers: 0,
    staleOffers: 0,
    activeOffers: 0,
  };

  for (const productType of PRODUCT_TYPES) {
    const catalog = readCatalogFile(productType);
    ensureCatalogOfferMetadata(catalog);

    for (const product of catalog.products || []) {
      for (const store of product.stores || []) {
        stats.totalOffers += 1;
        if (store.verificationStatus === 'verified') stats.verifiedOffers += 1;
        if (store.verificationStatus === 'failed') stats.failedOffers += 1;
        if (store.verificationStatus === 'stale') stats.staleOffers += 1;
        if (store.isActive) stats.activeOffers += 1;
      }
    }
  }

  return stats;
}

function getVerificationMetrics(hours = 24) {
  const logs = readVerificationLogs(hours);
  const catalogStats = collectCatalogVerificationStats();

  const verificationAttempts = logs.length;
  const verificationSuccess = logs.filter((x) => x.success).length;

  const clickAttempts = logs.filter((x) => x.trigger === 'click').length;
  const clickMismatch = logs.filter((x) => x.trigger === 'click' && x.success && x.mismatch).length;
  const clickGuarded = logs.filter((x) => x.trigger === 'click' && x.priceChanged && x.guarded).length;
  const hardMismatch = logs.filter((x) => x.trigger === 'click' && x.success && x.mismatch && !x.guarded).length;
  const clickBlocked = logs.filter((x) => x.trigger === 'click' && x.blocked).length;
  const clickVerifyTimeout = logs.filter((x) => x.trigger === 'click' && String(x.errorCode || '').includes('TIMEOUT')).length;

  const metrics = {
    windowHours: hours,
    hard_mismatch_rate: clickAttempts > 0 ? hardMismatch / clickAttempts : 0,
    price_mismatch_rate: clickAttempts > 0 ? clickMismatch / clickAttempts : 0,
    price_mismatch_after_confirm: 0,
    verification_success_rate: verificationAttempts > 0 ? verificationSuccess / verificationAttempts : 0,
    stale_offer_rate: catalogStats.totalOffers > 0 ? catalogStats.staleOffers / catalogStats.totalOffers : 0,
    redirect_block_rate: clickAttempts > 0 ? clickBlocked / clickAttempts : 0,
    click_verify_timeout_rate: clickAttempts > 0 ? clickVerifyTimeout / clickAttempts : 0,
    totals: {
      verificationAttempts,
      verificationSuccess,
      clickAttempts,
      clickMismatch,
      clickGuarded,
      hardMismatch,
      clickBlocked,
      clickVerifyTimeout,
      ...catalogStats,
    },
  };

  return metrics;
}

async function drainVerificationQueue() {
  if (queueRunning) return;
  queueRunning = true;

  while (verificationQueue.length > 0) {
    const job = verificationQueue.shift();
    try {
      let result;
      if (job.type === 'offer') {
        result = await verifyOfferById(job.offerId, job.options);
      } else if (job.type === 'batch-all') {
        result = await verifyAllOffers(job.options);
      } else {
        result = await verifyCatalogOffers(job.productType, job.options);
      }
      job.resolve(result);
    } catch (err) {
      job.resolve({ ok: false, error: err.message });
    }
  }

  queueRunning = false;
}

function enqueueOfferVerification(offerId, options = {}) {
  return new Promise((resolve) => {
    verificationQueue.push({ type: 'offer', offerId, options, resolve });
    drainVerificationQueue();
  });
}

function enqueueBatchVerification(productType, options = {}) {
  return new Promise((resolve) => {
    if (productType) {
      verificationQueue.push({ type: 'batch-single', productType, options, resolve });
    } else {
      verificationQueue.push({ type: 'batch-all', options, resolve });
    }
    drainVerificationQueue();
  });
}

module.exports = {
  PRODUCT_TYPES,
  ensureVerificationStorage,
  isVerifiedOnlyMode,
  isClickTimeVerifyEnabled,
  isStrictPriceGuardEnabled,
  isDegradedRedirectAllowed,
  getStaleMinutes,
  getVerificationTimeoutMs,
  getClickVerifyTimeoutMs,
  getListingPriceTtlSec,
  getDisplayPriceFreshMinutes,
  prepareCatalogForResponse,
  verifyOfferById,
  verifyCatalogOffers,
  verifyAllOffers,
  createPriceToken,
  verifyPriceToken,
  createConfirmToken,
  verifyConfirmToken,
  enqueueOfferVerification,
  enqueueBatchVerification,
  getVerificationMetrics,
};
