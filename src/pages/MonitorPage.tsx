import { useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Star, TrendingDown, ChevronDown, ChevronUp, ExternalLink, Zap, BarChart3, Bell, Heart, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import ProductImage from '@/components/ProductImage';
import PriceHistoryChart from '@/components/PriceHistoryChart';
import { monitors as staticMonitors, monitorCategories, monitorSortOptions, monitorPriceHistory } from '@/data/monitors';
import { usePriceHistory, useProducts } from '@/hooks/useProducts';
import { useAffiliateBatch, isCoupangUrl } from '@/hooks/useAffiliateLink';
import { useVerifiedRedirect } from '@/hooks/useVerifiedRedirect';
import { trackAffiliateClick, getPlatformKey, isAffiliatePlatform } from '@/utils/tracking';
import { getStoreHref, getStoreTrackingUrl, getStoreVerifiedPrice, isStoreVerified } from '@/utils/offers';
import { cn } from '@/lib/utils';
import { formatStoreUpdatedAt } from '@/utils/time';
import type { Monitor, MonitorFilterState, PriceHistory } from '@/types';

interface MonitorPageProps {
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

export default function MonitorPage({
  wishlist,
  compareList,
  searchQuery,
  category,
  onToggleWishlist,
  onToggleCompare,
  onSetPriceAlert,
  onSearch,
  onNavigateToPage,
}: MonitorPageProps) {
  const productListRef = useRef<HTMLDivElement>(null);

  // API 자동 데이터 + 정적 데이터 fallback
  const { products: apiMonitors, isLoading: isApiLoading, isFromApi, lastSync, refresh } = useProducts<Monitor>('monitor');
  const monitors = isFromApi ? apiMonitors : staticMonitors;

  // Navbar의 서브메뉴 section명을 실제 카테고리명으로 매핑
  const sectionToCategory: Record<string, string> = {
    'mon-gaming': 'gaming',
    'mon-pro': 'professional',
    'mon-ultrawide': 'ultrawide',
    'mon-general': 'general',
  };
  const categoryToSection: Record<string, string> = {
    gaming: 'mon-gaming',
    professional: 'mon-pro',
    ultrawide: 'mon-ultrawide',
    general: 'mon-general',
  };
  const mappedCategory = category ? (sectionToCategory[category] || category) : null;

  const monCategoryLabels: Record<string, string> = {
    gaming: '게이밍 모니터',
    professional: '전문가용 모니터',
    ultrawide: '울트라와이드 모니터',
    general: '가성비 모니터',
  };

  const [filters, setFilters] = useState<MonitorFilterState>({
    category: mappedCategory ? [mappedCategory] : [],
    brand: [],
    priceRange: [0, 5000000],
    panelType: [],
    resolution: [],
    refreshRate: [],
    screenSize: [],
    hdr: [],
    curved: [],
    sort: 'discount',
  });

  const handleCategorySelect = useCallback((cat: string) => {
    if (onNavigateToPage) {
      if (cat === 'all') {
        onNavigateToPage('monitor');
        return;
      }
      const section = categoryToSection[cat] || cat;
      onNavigateToPage(`monitor-${section}`);
    } else {
      setFilters(prev => ({ ...prev, category: cat === 'all' ? [] : [cat] }));
      productListRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [categoryToSection, onNavigateToPage]);

  // 모니터 필터링
  const filteredMonitors = useMemo(() => {
    let result = [...monitors];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        m.tags.some(t => t.toLowerCase().includes(q)) ||
        m.specs.panelType.toLowerCase().includes(q) ||
        m.specs.resolutionLabel.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    }
    if (filters.category.length > 0) {
      result = result.filter(m => filters.category.includes(m.category));
    }
    if (filters.brand.length > 0) {
      result = result.filter(m => filters.brand.includes(m.brand));
    }
    if (filters.panelType.length > 0) {
      result = result.filter(m => filters.panelType.includes(m.specs.panelType));
    }
    if (filters.resolution.length > 0) {
      result = result.filter(m => filters.resolution.includes(m.specs.resolutionLabel));
    }
    if (filters.refreshRate.length > 0) {
      result = result.filter(m => {
        return filters.refreshRate.some(r => {
          if (r === '60Hz') return m.specs.refreshRate <= 75;
          if (r === '144Hz') return m.specs.refreshRate >= 100 && m.specs.refreshRate <= 165;
          if (r === '240Hz+') return m.specs.refreshRate >= 200;
          return false;
        });
      });
    }
    if (filters.screenSize.length > 0) {
      result = result.filter(m => {
        return filters.screenSize.some(s => {
          if (s === '24"') return m.specs.screenSize <= 24;
          if (s === '27"') return m.specs.screenSize > 24 && m.specs.screenSize <= 28;
          if (s === '32"') return m.specs.screenSize > 28 && m.specs.screenSize <= 34;
          if (s === '34"+') return m.specs.screenSize > 34;
          return false;
        });
      });
    }
    result = result.filter(m => m.prices.current >= filters.priceRange[0] && m.prices.current <= filters.priceRange[1]);

    // Sort
    switch (filters.sort) {
      case 'price-asc': result.sort((a, b) => a.prices.current - b.prices.current); break;
      case 'price-desc': result.sort((a, b) => b.prices.current - a.prices.current); break;
      case 'discount': result.sort((a, b) => b.discount.percent - a.discount.percent); break;
      case 'price-index': result.sort((a, b) => b.priceIndex - a.priceIndex); break;
      case 'rating': result.sort((a, b) => b.rating.score - a.rating.score); break;
      case 'newest': result.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()); break;
    }

    return result;
  }, [monitors, filters, searchQuery]);

  const guideCards = [
    { title: '게이밍', icon: '🎮', desc: 'QHD/4K 144Hz+ 고주사율', category: 'gaming' },
    { title: '전문가/크리에이터', icon: '🎨', desc: '색정확도, USB-C PD, 4K', category: 'professional' },
    { title: '울트라와이드', icon: '📐', desc: '21:9 / 32:9 멀티태스킹', category: 'ultrawide' },
    { title: '가성비/사무용', icon: '💰', desc: 'FHD/QHD IPS 기본기', category: 'general' },
  ];

  const filterGroups = [
    { label: '패널', key: 'panelType' as const, options: ['IPS', 'VA', 'OLED', 'Mini LED'] },
    { label: '해상도', key: 'resolution' as const, options: ['FHD', 'QHD', 'WQHD', '4K UHD', 'DQHD'] },
    { label: '주사율', key: 'refreshRate' as const, options: ['60Hz', '144Hz', '240Hz+'] },
    { label: '화면 크기', key: 'screenSize' as const, options: ['24"', '27"', '32"', '34"+'] },
  ];

  // ─── 카테고리 서브페이지 모드 ───
  if (mappedCategory) {
    const catLabel = monCategoryLabels[mappedCategory] || mappedCategory;
    return (
      <>
        <section className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 pt-20 pb-12">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
            <button
              onClick={() => onNavigateToPage?.('monitor')}
              className="text-sm text-purple-300 hover:text-white transition-colors mb-4 flex items-center gap-1"
            >
              ← 모니터 전체로 돌아가기
            </button>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">{catLabel}</h1>
            <p className="text-purple-300 text-lg">{filteredMonitors.length}개 제품</p>
          </div>
        </section>
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-purple-700">
              {isFromApi ? (
                <><Wifi className="w-3 h-3 text-green-500" /><span>실시간 데이터</span></>
              ) : (
                <><WifiOff className="w-3 h-3 text-amber-500" /><span>큐레이션 데이터</span></>
              )}
            </div>
            <button onClick={refresh} className="flex items-center gap-1 text-purple-500 hover:text-purple-700 transition-colors">
              <RefreshCw className={cn("w-3 h-3", isApiLoading && "animate-spin")} /><span>새로고침</span>
            </button>
          </div>
        </div>
        <section ref={productListRef} className="py-12 bg-slate-50">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
            {/* 정렬 */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-slate-500">{filteredMonitors.length}개 제품</span>
              <select
                value={filters.sort}
                onChange={e => setFilters(prev => ({ ...prev, sort: e.target.value as MonitorFilterState['sort'] }))}
                className="text-sm border rounded-lg px-3 py-2"
              >
                {monitorSortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {/* 제품 카드 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredMonitors.map((monitor) => {
                const isWishlisted = wishlist.includes(monitor.id);
                const compareKey = `monitor:${monitor.id}`;
                const isCompared = compareList.includes(compareKey);
                return (
                  <Card key={monitor.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate">{monitor.name}</h3>
                          <p className="text-sm text-slate-500">{monitor.brand} · {monitor.specs.screenSize}" {monitor.specs.resolution}</p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button onClick={() => onToggleWishlist(monitor.id)} className={cn("p-1.5 rounded-full", isWishlisted ? "text-red-500" : "text-slate-300 hover:text-red-400")}>
                            <Heart className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} />
                          </button>
                          <button onClick={() => onToggleCompare(compareKey)} className={cn("p-1.5 rounded-full", isCompared ? "text-blue-500" : "text-slate-300 hover:text-blue-400")}>
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => onSetPriceAlert(monitor.id)} className="p-1.5 rounded-full text-slate-300 hover:text-amber-400">
                            <Bell className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <ProductImage
                        src={monitor.images?.[0]}
                        alt={monitor.name}
                        className="w-full h-40 object-contain mb-3 rounded"
                        fallbackText={monitor.name}
                      />
                      <div className="flex items-end gap-2 mb-3">
                        <span className="text-2xl font-bold text-slate-900">{monitor.prices.current.toLocaleString()}원</span>
                        {monitor.discount.percent > 0 && <Badge variant="destructive" className="text-xs">-{monitor.discount.percent}%</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {monitor.tags.slice(0, 3).map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                      </div>
                      <div className="flex gap-2">
                        {monitor.stores?.slice(0, 2).map((store, idx) => {
                          const href = getStoreHref(store);
                          const trackingUrl = getStoreTrackingUrl(store) || href;
                          const platform = getPlatformKey(store.store);
                          return (
                            <a key={idx} href={href} target="_blank" rel="noopener noreferrer"
                              onClick={() => { if (isAffiliatePlatform(store.store)) trackAffiliateClick({ productId: monitor.id, platform, source: 'productcard', url: trackingUrl, productName: monitor.name }); }}
                              className="flex-1 text-center py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              {isCoupangUrl(trackingUrl) ? '쿠팡' : store.store || '최저가 보기'} <ExternalLink className="w-3 h-3 inline ml-1" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      </>
    );
  }

  // ─── 메인 모니터 페이지 (개요 모드) ───
  return (
    <>
      {/* Monitor Hero */}
      <section className="relative min-h-[60vh] bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 overflow-hidden flex items-center">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-radial from-purple-500/30 via-indigo-500/10 to-transparent rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 py-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="text-purple-300 text-sm font-medium tracking-wider uppercase mb-4">실시간 가격비교</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
              모니터 최저가,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">한눈에 비교하세요.</span>
            </h1>
            <p className="text-lg text-purple-200/80 max-w-xl mx-auto mb-8">
              게이밍부터 전문가용까지 — OLED, 4K, 고주사율 모니터의 실시간 최저가를 비교하세요.
            </p>
            <div className="text-6xl mb-4">🖥️</div>
            <div className="flex justify-center gap-6 text-sm text-purple-200">
              <span>🖥️ {monitors.length}개 모니터</span>
              <span>🏪 10개 쇼핑몰</span>
              <span>📊 실시간 추적</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 데이터 소스 상태 배너 */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-purple-700">
            {isFromApi ? (
              <>
                <Wifi className="w-3 h-3 text-green-500" />
                <span>실시간 데이터 · {monitors.length}개 제품 자동 수집</span>
                {lastSync && <span className="text-purple-400">· 마지막 동기화: {new Date(lastSync).toLocaleString('ko-KR')}</span>}
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-500" />
                <span>큐레이션 데이터 · {monitors.length}개 엄선 제품</span>
              </>
            )}
          </div>
          <button onClick={refresh} className="flex items-center gap-1 text-purple-500 hover:text-purple-700 transition-colors">
            <RefreshCw className={cn("w-3 h-3", isApiLoading && "animate-spin")} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {/* Buying Guide */}
      <section className="py-12 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">어떤 모니터가 필요하신가요?</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {guideCards.map(card => (
              <button
                key={card.category}
                onClick={() => handleCategorySelect(card.category)}
                className="group p-6 rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all text-left"
              >
                <div className="text-3xl mb-3">{card.icon}</div>
                <h3 className="font-semibold text-slate-900 group-hover:text-purple-600 transition-colors">{card.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{card.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Filters & Product List */}
      <section ref={productListRef} className="py-12 bg-slate-50">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {searchQuery ? `"${searchQuery}" 검색 결과` : '전체 모니터'}
              </h2>
              <p className="text-slate-500 text-sm mt-1">{filteredMonitors.length}개 제품</p>
            </div>
            {searchQuery && (
              <button onClick={() => onSearch('')} className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-full transition-colors">
                검색 초기화 ✕
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap gap-2 mb-6">
            {/* Categories */}
            {monitorCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  (cat.id === 'all' && filters.category.length === 0) || filters.category.includes(cat.id)
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                )}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
            <div className="w-px bg-slate-200 mx-1" />
            {/* Filter chips */}
            {filterGroups.map(group => (
              <div key={group.key} className="flex gap-1">
                {group.options.map(opt => (
                  <button
                    key={opt}
                    onClick={() => {
                      setFilters(prev => ({
                        ...prev,
                        [group.key]: prev[group.key].includes(opt)
                          ? prev[group.key].filter((v: string) => v !== opt)
                          : [...prev[group.key], opt]
                      }));
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                      filters[group.key].includes(opt)
                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                        : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ))}
            <div className="w-px bg-slate-200 mx-1" />
            {/* Sort */}
            <select
              value={filters.sort}
              onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
              className="px-3 py-1.5 rounded-full text-sm bg-white border border-slate-200 text-slate-600"
            >
              {monitorSortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {filteredMonitors.map((monitor) => (
              <MonitorProductCard
                key={monitor.id}
                monitor={monitor}
                isWishlisted={wishlist.includes(monitor.id)}
                isCompared={compareList.includes(`monitor:${monitor.id}`)}
                onToggleWishlist={onToggleWishlist}
                onToggleCompare={onToggleCompare}
                onSetPriceAlert={onSetPriceAlert}
              />
            ))}
          </div>

          {filteredMonitors.length === 0 && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🖥️</div>
              <p className="text-lg text-slate-500">조건에 맞는 모니터가 없습니다.</p>
              <button
                onClick={() => setFilters({ category: [], brand: [], priceRange: [0, 5000000], panelType: [], resolution: [], refreshRate: [], screenSize: [], hdr: [], curved: [], sort: 'discount' })}
                className="mt-4 px-4 py-2 text-sm bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors"
              >
                필터 초기화
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// ─── 모니터 전용 상품 카드 (어필리에이트 + 타이밍 + 이미지) ───
function MonitorProductCard({
  monitor,
  isWishlisted,
  isCompared,
  onToggleWishlist,
  onToggleCompare,
  onSetPriceAlert,
}: {
  monitor: Monitor;
  isWishlisted: boolean;
  isCompared: boolean;
  onToggleWishlist: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onSetPriceAlert: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const savingsPercent = Math.round(((monitor.prices.original - monitor.prices.current) / monitor.prices.original) * 100);
  const isPriceGood = monitor.priceIndex >= 80;
  const staticPriceHistory = monitorPriceHistory[monitor.id] || [];
  const { history: apiPriceHistory } = usePriceHistory(showPriceHistory ? monitor.id : null);
  const { openVerifiedLink, redirectError, clearRedirectError } = useVerifiedRedirect();
  const chartData: PriceHistory[] = (apiPriceHistory.length > 0 ? apiPriceHistory : staticPriceHistory).length > 0
    ? (apiPriceHistory.length > 0 ? apiPriceHistory : staticPriceHistory)
    : [{ date: '오늘', price: monitor.prices.current, store: '현재가' }];

  // 전체 스토어 노출 (가격 오름차순)
  const sortedStores = useMemo(() => {
    return [...monitor.stores].sort((a, b) => getStoreVerifiedPrice(a) - getStoreVerifiedPrice(b));
  }, [monitor.stores]);

  const storeUrls = useMemo(() => sortedStores.map((store) => getStoreTrackingUrl(store)), [sortedStores]);
  const { affiliateUrls } = useAffiliateBatch(storeUrls, `monitor_${monitor.id}`);

  const ctaStore = sortedStores[0];
  const ctaStoreIdx = ctaStore ? sortedStores.indexOf(ctaStore) : -1;
  const ctaHref = useMemo(() => {
    if (!ctaStore) return undefined;
    const baseHref = getStoreHref(ctaStore);
    if (baseHref.startsWith('/r/')) return baseHref;
    return ctaStoreIdx >= 0 ? ((affiliateUrls as Record<number, string>)[ctaStoreIdx] || baseHref) : baseHref;
  }, [ctaStore, ctaStoreIdx, affiliateUrls]);
  const ctaTrackingUrl = ctaStore ? getStoreTrackingUrl(ctaStore) : '';
  const absoluteLowestPrice = useMemo(
    () => (sortedStores.length > 0 ? Math.min(...sortedStores.map((store) => getStoreVerifiedPrice(store))) : 0),
    [sortedStores],
  );

  // 구매 타이밍 어드바이저
  const timingAdvice = monitor.prices.current <= monitor.prices.lowest
    ? { text: '역대 최저가!', color: 'bg-rose-500', icon: '🔥' }
    : monitor.priceIndex >= 90
    ? { text: '지금이 구매 적기!', color: 'bg-emerald-500', icon: '✅' }
    : monitor.priceIndex >= 75
    ? { text: '최저가 근접', color: 'bg-amber-500', icon: '📊' }
    : null;

  // 이미지: http URL이면 실제 이미지, 아니면 이모지 fallback
  const imageUrl = monitor.images?.[0]?.startsWith('http') ? monitor.images[0] : null;

  const handleCtaClick = async () => {
    if (!ctaStore || !ctaHref) return;
    clearRedirectError();
    trackAffiliateClick({
      productId: monitor.id,
      platform: getPlatformKey(ctaStore.store),
      source: 'cta_button',
      url: ctaTrackingUrl || ctaHref,
      productName: monitor.name,
    });
    await openVerifiedLink(ctaHref);
  };

  const handleStoreClick = (store: typeof monitor.stores[0], url: string) => {
    trackAffiliateClick({
      productId: monitor.id,
      platform: getPlatformKey(store.store),
      source: 'productcard',
      url,
      productName: monitor.name,
    });
  };

  return (
    <Card className="group relative overflow-hidden border-slate-200 bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 h-full flex flex-col">
      {/* Badges */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {monitor.isHot && <Badge className="bg-rose-500 text-white text-[10px] px-1.5 py-0 h-5">HOT</Badge>}
        {monitor.isNew && <Badge className="bg-violet-500 text-white text-[10px] px-1.5 py-0 h-5">NEW</Badge>}
        {savingsPercent >= 20 && <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 h-5">-{savingsPercent}%</Badge>}
      </div>

      {/* Actions */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="secondary" size="icon" className="w-7 h-7 rounded-full bg-white/90" onClick={() => onToggleWishlist(monitor.id)}>
          <Heart className={cn('w-3.5 h-3.5', isWishlisted && 'fill-rose-500 text-rose-500')} />
        </Button>
        <Button variant="secondary" size="icon" className={cn('w-7 h-7 rounded-full bg-white/90', isCompared && 'ring-2 ring-purple-500')} onClick={() => onToggleCompare(`monitor:${monitor.id}`)}>
          <BarChart3 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Image */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {monitor.editorPick && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-md">{monitor.editorPick}</Badge>
          </div>
        )}
        <ProductImage
          src={imageUrl || monitor.images?.[0]}
          alt={monitor.name}
          className="w-full h-full object-contain p-2"
          fallbackText={monitor.name}
        />
        <div className="absolute bottom-2 left-2 flex gap-1">
          <Badge className={cn('text-[10px] font-bold px-1.5 py-0 h-5', isPriceGood ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white')}>
            가격지수 {monitor.priceIndex}
          </Badge>
          {monitor.editorScore && (
            <Badge className="bg-purple-600/90 text-white text-[10px] font-bold px-1.5 py-0 h-5">에디터 {monitor.editorScore}점</Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1">
        <div className="mb-2">
          <p className="text-xs text-slate-500 mb-0.5">{monitor.brand}</p>
          <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-purple-600 transition-colors leading-tight">{monitor.name}</h3>
          {monitor.editorComment && (
            <p className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-2">&ldquo;{monitor.editorComment}&rdquo;</p>
          )}
        </div>

        {/* Timing Advisor */}
        {timingAdvice && (
          <div className={cn('flex items-center gap-1 px-2 py-1 rounded-md mb-2 text-[10px] font-semibold text-white', timingAdvice.color)}>
            <span>{timingAdvice.icon}</span>
            <span>{timingAdvice.text}</span>
          </div>
        )}

        {/* Specs */}
        <div className="flex flex-wrap gap-1 mb-2">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">{monitor.specs.screenSize}&quot; {monitor.specs.panelType}</Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">{monitor.specs.resolutionLabel}</Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">{monitor.specs.refreshRate}Hz</Badge>
          {monitor.specs.curved && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">커브드</Badge>}
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1.5 mb-2">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="text-xs font-medium">{monitor.rating.score}</span>
          <span className="text-[10px] text-slate-400">({monitor.rating.count})</span>
        </div>

        {/* Price */}
        <div className="mb-2 mt-auto">
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-lg font-bold text-slate-900">{monitor.prices.current.toLocaleString()}원</span>
            {savingsPercent > 0 && <span className="text-xs text-slate-400 line-through">{monitor.prices.original.toLocaleString()}원</span>}
          </div>
          {savingsPercent > 0 && (
            <span className="text-[10px] text-emerald-600 font-medium">
              <TrendingDown className="w-3 h-3 inline mr-0.5" />{savingsPercent}% 할인
            </span>
          )}
          <p className="text-[10px] text-slate-400 mt-0.5">역대최저 {monitor.prices.lowest.toLocaleString()}원</p>
        </div>

        {/* CTA */}
        {ctaStore && (
          <button
            type="button"
            onClick={handleCtaClick}
            className="flex items-center justify-center gap-1.5 w-full h-9 mb-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-xs font-semibold transition-all shadow-sm hover:shadow-md"
          >
            <Zap className="w-3.5 h-3.5" />
            {ctaStore.store}에서 {getStoreVerifiedPrice(ctaStore).toLocaleString()}원
            {(isAffiliatePlatform(ctaStore.store) || isCoupangUrl(ctaTrackingUrl)) && <span className="text-[9px] bg-white/20 px-1 rounded">제휴</span>}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </button>
        )}

        {redirectError && (
          <p className="text-[10px] text-rose-600 mb-2">{redirectError}</p>
        )}

        {/* Stores */}
        <div className="space-y-1 mb-2">
          {sortedStores.slice(0, isExpanded ? undefined : 2).map((store, idx) => {
            const baseHref = getStoreHref(store);
            const trackingUrl = getStoreTrackingUrl(store) || baseHref;
            const storeUrl = baseHref.startsWith('/r/')
              ? baseHref
              : ((affiliateUrls as Record<number, string>)[idx] || baseHref);
            const isAff = isAffiliatePlatform(store.store) || isCoupangUrl(trackingUrl);
            const storePrice = getStoreVerifiedPrice(store);
            return (
              <button
                type="button"
                key={idx}
                onClick={async () => {
                  clearRedirectError();
                  handleStoreClick(store, trackingUrl);
                  await openVerifiedLink(storeUrl);
                }}
                className={cn('flex w-full items-center justify-between p-1.5 rounded-md transition-colors text-left', isAff ? 'bg-purple-50 hover:bg-purple-100' : 'bg-slate-50 hover:bg-slate-100')}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{store.storeLogo}</span>
                  <div>
                    <p className="text-xs font-medium flex items-center gap-1">
                      {store.store}
                      {storePrice === absoluteLowestPrice && <span className="text-[9px] bg-emerald-100 text-emerald-600 px-1 rounded">최저가</span>}
                      {isAff && <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded">제휴</span>}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {isStoreVerified(store)
                        ? `검증 ${formatStoreUpdatedAt(store.verifiedAt || store.updatedAt)}`
                        : formatStoreUpdatedAt(store.updatedAt)}
                    </p>
                  </div>
                </div>
                <p className="text-xs font-bold">{storePrice.toLocaleString()}원</p>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400 mb-2">
          수집된 스토어 가격을 모두 표시합니다. 클릭 시 최신가를 다시 확인합니다.
        </p>

        {sortedStores.length > 2 && (
          <Button variant="ghost" size="sm" className="w-full h-7 text-xs mb-2" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <>접기 <ChevronUp className="w-3 h-3 ml-1" /></> : <>+{sortedStores.length - 2}개 더 보기 <ChevronDown className="w-3 h-3 ml-1" /></>}
          </Button>
        )}

        <div className="flex gap-1.5 mt-auto">
          <Dialog open={showPriceHistory} onOpenChange={setShowPriceHistory}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">
                <BarChart3 className="w-3.5 h-3.5 mr-1" />
                가격 추이
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{monitor.name} 가격 추이</DialogTitle>
              </DialogHeader>
              <div className="h-80 mt-4">
                <PriceHistoryChart data={chartData} color="#9333ea" />
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => onSetPriceAlert(monitor.id)}>
            <Bell className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
