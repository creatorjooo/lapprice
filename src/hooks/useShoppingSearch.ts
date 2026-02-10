import { useState, useCallback, useRef } from 'react';
import { laptops } from '@/data/laptops';
import { monitors } from '@/data/monitors';
import { desktops } from '@/data/desktops';
import type { Laptop, Monitor, Desktop } from '@/types';

// ─── 통합 검색 결과 타입 ───
export interface UnifiedLocalResult {
  id: string;
  productType: 'laptop' | 'monitor' | 'desktop';
  brand: string;
  name: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  specSummary: string;
  icon: string;
  hash: string; // 클릭 시 이동할 해시
}

export interface ShoppingProduct {
  title: string;
  price: number;
  originalPrice?: number;
  link: string;
  image: string;
  mallName: string;
  category?: string;
}

export interface ShoppingResult {
  source: string;
  available: boolean;
  products: ShoppingProduct[];
  error?: string;
}

type PlatformStatus = 'idle' | 'loading' | 'success' | 'error' | 'unavailable';

export interface UseShoppingSearchReturn {
  localResults: UnifiedLocalResult[];
  externalResults: ShoppingResult[];
  isLoading: boolean;
  platformStatus: Record<string, PlatformStatus>;
  search: (query: string) => void;
  clearResults: () => void;
  query: string;
}

const PLATFORM_NAMES: Record<string, string> = {
  naver: '네이버 쇼핑',
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

const ALL_PLATFORMS = Object.keys(PLATFORM_NAMES);

// ─── 노트북 → 통합 결과 변환 ───
function laptopToUnified(l: Laptop): UnifiedLocalResult {
  return {
    id: l.id,
    productType: 'laptop',
    brand: l.brand,
    name: l.name,
    price: l.prices.current,
    originalPrice: l.prices.original,
    discountPercent: l.discount.percent,
    specSummary: `${l.specs.cpu} · ${l.specs.ram}GB · ${l.specs.storage}GB`,
    icon: '💻',
    hash: 'laptop',
  };
}

// ─── 모니터 → 통합 결과 변환 ───
function monitorToUnified(m: Monitor): UnifiedLocalResult {
  return {
    id: m.id,
    productType: 'monitor',
    brand: m.brand,
    name: m.name,
    price: m.prices.current,
    originalPrice: m.prices.original,
    discountPercent: m.discount.percent,
    specSummary: `${m.specs.screenSize}" ${m.specs.resolutionLabel} ${m.specs.refreshRate}Hz ${m.specs.panelType}`,
    icon: '🖥️',
    hash: 'monitor',
  };
}

// ─── 데스크탑 → 통합 결과 변환 ───
function desktopToUnified(d: Desktop): UnifiedLocalResult {
  return {
    id: d.id,
    productType: 'desktop',
    brand: d.brand,
    name: d.name,
    price: d.prices.current,
    originalPrice: d.prices.original,
    discountPercent: d.discount.percent,
    specSummary: `${d.specs.cpu} · ${d.specs.gpu} · ${d.specs.ram}GB`,
    icon: '🖥️',
    hash: 'desktop',
  };
}

export function useShoppingSearch(): UseShoppingSearchReturn {
  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<UnifiedLocalResult[]>([]);
  const [externalResults, setExternalResults] = useState<ShoppingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [platformStatus, setPlatformStatus] = useState<Record<string, PlatformStatus>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ─── 로컬 통합 검색 (노트북 + 모니터 + 데스크탑) ───
  const searchLocal = useCallback((q: string): UnifiedLocalResult[] => {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();

    // 노트북 검색
    const laptopResults = laptops
      .filter(
        (l) =>
          l.name.toLowerCase().includes(lower) ||
          l.brand.toLowerCase().includes(lower) ||
          l.model.toLowerCase().includes(lower) ||
          l.tags.some((t) => t.toLowerCase().includes(lower)) ||
          l.specs.cpu.toLowerCase().includes(lower) ||
          l.specs.gpu.toLowerCase().includes(lower) ||
          l.category.toLowerCase().includes(lower)
      )
      .map(laptopToUnified);

    // 모니터 검색
    const monitorResults = monitors
      .filter(
        (m) =>
          m.name.toLowerCase().includes(lower) ||
          m.brand.toLowerCase().includes(lower) ||
          m.model.toLowerCase().includes(lower) ||
          m.tags.some((t) => t.toLowerCase().includes(lower)) ||
          m.specs.panelType.toLowerCase().includes(lower) ||
          m.specs.resolutionLabel.toLowerCase().includes(lower) ||
          m.category.toLowerCase().includes(lower)
      )
      .map(monitorToUnified);

    // 데스크탑 검색
    const desktopResults = desktops
      .filter(
        (d) =>
          d.name.toLowerCase().includes(lower) ||
          d.brand.toLowerCase().includes(lower) ||
          d.model.toLowerCase().includes(lower) ||
          d.tags.some((t) => t.toLowerCase().includes(lower)) ||
          d.specs.cpu.toLowerCase().includes(lower) ||
          d.specs.gpu.toLowerCase().includes(lower) ||
          d.category.toLowerCase().includes(lower)
      )
      .map(desktopToUnified);

    // 할인율 높은 순으로 정렬
    return [...laptopResults, ...monitorResults, ...desktopResults].sort(
      (a, b) => b.discountPercent - a.discountPercent
    );
  }, []);

  // 외부 API 검색
  const searchExternal = useCallback(async (q: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    const initialStatus: Record<string, PlatformStatus> = {};
    ALL_PLATFORMS.forEach((p) => {
      initialStatus[p] = 'loading';
    });
    setPlatformStatus(initialStatus);
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/search?query=${encodeURIComponent(q)}`,
        { signal: abortRef.current.signal }
      );

      if (!response.ok) throw new Error('검색 API 호출 실패');

      const data: ShoppingResult[] = await response.json();
      setExternalResults(data);

      const newStatus: Record<string, PlatformStatus> = {};
      data.forEach((r) => {
        if (!r.available && r.error?.includes('미설정')) {
          newStatus[r.source] = 'unavailable';
        } else if (!r.available) {
          newStatus[r.source] = 'error';
        } else {
          newStatus[r.source] = 'success';
        }
      });
      setPlatformStatus(newStatus);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        ALL_PLATFORMS.forEach((p) => {
          setPlatformStatus((prev) => ({ ...prev, [p]: 'error' }));
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 통합 검색 (디바운스 300ms)
  const search = useCallback(
    (q: string) => {
      setQuery(q);

      // 로컬 검색은 즉시 실행
      setLocalResults(searchLocal(q));

      // 외부 검색은 디바운스
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (q.trim().length < 2) {
        setExternalResults([]);
        setPlatformStatus({});
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      debounceRef.current = setTimeout(() => {
        searchExternal(q);
      }, 300);
    },
    [searchLocal, searchExternal]
  );

  const clearResults = useCallback(() => {
    setQuery('');
    setLocalResults([]);
    setExternalResults([]);
    setPlatformStatus({});
    setIsLoading(false);
  }, []);

  return {
    localResults,
    externalResults,
    isLoading,
    platformStatus,
    search,
    clearResults,
    query,
  };
}

export { PLATFORM_NAMES };
