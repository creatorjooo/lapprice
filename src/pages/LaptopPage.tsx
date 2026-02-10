import { useState, useCallback, useRef, useEffect } from 'react';
import Hero from '@/sections/Hero';
import BuyingGuide from '@/sections/BuyingGuide';
import HotDeals from '@/sections/HotDeals';
import StoreSection from '@/sections/StoreSection';
import AppleSection from '@/sections/AppleSection';
import VsCompare from '@/components/VsCompare';
import ProductShowcase from '@/sections/ProductShowcase';
import Filters from '@/sections/Filters';
import ProductList from '@/sections/ProductList';
import { laptops as staticLaptops } from '@/data/laptops';
import { useProducts } from '@/hooks/useProducts';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Laptop, FilterState } from '@/types';

interface LaptopPageProps {
  wishlist: string[];
  compareList: string[];
  searchQuery: string;
  category?: string | null;
  onToggleWishlist: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onSetPriceAlert: (id: string) => void;
  onOpenCompare: () => void;
  onSearch: (query: string) => void;
  onNavigateToPage?: (page: string) => void;
}

export default function LaptopPage({
  wishlist,
  compareList,
  searchQuery,
  category,
  onToggleWishlist,
  onToggleCompare,
  onSetPriceAlert,
  onOpenCompare,
  onSearch,
  onNavigateToPage,
}: LaptopPageProps) {
  // API 자동 데이터 + 정적 데이터 fallback
  const { products: apiLaptops, isLoading: isApiLoading, isFromApi, lastSync, refresh } = useProducts<Laptop>('laptop');
  const laptops = isFromApi && apiLaptops.length > 0 ? apiLaptops : staticLaptops;

  const [, setCurrentView] = useState<'home' | 'store' | 'category'>('home');
  const [, setSelectedCategory] = useState<string>('all');

  const [filters, setFilters] = useState<FilterState>({
    category: category ? [category] : [],
    brand: [],
    priceRange: [0, 10000000],
    cpu: [],
    ram: [],
    storage: [],
    displaySize: [],
    weight: [],
    discount: [],
    stock: [],
    sort: 'discount',
  });

  // 카테고리 prop 변경 시 필터 업데이트
  useEffect(() => {
    if (category) {
      setFilters(prev => ({ ...prev, category: [category] }));
    }
  }, [category]);

  const categoryLabels: Record<string, string> = {
    apple: 'Apple 맥북',
    gaming: '게이밍 노트북',
    ultrabook: '울트라북',
    business: '비즈니스 노트북',
    creator: '크리에이터 노트북',
    budget: '가성비 노트북',
  };

  // Refs for scrolling
  const storeRef = useRef<HTMLDivElement>(null);
  const productListRef = useRef<HTMLDivElement>(null);
  const appleRef = useRef<HTMLDivElement>(null);
  const gamingRef = useRef<HTMLDivElement>(null);
  const ultrabookRef = useRef<HTMLDivElement>(null);
  const businessRef = useRef<HTMLDivElement>(null);
  const creatorRef = useRef<HTMLDivElement>(null);
  const budgetRef = useRef<HTMLDivElement>(null);

  const handleNavigate = useCallback((section: string) => {
    const refs: Record<string, React.RefObject<HTMLDivElement | null>> = {
      store: storeRef,
      apple: appleRef,
      gaming: gamingRef,
      ultrabook: ultrabookRef,
      business: businessRef,
      creator: creatorRef,
      budget: budgetRef,
    };
    if (section === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setCurrentView('home');
    } else if (section === 'store') {
      setCurrentView('store');
      storeRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (section === 'compare') {
      onOpenCompare();
    } else if (refs[section]) {
      refs[section].current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [onOpenCompare]);

  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory(category);
    setFilters(prev => ({ ...prev, category: category === 'all' ? [] : [category] }));
    setCurrentView('store');
    // ProductList 영역으로 스크롤 (카테고리 필터 결과를 바로 보이게)
    setTimeout(() => {
      productListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  const getLaptopsByCategory = (category: string) => {
    return laptops.filter(l => l.category === category).slice(0, 4);
  };

  const getFilteredCount = () => {
    let result = [...laptops];
    if (filters.category.length > 0 && !filters.category.includes('all')) {
      result = result.filter((l) => filters.category.includes(l.category));
    }
    if (filters.brand.length > 0) {
      result = result.filter((l) => filters.brand.includes(l.brand));
    }
    if (filters.ram.length > 0) {
      result = result.filter((l) => filters.ram.some((ram) => l.specs.ram === parseInt(ram)));
    }
    if (filters.storage.length > 0) {
      result = result.filter((l) => filters.storage.some((storage) => l.specs.storage === parseInt(storage)));
    }
    if (filters.displaySize.length > 0) {
      result = result.filter((l) => {
        const size = l.specs.displaySize;
        return filters.displaySize.some((range) => {
          if (range === '13~14인치') return size >= 13 && size < 15;
          if (range === '15~16인치') return size >= 15 && size < 17;
          if (range === '17인치 이상') return size >= 17;
          return false;
        });
      });
    }
    if (filters.weight.length > 0) {
      result = result.filter((l) => {
        const weight = l.specs.weight;
        return filters.weight.some((range) => {
          if (range === '1kg 이하') return weight <= 1;
          if (range === '1~1.5kg') return weight > 1 && weight <= 1.5;
          if (range === '1.5~2kg') return weight > 1.5 && weight <= 2;
          if (range === '2kg 이상') return weight > 2;
          return false;
        });
      });
    }
    if (filters.discount.length > 0 && !filters.discount.includes('0')) {
      const minDiscount = Math.max(...filters.discount.map((d) => parseInt(d)));
      result = result.filter((l) => l.discount.percent >= minDiscount);
    }
    result = result.filter(
      (l) => l.prices.current >= filters.priceRange[0] && l.prices.current <= filters.priceRange[1]
    );
    return result.length;
  };

  // 카테고리 서브페이지 모드
  if (category) {
    const catLabel = categoryLabels[category] || category;
    const filteredLaptops = laptops.filter(l => l.category === category);
    return (
      <>
        {/* 카테고리 헤더 */}
        <section className="bg-slate-900 pt-20 pb-12">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
            <button
              onClick={() => onNavigateToPage?.('laptop')}
              className="text-sm text-slate-400 hover:text-white transition-colors mb-4 flex items-center gap-1"
            >
              ← 노트북 전체로 돌아가기
            </button>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">{catLabel}</h1>
            <p className="text-slate-400 text-lg">{filteredLaptops.length}개 제품</p>
          </div>
        </section>

        {/* 데이터 소스 상태 배너 */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-700">
              {isFromApi ? (
                <><Wifi className="w-3 h-3 text-green-500" /><span>실시간 데이터</span></>
              ) : (
                <><WifiOff className="w-3 h-3 text-amber-500" /><span>큐레이션 데이터</span></>
              )}
            </div>
            <button onClick={refresh} className="flex items-center gap-1 text-emerald-500 hover:text-emerald-700 transition-colors">
              <RefreshCw className={cn("w-3 h-3", isApiLoading && "animate-spin")} />
              <span>새로고침</span>
            </button>
          </div>
        </div>

        {/* 필터 + 제품 목록 */}
        <section className="bg-slate-50 py-12">
          <div className="max-w-[1920px] mx-auto">
            <Filters filters={filters} onFilterChange={handleFilterChange} totalProducts={filteredLaptops.length} filteredCount={getFilteredCount()} />
            <ProductList
              laptops={laptops} filters={filters} wishlist={wishlist} compareList={compareList}
              searchQuery={searchQuery} onToggleWishlist={onToggleWishlist} onToggleCompare={onToggleCompare}
              onSetPriceAlert={onSetPriceAlert}
            />
          </div>
        </section>
      </>
    );
  }

  // ─── 메인 노트북 페이지 (개요 모드) ───
  return (
    <>
      <Hero onNavigate={handleNavigate} />

      {/* 데이터 소스 상태 배너 */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-700">
            {isFromApi ? (
              <>
                <Wifi className="w-3 h-3 text-green-500" />
                <span>실시간 데이터 · {laptops.length}개 제품 자동 수집</span>
                {lastSync && <span className="text-emerald-400">· 마지막 동기화: {new Date(lastSync).toLocaleString('ko-KR')}</span>}
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-500" />
                <span>큐레이션 데이터 · {laptops.length}개 엄선 제품</span>
              </>
            )}
          </div>
          <button onClick={refresh} className="flex items-center gap-1 text-emerald-500 hover:text-emerald-700 transition-colors">
            <RefreshCw className={cn("w-3 h-3", isApiLoading && "animate-spin")} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      <BuyingGuide laptops={laptops} onCategorySelect={(cat) => onNavigateToPage?.(`laptop-${cat}`)} />
      <HotDeals laptops={laptops} />

      <div ref={storeRef}>
        <StoreSection laptops={laptops} onNavigate={handleNavigate} onCategorySelect={(cat) => onNavigateToPage?.(`laptop-${cat}`)} />
      </div>

      <div ref={appleRef}>
        <AppleSection laptops={laptops} />
      </div>

      <VsCompare laptops={laptops} />

      <div ref={gamingRef}>
        <ProductShowcase
          id="gaming" title="게이밍 노트북" subtitle="최상의 퍼포먼스"
          description="RTX 4060부터 RTX 4090까지, 고주사율 디스플레이와 강력한 GPU로 차원이 다른 게이밍을 경험하세요."
          laptops={getLaptopsByCategory('gaming')} bgColor="dark" textColor="light"
          ctaText="게이밍 노트북 전체보기 →" ctaAction={() => onNavigateToPage?.('laptop-gaming')}
          secondaryCta="스펙 비교하기" secondaryAction={onOpenCompare}
        />
      </div>

      <div ref={ultrabookRef}>
        <ProductShowcase
          id="ultrabook" title="울트라북" subtitle="가볍고 슬림한"
          description="1.5kg 이하, 하루종일 쓸 수 있는 배터리. 이동이 많은 직장인과 학생을 위한 프리미엄 휴대성."
          laptops={getLaptopsByCategory('ultrabook')} bgColor="light" textColor="dark"
          ctaText="울트라북 전체보기 →" ctaAction={() => onNavigateToPage?.('laptop-ultrabook')}
        />
      </div>

      <div ref={businessRef}>
        <ProductShowcase
          id="business" title="비즈니스 노트북" subtitle="업무에 최적화"
          description="안정성, 보안, 생산성을 위한 비즈니스 노트북. TPM, 도킹 지원, 전문 A/S까지."
          laptops={getLaptopsByCategory('business')} bgColor="gradient" textColor="light"
          ctaText="비즈니스 노트북 전체보기 →" ctaAction={() => onNavigateToPage?.('laptop-business')}
        />
      </div>

      <div ref={creatorRef}>
        <ProductShowcase
          id="creator" title="크리에이터 노트북" subtitle="전문가용 성능"
          description="정확한 색 표현과 강력한 스펙. 영상 편집, 3D 렌더링, 크리에이티브 작업을 위한 전문가용."
          laptops={getLaptopsByCategory('creator')} bgColor="light" textColor="dark"
          ctaText="크리에이터 노트북 전체보기 →" ctaAction={() => onNavigateToPage?.('laptop-creator')}
        />
      </div>

      <div ref={budgetRef}>
        <ProductShowcase
          id="budget" title="가성비 노트북" subtitle="알뜰한 선택"
          description="학생, 일상 사무, 입문자를 위한 가성비 노트북. 부담 없는 가격에 충분한 성능."
          laptops={getLaptopsByCategory('budget')} bgColor="dark" textColor="light"
          ctaText="가성비 노트북 전체보기 →" ctaAction={() => onNavigateToPage?.('laptop-budget')}
        />
      </div>

      <section ref={productListRef} className="bg-slate-50 dark:bg-slate-100 py-12">
        <div className="max-w-[1920px] mx-auto">
          <div className="px-4 sm:px-6 lg:px-8 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-slate-900">
                  {searchQuery ? `"${searchQuery}" 검색 결과` : '전체 노트북'}
                </h2>
                <p className="text-slate-500 mt-2">
                  {searchQuery ? '검색 결과를 확인하세요' : '고급 필터로 원하는 노트북을 찾아보세요'}
                </p>
              </div>
              {searchQuery && (
                <button
                  onClick={() => onSearch('')}
                  className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-full transition-colors"
                >
                  검색 초기화 ✕
                </button>
              )}
            </div>
          </div>
          <Filters filters={filters} onFilterChange={handleFilterChange} totalProducts={laptops.length} filteredCount={getFilteredCount()} />
          <ProductList
            laptops={laptops} filters={filters} wishlist={wishlist} compareList={compareList}
            searchQuery={searchQuery} onToggleWishlist={onToggleWishlist} onToggleCompare={onToggleCompare}
            onSetPriceAlert={onSetPriceAlert}
          />
        </div>
      </section>
    </>
  );
}
