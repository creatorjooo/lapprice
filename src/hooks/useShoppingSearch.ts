import { useState, useCallback, useRef } from 'react';
import { laptops } from '@/data/laptops';
import type { Laptop } from '@/types';

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
  localResults: Laptop[];
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

export function useShoppingSearch(): UseShoppingSearchReturn {
  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<Laptop[]>([]);
  const [externalResults, setExternalResults] = useState<ShoppingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [platformStatus, setPlatformStatus] = useState<Record<string, PlatformStatus>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 로컬 데이터 검색
  const searchLocal = useCallback((q: string): Laptop[] => {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    return laptops.filter(
      (l) =>
        l.name.toLowerCase().includes(lower) ||
        l.brand.toLowerCase().includes(lower) ||
        l.model.toLowerCase().includes(lower) ||
        l.tags.some((t) => t.toLowerCase().includes(lower)) ||
        l.specs.cpu.toLowerCase().includes(lower) ||
        l.specs.gpu.toLowerCase().includes(lower)
    );
  }, []);

  // 외부 API 검색
  const searchExternal = useCallback(async (q: string) => {
    // 이전 요청 취소
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    // 모든 플랫폼을 loading으로 설정
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

      // 플랫폼별 상태 업데이트
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
