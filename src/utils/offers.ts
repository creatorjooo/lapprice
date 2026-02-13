import type { StorePrice } from '@/types';

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isSearchLikeUrl(value: string): boolean {
  const raw = String(value || '').trim();
  if (!isHttpUrl(raw)) return false;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const queryKeys = [...parsed.searchParams.keys()].map((key) => key.toLowerCase());

    if (queryKeys.some((key) => ['q', 'query', 'keyword', 'k', 'search', 'sort', 'page'].includes(key))) {
      return true;
    }
    if (host.includes('search.shopping.naver.com') && path.includes('/search/')) return true;
    if (host.endsWith('coupang.com') && path.startsWith('/np/search')) return true;
    if (path.includes('/search')) return true;
    return false;
  } catch {
    return false;
  }
}

export function getStoreHref(store: StorePrice): string {
  const blockedByPolicy = store.clickPolicy === 'blocked'
    || store.urlQuality === 'search'
    || store.url_quality === 'search'
    || store.isPdpUrl === false;
  if (blockedByPolicy) return '';

  const routed = String(store.url || '').trim();
  if (routed.startsWith('/r/')) return routed;
  if (store.offerId) return `/r/${store.offerId}`;

  const candidates = [
    store.pdpUrl,
    store.pdp_url,
    store.resolvedProductUrl,
    store.affiliateUrl,
    store.sourceUrl,
    routed,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (!isHttpUrl(candidate)) continue;
    if (isSearchLikeUrl(candidate)) continue;
    return candidate;
  }

  return '';
}

export function getStoreTrackingUrl(store: StorePrice): string {
  return store.sourceUrl || store.pdpUrl || store.resolvedProductUrl || store.affiliateUrl || store.url || '';
}

export function getStoreDisplayPrice(store: StorePrice): number | null {
  const display = Number(store.displayPrice ?? store.display_price);
  if (Number.isFinite(display) && display > 0) return Math.round(display);
  return null;
}

export function getStoreSortPrice(store: StorePrice): number {
  const displayPrice = getStoreDisplayPrice(store);
  if (displayPrice !== null) return displayPrice;
  const verified = Number(store.verifiedPrice);
  if (Number.isFinite(verified) && verified > 0) return Math.round(verified);
  const raw = Number(store.rawPrice ?? store.raw_price);
  if (Number.isFinite(raw) && raw > 0) return Math.round(raw);
  const price = Number(store.price);
  if (Number.isFinite(price) && price > 0) return Math.round(price);
  return price > 0 ? price : Number.MAX_SAFE_INTEGER;
}

export function getStoreVerifiedPrice(store: StorePrice): number {
  const displayPrice = getStoreDisplayPrice(store);
  if (displayPrice !== null) return displayPrice;
  const priceState = String(store.priceState || store.price_state || '').toLowerCase();
  if (priceState === 'verified_stale' || store.verificationStatus === 'verified') {
    const verified = Number(store.verifiedPrice);
    if (Number.isFinite(verified) && verified > 0) return Math.round(verified);
  }
  const raw = Number(store.rawPrice ?? store.raw_price);
  if (Number.isFinite(raw) && raw > 0) return Math.round(raw);
  const price = Number(store.price);
  if (Number.isFinite(price) && price > 0) return Math.round(price);
  return 0;
}

export function isStoreVerified(store: StorePrice): boolean {
  return store.priceState === 'verified_fresh' || store.price_state === 'verified_fresh';
}

export function canShowStorePrice(store: StorePrice): boolean {
  return getStoreVerifiedPrice(store) > 0;
}
