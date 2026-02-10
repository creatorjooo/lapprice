import { useState, useEffect, useCallback } from 'react';
import type { Product, ProductType, PriceHistory, StorePrice, Laptop, Monitor, Desktop } from '@/types';
import { laptops as staticLaptops } from '@/data/laptops';
import { monitors as staticMonitors } from '@/data/monitors';
import { desktops as staticDesktops } from '@/data/desktops';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const CACHE_KEY_PREFIX = 'lapprice_products_';
const CACHE_TTL = 5 * 60 * 1000; // 5분 캐시

type PriceBlock = Product['prices'];

const LAPTOP_CATEGORIES: Laptop['category'][] = ['gaming', 'ultrabook', 'business', 'creator', 'budget', 'apple'];
const MONITOR_CATEGORIES: Monitor['category'][] = ['gaming', 'professional', 'ultrawide', 'general', 'portable'];
const DESKTOP_CATEGORIES: Desktop['category'][] = ['gaming', 'workstation', 'minipc', 'allinone', 'office', 'mac', 'creator'];
const MONITOR_PANEL_TYPES: Monitor['specs']['panelType'][] = ['IPS', 'VA', 'OLED', 'TN', 'Mini LED', 'QD-OLED', 'IPS Black'];
const CPU_TYPES: Laptop['specs']['cpuType'][] = ['intel', 'amd', 'apple'];
const STOCK_TYPES: Laptop['stock'][] = ['in', 'low', 'out'];

const DEFAULT_LAPTOP_TEMPLATE = staticLaptops[0]!;
const DEFAULT_MONITOR_TEMPLATE = staticMonitors[0]!;
const DEFAULT_DESKTOP_TEMPLATE = staticDesktops[0]!;

const toFiniteNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeString = (value: unknown, fallback = '') => {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
};

