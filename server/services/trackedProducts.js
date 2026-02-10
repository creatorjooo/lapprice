const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CATALOG_HISTORY_DIR = path.join(__dirname, '..', 'data', 'catalog', 'history');
const TRACKED_PRODUCTS_PATH = path.join(DATA_DIR, 'tracked-products.json');

function ensureTrackedStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CATALOG_HISTORY_DIR)) {
    fs.mkdirSync(CATALOG_HISTORY_DIR, { recursive: true });
  }
  if (!fs.existsSync(TRACKED_PRODUCTS_PATH)) {
    fs.writeFileSync(TRACKED_PRODUCTS_PATH, '[]', 'utf-8');
  }
}

function loadTrackedProducts() {
  ensureTrackedStorage();
  try {
    return JSON.parse(fs.readFileSync(TRACKED_PRODUCTS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveTrackedProducts(items) {
  ensureTrackedStorage();
  fs.writeFileSync(TRACKED_PRODUCTS_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9가-힣]/g, '');
}

function getHistoryPath(trackedId) {
  return path.join(CATALOG_HISTORY_DIR, `${trackedId}.json`);
}

function getTrackedPriceHistory(trackedId) {
  const filePath = getHistoryPath(trackedId);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {
    return [];
  }
  return [];
}

function recordTrackedPriceHistory(trackedId, price, store) {
  const today = new Date().toISOString().split('T')[0];
  const filePath = getHistoryPath(trackedId);
  let history = getTrackedPriceHistory(trackedId);

  const todayEntry = history.find((h) => h.date === today);
  if (todayEntry) {
    if (todayEntry.price !== price) {
      todayEntry.price = price;
      todayEntry.store = store;
    } else {
      return;
    }
  } else {
    history.push({ date: today, price, store });
  }

  if (history.length > 365) {
    history = history.slice(-365);
  }

  fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf-8');
}

function pickBestMatch(products, targetTitle, targetLink) {
  if (!Array.isArray(products) || products.length === 0) return null;

  const normalizedTitle = normalizeText(targetTitle);
  const byLink = products.find((p) => p.link && targetLink && p.link === targetLink);
  if (byLink) return byLink;

  let best = products[0];
  let bestScore = -1;

  for (const product of products) {
    const currentTitle = normalizeText(product.title);
    let score = 0;

    if (normalizedTitle && currentTitle === normalizedTitle) score += 100;
    if (normalizedTitle && currentTitle.includes(normalizedTitle)) score += 60;
    if (normalizedTitle && normalizedTitle.includes(currentTitle)) score += 40;
    if (product.link && targetLink && product.link.includes(targetLink)) score += 30;
    if (product.price > 0) score += 10;

    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  }

  return best;
}

async function refreshTrackedProduct(item, apiBaseUrl) {
  const params = new URLSearchParams({
    query: item.query || item.title,
    limit: '30',
  });

  if (item.productType && ['laptop', 'monitor', 'desktop'].includes(item.productType)) {
    params.set('type', item.productType);
  }

  const response = await fetch(`${apiBaseUrl}/api/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`검색 API 실패: ${response.status}`);
  }

  const data = await response.json();
  const sourceResult = (data || []).find((r) => r.source === item.source && Array.isArray(r.products));
  if (!sourceResult || !sourceResult.products || sourceResult.products.length === 0) {
    return { updated: false, reason: 'source_empty' };
  }

  const matched = pickBestMatch(sourceResult.products, item.title, item.link);
  if (!matched || !matched.price || matched.price <= 0) {
    return { updated: false, reason: 'match_missing' };
  }

  const prevPrice = item.lastPrice || 0;
  const priceChanged = prevPrice !== matched.price;

  item.title = matched.title || item.title;
  item.link = matched.link || item.link;
  item.image = matched.image || item.image || '';
  item.mallName = matched.mallName || item.mallName || '';
  item.lastPrice = matched.price;
  item.lastOriginalPrice = matched.originalPrice || matched.price;
  item.updatedAt = new Date().toISOString();
  item.lastCheckedAt = new Date().toISOString();

  if (priceChanged || getTrackedPriceHistory(item.id).length === 0) {
    recordTrackedPriceHistory(item.id, item.lastPrice, item.mallName || item.source);
  }

  return { updated: true, priceChanged };
}

function listTrackedProducts() {
  const items = loadTrackedProducts();
  return items.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
}

function addTrackedProduct(input) {
  const items = loadTrackedProducts();
  const seed = `${input.source || 'unknown'}:${input.link || input.title || input.query || ''}`;
  const id = `tracked_${hashString(seed)}`;

  const existing = items.find((i) => i.id === id);
  if (existing) {
    existing.isActive = true;
    existing.updatedAt = new Date().toISOString();
    saveTrackedProducts(items);
    return existing;
  }

  const now = new Date().toISOString();
  const tracked = {
    id,
    source: input.source,
    productType: input.productType || 'laptop',
    query: input.query || input.title || '',
    title: input.title || '',
    link: input.link || '',
    image: input.image || '',
    mallName: input.mallName || '',
    lastPrice: input.price || 0,
    lastOriginalPrice: input.originalPrice || input.price || 0,
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: null,
    isActive: true,
  };

  items.push(tracked);
  saveTrackedProducts(items);
  if (tracked.lastPrice > 0) {
    recordTrackedPriceHistory(tracked.id, tracked.lastPrice, tracked.mallName || tracked.source);
  }
  return tracked;
}

function deleteTrackedProduct(trackedId) {
  const items = loadTrackedProducts();
  const next = items.filter((x) => x.id !== trackedId);
  if (next.length === items.length) return false;
  saveTrackedProducts(next);
  return true;
}

function getTrackedProduct(trackedId) {
  const items = loadTrackedProducts();
  return items.find((x) => x.id === trackedId) || null;
}

async function refreshAllTrackedProducts(apiBaseUrl) {
  ensureTrackedStorage();
  const items = loadTrackedProducts();
  let checked = 0;
  let updated = 0;
  let changed = 0;

  for (const item of items) {
    if (!item.isActive) continue;
    checked += 1;
    try {
      const result = await refreshTrackedProduct(item, apiBaseUrl);
      if (result.updated) {
        updated += 1;
      }
      if (result.priceChanged) {
        changed += 1;
      }
    } catch {
      item.lastCheckedAt = new Date().toISOString();
    }
  }

  saveTrackedProducts(items);
  return { checked, updated, changed };
}

module.exports = {
  ensureTrackedStorage,
  listTrackedProducts,
  addTrackedProduct,
  deleteTrackedProduct,
  getTrackedProduct,
  getTrackedPriceHistory,
  refreshAllTrackedProducts,
};
