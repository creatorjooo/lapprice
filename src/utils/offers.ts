import type { StorePrice } from '@/types';

export function getStoreHref(store: StorePrice): string {
  return store.url || store.sourceUrl || '#';
}

export function getStoreTrackingUrl(store: StorePrice): string {
  return store.sourceUrl || store.url || '';
}

export function getStoreDisplayPrice(store: StorePrice): number | null {
  const display = Number(store.displayPrice);
  if (Number.isFinite(display) && display > 0) return Math.round(display);
  return null;
}

export function getStoreSortPrice(store: StorePrice): number {
  const displayPrice = getStoreDisplayPrice(store);
  return displayPrice !== null ? displayPrice : Number.MAX_SAFE_INTEGER;
}

export function getStoreVerifiedPrice(store: StorePrice): number {
  const displayPrice = getStoreDisplayPrice(store);
  if (displayPrice !== null) return displayPrice;
  return 0;
}

export function isStoreVerified(store: StorePrice): boolean {
  return store.priceState === 'verified_fresh' || store.verificationStatus === 'verified';
}

export function canShowStorePrice(store: StorePrice): boolean {
  return getStoreDisplayPrice(store) !== null;
}
