import type { StorePrice } from '@/types';

export function getStoreHref(store: StorePrice): string {
  return store.url || store.sourceUrl || '#';
}

export function getStoreTrackingUrl(store: StorePrice): string {
  return store.sourceUrl || store.url || '';
}

export function getStoreVerifiedPrice(store: StorePrice): number {
  const candidate = Number(store.verifiedPrice);
  if (Number.isFinite(candidate) && candidate > 0) return Math.round(candidate);
  const price = Number(store.price);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : 0;
}

export function isStoreVerified(store: StorePrice): boolean {
  return store.verificationStatus === 'verified';
}