const toStringArray = (value: unknown, fallback: string[] = []) => {
  if (!Array.isArray(value)) return [...fallback];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

const isLaptopCategory = (value: unknown): value is Laptop['category'] => {
  return typeof value === 'string' && LAPTOP_CATEGORIES.includes(value as Laptop['category']);
};

const isMonitorCategory = (value: unknown): value is Monitor['category'] => {
  return typeof value === 'string' && MONITOR_CATEGORIES.includes(value as Monitor['category']);
};

const isDesktopCategory = (value: unknown): value is Desktop['category'] => {
  return typeof value === 'string' && DESKTOP_CATEGORIES.includes(value as Desktop['category']);
};

const isStockType = (value: unknown): value is Laptop['stock'] => {
  return typeof value === 'string' && STOCK_TYPES.includes(value as Laptop['stock']);
};

const isCpuType = (value: unknown): value is Laptop['specs']['cpuType'] => {
  return typeof value === 'string' && CPU_TYPES.includes(value as Laptop['specs']['cpuType']);
};

const isPanelType = (value: unknown): value is Monitor['specs']['panelType'] => {
  return typeof value === 'string' && MONITOR_PANEL_TYPES.includes(value as Monitor['specs']['panelType']);
};

const normalizeStores = (stores: unknown, fallback: StorePrice[]): StorePrice[] => {
  if (!Array.isArray(stores)) return [...fallback];
  const normalized = stores.filter((store): store is StorePrice => {
    if (!store || typeof store !== 'object') return false;
    const candidate = store as Partial<StorePrice>;
    return typeof candidate.store === 'string' && typeof candidate.url === 'string';
  });
  return normalized.length > 0 ? normalized : [...fallback];
};

const normalizePrices = (prices: unknown, fallback: PriceBlock, storePrice = 0): PriceBlock => {
  const raw = (prices && typeof prices === 'object' ? prices : {}) as Partial<PriceBlock>;
  const current = Math.max(0, toFiniteNumber(raw.current, storePrice > 0 ? storePrice : fallback.current));
  const original = Math.max(current, toFiniteNumber(raw.original, fallback.original));
  const lowest = Math.max(0, toFiniteNumber(raw.lowest, current || fallback.lowest || original));
  const average = Math.max(current, toFiniteNumber(raw.average, fallback.average));

  return {
    original,
    current,
    lowest: lowest > 0 ? Math.min(lowest, current || lowest) : current,
    average,
  };
};

const normalizeDiscount = (
  discount: unknown,
  prices: PriceBlock,
  fallback: { percent: number; amount: number }
) => {
  const raw = (discount && typeof discount === 'object'
    ? discount
    : {}) as Partial<{ percent: number; amount: number }>;
  const computedAmount = Math.max(0, prices.original - prices.current);
  const computedPercent = prices.original > prices.current
    ? Math.round((computedAmount / prices.original) * 100)
    : 0;

  return {
    percent: Math.max(0, toFiniteNumber(raw.percent, computedPercent || fallback.percent)),
    amount: Math.max(0, toFiniteNumber(raw.amount, computedAmount || fallback.amount)),
  };
};

const normalizeRating = (
  rating: unknown,
  fallback: { score: number; count: number }
) => {
  const raw = (rating && typeof rating === 'object'
    ? rating
    : {}) as Partial<{ score: number; count: number }>;
  return {
    score: toFiniteNumber(raw.score, fallback.score),
    count: Math.max(0, Math.round(toFiniteNumber(raw.count, fallback.count))),
  };
};

const pickLaptopTemplate = (product: Partial<Laptop>): Laptop => {
  if (isLaptopCategory(product.category)) {
    return staticLaptops.find((item) => item.category === product.category) || DEFAULT_LAPTOP_TEMPLATE;
  }
  return DEFAULT_LAPTOP_TEMPLATE;
};

const pickMonitorTemplate = (product: Partial<Monitor>): Monitor => {
  if (isMonitorCategory(product.category)) {
    return staticMonitors.find((item) => item.category === product.category) || DEFAULT_MONITOR_TEMPLATE;
  }
  return DEFAULT_MONITOR_TEMPLATE;
};

const pickDesktopTemplate = (product: Partial<Desktop>): Desktop => {
  if (isDesktopCategory(product.category)) {
    return staticDesktops.find((item) => item.category === product.category) || DEFAULT_DESKTOP_TEMPLATE;
  }
  return DEFAULT_DESKTOP_TEMPLATE;
};

const normalizeLaptopProduct = (product: Partial<Laptop>): Laptop => {
  const template = pickLaptopTemplate(product);
  const rawSpecs = (product.specs ?? {}) as Partial<Laptop['specs']>;
  const stores = normalizeStores(product.stores, template.stores);
  const prices = normalizePrices(product.prices, template.prices, stores[0]?.price || 0);
  const normalizedCpu = toSafeString(rawSpecs.cpu, template.specs.cpu);

  const cpuType: Laptop['specs']['cpuType'] = isCpuType(rawSpecs.cpuType)
    ? rawSpecs.cpuType
    : normalizedCpu.toLowerCase().includes('ryzen')
      ? 'amd'
      : normalizedCpu.toLowerCase().includes('m') || normalizedCpu.toLowerCase().includes('apple')
        ? 'apple'
        : template.specs.cpuType;

  return {
    ...template,
    ...product,
    id: toSafeString(product.id, template.id),
    productType: 'laptop',
    brand: toSafeString(product.brand, template.brand),
    name: toSafeString(product.name, template.name),
    model: toSafeString(product.model, toSafeString(product.name, template.model)),
    category: isLaptopCategory(product.category) ? product.category : template.category,
    specs: {
      cpu: normalizedCpu,
      cpuType,
      gpu: toSafeString(rawSpecs.gpu, template.specs.gpu),
      ram: Math.max(4, toFiniteNumber(rawSpecs.ram, template.specs.ram)),
      ramType: toSafeString(rawSpecs.ramType, template.specs.ramType),
      storage: Math.max(64, toFiniteNumber(rawSpecs.storage, template.specs.storage)),
      storageType: toSafeString(rawSpecs.storageType, template.specs.storageType),
      display: toSafeString(rawSpecs.display, template.specs.display),
      displaySize: Math.max(10, toFiniteNumber(rawSpecs.displaySize, template.specs.displaySize)),
      weight: Math.max(0.6, toFiniteNumber(rawSpecs.weight, template.specs.weight)),
      battery: toSafeString(rawSpecs.battery, template.specs.battery),
    },
    prices,
    discount: normalizeDiscount(product.discount, prices, template.discount),
    priceIndex: Math.max(0, toFiniteNumber(product.priceIndex, template.priceIndex)),
    stores,
    rating: normalizeRating(product.rating, template.rating),
    reviews: Array.isArray(product.reviews) ? product.reviews : template.reviews,
    stock: isStockType(product.stock) ? product.stock : template.stock,
    isNew: typeof product.isNew === 'boolean' ? product.isNew : template.isNew,
    isHot: typeof product.isHot === 'boolean' ? product.isHot : template.isHot,
    releaseDate: toSafeString(product.releaseDate, template.releaseDate),
    images: toStringArray(product.images, template.images),
    tags: toStringArray(product.tags, template.tags),
  };
};

const normalizeMonitorProduct = (product: Partial<Monitor>): Monitor => {
  const template = pickMonitorTemplate(product);
  const rawSpecs = (product.specs ?? {}) as Partial<Monitor['specs']>;
  const stores = normalizeStores(product.stores, template.stores);
  const prices = normalizePrices(product.prices, template.prices, stores[0]?.price || 0);

  return {
    ...template,
    ...product,
    id: toSafeString(product.id, template.id),
    productType: 'monitor',
    brand: toSafeString(product.brand, template.brand),
    name: toSafeString(product.name, template.name),
    model: toSafeString(product.model, toSafeString(product.name, template.model)),
    category: isMonitorCategory(product.category) ? product.category : template.category,
    specs: {
      panelType: isPanelType(rawSpecs.panelType) ? rawSpecs.panelType : template.specs.panelType,
      resolution: toSafeString(rawSpecs.resolution, template.specs.resolution),
      resolutionLabel: toSafeString(rawSpecs.resolutionLabel, template.specs.resolutionLabel),
      refreshRate: Math.max(60, toFiniteNumber(rawSpecs.refreshRate, template.specs.refreshRate)),
      responseTime: toSafeString(rawSpecs.responseTime, template.specs.responseTime),
      screenSize: Math.max(16, toFiniteNumber(rawSpecs.screenSize, template.specs.screenSize)),
      aspectRatio: toSafeString(rawSpecs.aspectRatio, template.specs.aspectRatio),
      hdr: toSafeString(rawSpecs.hdr, template.specs.hdr),
      colorGamut: toSafeString(rawSpecs.colorGamut, template.specs.colorGamut),
      ports: Array.isArray(rawSpecs.ports) ? rawSpecs.ports : template.specs.ports,
      speakers: typeof rawSpecs.speakers === 'boolean' ? rawSpecs.speakers : template.specs.speakers,
      heightAdjust: typeof rawSpecs.heightAdjust === 'boolean' ? rawSpecs.heightAdjust : template.specs.heightAdjust,
      pivot: typeof rawSpecs.pivot === 'boolean' ? rawSpecs.pivot : template.specs.pivot,
      vesa: typeof rawSpecs.vesa === 'boolean' ? rawSpecs.vesa : template.specs.vesa,
      curved: typeof rawSpecs.curved === 'boolean' ? rawSpecs.curved : template.specs.curved,
      curvature: rawSpecs.curvature || template.specs.curvature,
    },
    prices,
    discount: normalizeDiscount(product.discount, prices, template.discount),
    priceIndex: Math.max(0, toFiniteNumber(product.priceIndex, template.priceIndex)),
    stores,
    rating: normalizeRating(product.rating, template.rating),
    reviews: Array.isArray(product.reviews) ? product.reviews : template.reviews,
    stock: isStockType(product.stock) ? product.stock : template.stock,
    isNew: typeof product.isNew === 'boolean' ? product.isNew : template.isNew,
    isHot: typeof product.isHot === 'boolean' ? product.isHot : template.isHot,
    releaseDate: toSafeString(product.releaseDate, template.releaseDate),
    images: toStringArray(product.images, template.images),
    tags: toStringArray(product.tags, template.tags),
  };
};

const normalizeDesktopProduct = (product: Partial<Desktop>): Desktop => {
  const template = pickDesktopTemplate(product);
  const rawSpecs = (product.specs ?? {}) as Partial<Desktop['specs']>;
  const stores = normalizeStores(product.stores, template.stores);
  const prices = normalizePrices(product.prices, template.prices, stores[0]?.price || 0);
  const normalizedCpu = toSafeString(rawSpecs.cpu, template.specs.cpu);

  const cpuType: Desktop['specs']['cpuType'] = isCpuType(rawSpecs.cpuType)
    ? rawSpecs.cpuType
    : normalizedCpu.toLowerCase().includes('ryzen')
      ? 'amd'
      : normalizedCpu.toLowerCase().includes('m') || normalizedCpu.toLowerCase().includes('apple')
        ? 'apple'
        : template.specs.cpuType;

  return {
    ...template,
    ...product,
    id: toSafeString(product.id, template.id),
    productType: 'desktop',
    brand: toSafeString(product.brand, template.brand),
    name: toSafeString(product.name, template.name),
    model: toSafeString(product.model, toSafeString(product.name, template.model)),
    category: isDesktopCategory(product.category) ? product.category : template.category,
    specs: {
      cpu: normalizedCpu,
      cpuType,
      gpu: toSafeString(rawSpecs.gpu, template.specs.gpu),
      ram: Math.max(4, toFiniteNumber(rawSpecs.ram, template.specs.ram)),
      ramType: toSafeString(rawSpecs.ramType, template.specs.ramType),
      storage: Math.max(128, toFiniteNumber(rawSpecs.storage, template.specs.storage)),
      storageType: toSafeString(rawSpecs.storageType, template.specs.storageType),
      formFactor: toSafeString(rawSpecs.formFactor, template.specs.formFactor),
      psu: toSafeString(rawSpecs.psu, template.specs.psu),
      os: toSafeString(rawSpecs.os, template.specs.os),
      includedMonitor: rawSpecs.includedMonitor || template.specs.includedMonitor,
      expansion: Array.isArray(rawSpecs.expansion) ? rawSpecs.expansion : template.specs.expansion,
    },
    prices,
    discount: normalizeDiscount(product.discount, prices, template.discount),
    priceIndex: Math.max(0, toFiniteNumber(product.priceIndex, template.priceIndex)),
    stores,
    rating: normalizeRating(product.rating, template.rating),
    reviews: Array.isArray(product.reviews) ? product.reviews : template.reviews,
    stock: isStockType(product.stock) ? product.stock : template.stock,
    isNew: typeof product.isNew === 'boolean' ? product.isNew : template.isNew,
    isHot: typeof product.isHot === 'boolean' ? product.isHot : template.isHot,
    releaseDate: toSafeString(product.releaseDate, template.releaseDate),
    images: toStringArray(product.images, template.images),
    tags: toStringArray(product.tags, template.tags),
  };
};

const normalizeProductsForUi = (productType: ProductType, products: Product[]): Product[] => {
  switch (productType) {
    case 'laptop':
      return products.map((product) => normalizeLaptopProduct(product as Partial<Laptop>));
    case 'monitor':
      return products.map((product) => normalizeMonitorProduct(product as Partial<Monitor>));
    case 'desktop':
      return products.map((product) => normalizeDesktopProduct(product as Partial<Desktop>));
    default:
      return products;
  }
};

interface ProductsResponse {
  type: string;
  total: number;
  verifiedOnly?: boolean;
  lastSync: string | null;
  syncCount: number;
  stats: {
    total: number;
    autoGenerated: number;
    manual: number;
    added: number;
    updated: number;
  } | null;
  products: Product[];
}

interface UseProductsResult<T extends Product> {
  products: T[];
  isLoading: boolean;
  isFromApi: boolean;
  lastSync: string | null;
  totalCount: number;
  error: string | null;
  refresh: () => void;
}

/**
 * 상품 데이터를 API에서 자동 로드하는 훅
 * API 실패 시 정적 데이터로 fallback
 */
export function useProducts<T extends Product = Product>(
  productType: ProductType,
  options?: {
    category?: string;
    enabled?: boolean;
    verifiedOnly?: boolean;
  }
): UseProductsResult<T> {
  const [products, setProducts] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFromApi, setIsFromApi] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const { category, enabled = true, verifiedOnly = true } = options || {};

  // 정적 데이터 fallback
  const getStaticData = useCallback((): T[] => {
    switch (productType) {
      case 'laptop': return staticLaptops as unknown as T[];
      case 'monitor': return staticMonitors as unknown as T[];
      case 'desktop': return staticDesktops as unknown as T[];
      default: return [];
    }
  }, [productType]);

  // 로컬 캐시 확인
  const getCachedProducts = useCallback((): ProductsResponse | null => {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${productType}_${category || 'all'}_${verifiedOnly ? 'verified' : 'all'}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_TTL) {
        sessionStorage.removeItem(cacheKey);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }, [productType, category, verifiedOnly]);

  // 캐시 저장
  const setCachedProducts = useCallback((data: ProductsResponse) => {
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${productType}_${category || 'all'}_${verifiedOnly ? 'verified' : 'all'}`;
      sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    } catch { /* sessionStorage 꽉 찬 경우 무시 */ }
  }, [productType, category, verifiedOnly]);

  // API에서 상품 로드
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function fetchProducts() {
      setIsLoading(true);
      setError(null);

      // 1. 로컬 캐시 확인 (refresh 시 스킵)
      if (refreshVersion === 0) {
        const cached = getCachedProducts();
        if (cached) {
          const normalizedCachedProducts = normalizeProductsForUi(productType, cached.products);
          setProducts(normalizedCachedProducts as T[]);
          setIsFromApi(true);
          setLastSync(cached.lastSync);
          setTotalCount(normalizedCachedProducts.length);
          setIsLoading(false);
          return;
        }
      }

      // 2. API 호출 시도 — AbortController로 브라우저 호환성 확보
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const params = new URLSearchParams({ type: productType, limit: '200' });
        if (category) params.set('category', category);
        params.set('verifiedOnly', String(verifiedOnly));
        
        const response = await fetch(`${API_BASE}/api/products?${params}`, {
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (cancelled) return;
        if (!response.ok) throw new Error(`API 오류: ${response.status}`);

        const data: ProductsResponse = await response.json();
        
        if (Array.isArray(data.products)) {
          const normalizedProducts = normalizeProductsForUi(productType, data.products);
          const normalizedData: ProductsResponse = {
            ...data,
            products: normalizedProducts,
            total: normalizedProducts.length,
          };

          setProducts(normalizedProducts as T[]);
          setIsFromApi(true);
          setLastSync(data.lastSync);
          setTotalCount(normalizedProducts.length);
          setCachedProducts(normalizedData);
          setIsLoading(false);
          return;
        }
        
        throw new Error('API 응답 형식 오류');
      } catch (err) {
        clearTimeout(timeout);
        if (cancelled) return;
        // 3. Fallback: 정적 데이터 사용
        console.log(`[useProducts] ${productType} API 실패, 정적 데이터 사용:`, (err as Error).message);
        const staticData = getStaticData();
        setProducts(staticData);
        setIsFromApi(false);
        setLastSync(null);
        setTotalCount(staticData.length);
        setError((err as Error).message);
      }

      setIsLoading(false);
    }

    fetchProducts();

    return () => { cancelled = true; };
  }, [productType, category, enabled, refreshVersion, verifiedOnly, getCachedProducts, setCachedProducts, getStaticData]);

  const refresh = useCallback(() => {
    // 캐시 클리어 후 재로드
    try {
      const cacheKey = `${CACHE_KEY_PREFIX}${productType}_${category || 'all'}_${verifiedOnly ? 'verified' : 'all'}`;
      sessionStorage.removeItem(cacheKey);
    } catch { /* ignore */ }
    setRefreshVersion(v => v + 1);
  }, [productType, category, verifiedOnly]);

  return { products, isLoading, isFromApi, lastSync, totalCount, error, refresh };
}

/**
 * 가격 히스토리를 API에서 로드하는 훅
 */
export function usePriceHistory(productId: string | null) {
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!productId) return;

    setIsLoading(true);
    fetch(`${API_BASE}/api/products/price-history/${productId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data.history && data.history.length > 0) {
          setHistory(data.history);
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => setIsLoading(false));
  }, [productId]);

  return { history, isLoading };
}

/**
 * 카탈로그 통계 조회
 */
export function useCatalogStats() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/products/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => { /* ignore */ });
  }, []);

  return stats;
}
