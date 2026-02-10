import { useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Star, TrendingDown, ChevronDown, ChevronUp, ExternalLink, Zap, BarChart3, Bell, Heart, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { desktops as staticDesktops, desktopCategories, desktopSortOptions } from '@/data/desktops';
import { useProducts } from '@/hooks/useProducts';
import { useAffiliateBatch, isCoupangUrl } from '@/hooks/useAffiliateLink';
import { trackAffiliateClick, getPlatformKey, isAffiliatePlatform } from '@/utils/tracking';
import { cn } from '@/lib/utils';
import type { Desktop, DesktopFilterState } from '@/types';

interface DesktopPageProps {
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

export default function DesktopPage({
  wishlist,
  compareList,
  searchQuery,
  category,
  onToggleWishlist,
  onToggleCompare,
  onSetPriceAlert,
  onSearch,
  onNavigateToPage,
}: DesktopPageProps) {
  const productListRef = useRef<HTMLDivElement>(null);

  // API 자동 데이터 + 정적 데이터 fallback
  const { products: apiDesktops, isLoading: isApiLoading, isFromApi, lastSync, refresh } = useProducts<Desktop>('desktop');
  const desktops = isFromApi && apiDesktops.length > 0 ? apiDesktops : staticDesktops;

  const sectionToCategory: Record<string, string> = {
    'desk-gaming': 'gaming',
    'desk-mac': 'mac',
    'desk-mini': 'minipc',
    'desk-allinone': 'allinone',
    'desk-office': 'office',
    'desk-creator': 'creator',
  };
  const mappedCategory = category ? (sectionToCategory[category] || category) : null;

  const deskCategoryLabels: Record<string, string> = {
    gaming: '게이밍 데스크탑',
    mac: 'Mac 데스크탑',
    minipc: '미니 PC',
    allinone: '올인원 데스크탑',
    office: '사무용 데스크탑',
    creator: '크리에이터 데스크탑',
  };

  const [filters, setFilters] = useState<DesktopFilterState>({
    category: mappedCategory ? [mappedCategory] : [],
    brand: [],
    priceRange: [0, 10000000],
    cpu: [],
    gpu: [],
    ram: [],
    storage: [],
    formFactor: [],
    sort: 'discount',
  });

  const handleCategorySelect = useCallback((cat: string) => {
    if (onNavigateToPage) {
      onNavigateToPage(`desktop-${cat}`);
    } else {
      setFilters(prev => ({ ...prev, category: cat === 'all' ? [] : [cat] }));
      productListRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [onNavigateToPage]);

  const filteredDesktops = useMemo(() => {
    let result = [...desktops];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q)) ||
        d.specs.cpu.toLowerCase().includes(q) ||
        d.specs.gpu.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      );
    }
    if (filters.category.length > 0) {
      result = result.filter(d => filters.category.includes(d.category));
    }
    if (filters.brand.length > 0) {
      result = result.filter(d => filters.brand.includes(d.brand));
    }
    if (filters.formFactor.length > 0) {
      result = result.filter(d => filters.formFactor.includes(d.specs.formFactor));
    }
    result = result.filter(d => d.prices.current >= filters.priceRange[0] && d.prices.current <= filters.priceRange[1]);

    switch (filters.sort) {
      case 'price-asc': result.sort((a, b) => a.prices.current - b.prices.current); break;
      case 'price-desc': result.sort((a, b) => b.prices.current - a.prices.current); break;
      case 'discount': result.sort((a, b) => b.discount.percent - a.discount.percent); break;
      case 'price-index': result.sort((a, b) => b.priceIndex - a.priceIndex); break;
      case 'rating': result.sort((a, b) => b.rating.score - a.rating.score); break;
      case 'newest': result.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()); break;
    }

    return result;
  }, [desktops, filters, searchQuery]);

  const guideCards = [
    { title: '게이밍PC', icon: '🎮', desc: 'RTX 4060~4090, 풀옵션', category: 'gaming' },
    { title: '미니PC', icon: '📦', desc: 'Mac mini, NUC, 컴팩트', category: 'minipc' },
    { title: '올인원', icon: '🖥️', desc: '모니터+PC 일체형', category: 'allinone' },
    { title: '사무/워크스테이션', icon: '💼', desc: '안정성, 비즈니스 AS', category: 'office' },
  ];

  const formFactorOptions = ['미들타워', '풀타워', '미니PC', 'SFF (소형)', '올인원', '초소형 (타이니)'];

  // ─── 카테고리 서브페이지 모드 ───
  if (mappedCategory) {
    const catLabel = deskCategoryLabels[mappedCategory] || mappedCategory;
    return (
      <>
        <section className="bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900 pt-20 pb-12">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
            <button
              onClick={() => onNavigateToPage?.('desktop')}
              className="text-sm text-emerald-300 hover:text-white transition-colors mb-4 flex items-center gap-1"
            >
              ← 데스크탑 전체로 돌아가기
            </button>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">{catLabel}</h1>
            <p className="text-emerald-300 text-lg">{filteredDesktops.length}개 제품</p>
          </div>
        </section>
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-blue-700">
              {isFromApi ? (
                <><Wifi className="w-3 h-3 text-green-500" /><span>실시간 데이터</span></>
              ) : (
                <><WifiOff className="w-3 h-3 text-amber-500" /><span>큐레이션 데이터</span></>
              )}
            </div>
            <button onClick={refresh} className="flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors">
              <RefreshCw className={cn("w-3 h-3", isApiLoading && "animate-spin")} /><span>새로고침</span>
            </button>
          </div>
        </div>
        <section ref={productListRef} className="py-12 bg-slate-50">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-slate-500">{filteredDesktops.length}개 제품</span>
              <select
                value={filters.sort}
                onChange={e => setFilters(prev => ({ ...prev, sort: e.target.value as DesktopFilterState['sort'] }))}
                className="text-sm border rounded-lg px-3 py-2"
              >
                {desktopSortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredDesktops.map((desktop) => {
                const isWishlisted = wishlist.includes(desktop.id);
                const isCompared = compareList.includes(desktop.id);
                return (
                  <Card key={desktop.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 truncate">{desktop.name}</h3>
                          <p className="text-sm text-slate-500">{desktop.brand} · {desktop.specs.formFactor}</p>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button onClick={() => onToggleWishlist(desktop.id)} className={cn("p-1.5 rounded-full", isWishlisted ? "text-red-500" : "text-slate-300 hover:text-red-400")}>
                            <Heart className="w-4 h-4" fill={isWishlisted ? 'currentColor' : 'none'} />
                          </button>
                          <button onClick={() => onToggleCompare(desktop.id)} className={cn("p-1.5 rounded-full", isCompared ? "text-blue-500" : "text-slate-300 hover:text-blue-400")}>
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => onSetPriceAlert(desktop.id)} className="p-1.5 rounded-full text-slate-300 hover:text-amber-400">
                            <Bell className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {desktop.images?.[0] && <img src={desktop.images[0]} alt={desktop.name} className="w-full h-40 object-contain mb-3 rounded" />}
                      <div className="flex items-end gap-2 mb-3">
                        <span className="text-2xl font-bold text-slate-900">{desktop.prices.current.toLocaleString()}원</span>
                        {desktop.discount.percent > 0 && <Badge variant="destructive" className="text-xs">-{desktop.discount.percent}%</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {desktop.tags.slice(0, 3).map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                      </div>
                      <div className="flex gap-2">
                        {desktop.stores?.slice(0, 2).map((store, idx) => {
                          const platform = getPlatformKey(store.url);
                          return (
                            <a key={idx} href={store.url} target="_blank" rel="noopener noreferrer"
                              onClick={() => { if (isAffiliatePlatform(platform)) trackAffiliateClick({ productId: desktop.id, platform, source: 'productcard', url: store.url, productName: desktop.name }); }}
                              className="flex-1 text-center py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                              {isCoupangUrl(store.url) ? '쿠팡' : store.store || '최저가 보기'} <ExternalLink className="w-3 h-3 inline ml-1" />
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

  // ─── 메인 데스크탑 페이지 (개요 모드) ───
  return (
    <>
      {/* Desktop Hero */}
      <section className="relative min-h-[60vh] bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900 overflow-hidden flex items-center">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-radial from-emerald-500/30 via-teal-500/10 to-transparent rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 py-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="text-emerald-300 text-sm font-medium tracking-wider uppercase mb-4">실시간 가격비교</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
              데스크탑 최저가,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300">한눈에 비교하세요.</span>
            </h1>
            <p className="text-lg text-emerald-200/80 max-w-xl mx-auto mb-8">
              게이밍PC부터 미니PC, 올인원까지 — 데스크탑의 실시간 최저가를 비교하세요.
            </p>
            <div className="text-6xl mb-4">🖥️</div>
            <div className="flex justify-center gap-6 text-sm text-emerald-200">
              <span>🖥️ {desktops.length}개 데스크탑</span>
              <span>🏪 10개 쇼핑몰</span>
              <span>📊 실시간 추적</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 데이터 소스 상태 배너 */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-blue-700">
            {isFromApi ? (
              <>
                <Wifi className="w-3 h-3 text-green-500" />
                <span>실시간 데이터 · {desktops.length}개 제품 자동 수집</span>
                {lastSync && <span className="text-blue-400">· 마지막 동기화: {new Date(lastSync).toLocaleString('ko-KR')}</span>}
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-500" />
                <span>큐레이션 데이터 · {desktops.length}개 엄선 제품</span>
              </>
            )}
          </div>
          <button onClick={refresh} className="flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors">
            <RefreshCw className={cn("w-3 h-3", isApiLoading && "animate-spin")} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {/* Buying Guide */}
      <section className="py-12 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">어떤 데스크탑이 필요하신가요?</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {guideCards.map(card => (
              <button
                key={card.category}
                onClick={() => handleCategorySelect(card.category)}
                className="group p-6 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all text-left"
              >
                <div className="text-3xl mb-3">{card.icon}</div>
                <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">{card.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{card.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Filters & Product List */}
      <section ref={productListRef} className="py-12 bg-slate-50">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {searchQuery ? `"${searchQuery}" 검색 결과` : '전체 데스크탑'}
              </h2>
              <p className="text-slate-500 text-sm mt-1">{filteredDesktops.length}개 제품</p>
            </div>
            {searchQuery && (
              <button onClick={() => onSearch('')} className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-full transition-colors">
                검색 초기화 ✕
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap gap-2 mb-6">
            {desktopCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  (cat.id === 'all' && filters.category.length === 0) || filters.category.includes(cat.id)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                )}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
            <div className="w-px bg-slate-200 mx-1" />
            {/* Form factor */}
            {formFactorOptions.map(ff => (
              <button
                key={ff}
                onClick={() => {
                  setFilters(prev => ({
                    ...prev,
                    formFactor: prev.formFactor.includes(ff)
                      ? prev.formFactor.filter(v => v !== ff)
                      : [...prev.formFactor, ff]
                  }));
                }}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                  filters.formFactor.includes(ff)
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                )}
              >
                {ff}
              </button>
            ))}
            <div className="w-px bg-slate-200 mx-1" />
            <select
              value={filters.sort}
              onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
              className="px-3 py-1.5 rounded-full text-sm bg-white border border-slate-200 text-slate-600"
            >
              {desktopSortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {filteredDesktops.map((desktop) => (
              <DesktopProductCard
                key={desktop.id}
                desktop={desktop}
                isWishlisted={wishlist.includes(desktop.id)}
                isCompared={compareList.includes(desktop.id)}
                onToggleWishlist={onToggleWishlist}
                onToggleCompare={onToggleCompare}
                onSetPriceAlert={onSetPriceAlert}
              />
            ))}
          </div>

          {filteredDesktops.length === 0 && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🖥️</div>
              <p className="text-lg text-slate-500">조건에 맞는 데스크탑이 없습니다.</p>
              <button
                onClick={() => setFilters({ category: [], brand: [], priceRange: [0, 10000000], cpu: [], gpu: [], ram: [], storage: [], formFactor: [], sort: 'discount' })}
                className="mt-4 px-4 py-2 text-sm bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors"
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

// ─── 데스크탑 전용 상품 카드 (어필리에이트 + 타이밍 + 이미지) ───
function DesktopProductCard({
  desktop,
  isWishlisted,
  isCompared,
  onToggleWishlist,
  onToggleCompare,
  onSetPriceAlert,
}: {
  desktop: Desktop;
  isWishlisted: boolean;
  isCompared: boolean;
  onToggleWishlist: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onSetPriceAlert: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const savingsPercent = Math.round(((desktop.prices.original - desktop.prices.current) / desktop.prices.original) * 100);
  const isPriceGood = desktop.priceIndex >= 80;

  // 어필리에이트 링크 변환
  const storeUrls = desktop.stores.map(s => s.url);
  const affiliateUrls = useAffiliateBatch(storeUrls, `desktop_${desktop.id}`);

  // 어필리에이트 스토어 우선 정렬
  const sortedStores = [...desktop.stores].sort((a, b) => {
    const aIsAffiliate = isAffiliatePlatform(a.store) || isCoupangUrl(a.url);
    const bIsAffiliate = isAffiliatePlatform(b.store) || isCoupangUrl(b.url);
    if (aIsAffiliate && !bIsAffiliate) return -1;
    if (!aIsAffiliate && bIsAffiliate) return 1;
    return a.price - b.price;
  });

  const affiliateStore = sortedStores.find(s => isAffiliatePlatform(s.store) || isCoupangUrl(s.url));
  const lowestStore = sortedStores.reduce((min, s) => s.price < min.price ? s : min, sortedStores[0]);
  const ctaStore = affiliateStore || lowestStore;
  const ctaStoreIdx = desktop.stores.indexOf(ctaStore);
  const ctaUrl = (affiliateUrls as Record<number, string>)[ctaStoreIdx] || ctaStore.url;

  // 구매 타이밍 어드바이저
  const timingAdvice = desktop.prices.current <= desktop.prices.lowest
    ? { text: '역대 최저가!', color: 'bg-rose-500', icon: '🔥' }
    : desktop.priceIndex >= 90
    ? { text: '지금이 구매 적기!', color: 'bg-emerald-500', icon: '✅' }
    : desktop.priceIndex >= 75
    ? { text: '최저가 근접', color: 'bg-amber-500', icon: '📊' }
    : null;

  // 이미지
  const imageUrl = desktop.images?.[0]?.startsWith('http') ? desktop.images[0] : null;
  const emojiIcon = desktop.category === 'minipc' ? '📦' : desktop.category === 'allinone' ? '🖥️' : '🖥️';

  const handleCtaClick = () => {
    trackAffiliateClick({
      productId: desktop.id,
      platform: getPlatformKey(ctaStore.store),
      source: 'cta_button',
      url: ctaUrl,
      productName: desktop.name,
    });
  };

  const handleStoreClick = (store: typeof desktop.stores[0], url: string) => {
    trackAffiliateClick({
      productId: desktop.id,
      platform: getPlatformKey(store.store),
      source: 'productcard',
      url,
      productName: desktop.name,
    });
  };

  return (
    <Card className="group relative overflow-hidden border-slate-200 bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 h-full flex flex-col">
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {desktop.isHot && <Badge className="bg-rose-500 text-white text-[10px] px-1.5 py-0 h-5">HOT</Badge>}
        {desktop.isNew && <Badge className="bg-violet-500 text-white text-[10px] px-1.5 py-0 h-5">NEW</Badge>}
        {savingsPercent >= 15 && <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 h-5">-{savingsPercent}%</Badge>}
      </div>

      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="secondary" size="icon" className="w-7 h-7 rounded-full bg-white/90" onClick={() => onToggleWishlist(desktop.id)}>
          <Heart className={cn('w-3.5 h-3.5', isWishlisted && 'fill-rose-500 text-rose-500')} />
        </Button>
        <Button variant="secondary" size="icon" className={cn('w-7 h-7 rounded-full bg-white/90', isCompared && 'ring-2 ring-emerald-500')} onClick={() => onToggleCompare(desktop.id)}>
          <BarChart3 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {desktop.editorPick && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-md">{desktop.editorPick}</Badge>
          </div>
        )}
        {imageUrl ? (
          <img src={imageUrl} alt={desktop.name} className="w-full h-full object-contain p-2" loading="lazy" />
        ) : (
          <div className="text-4xl lg:text-5xl">{emojiIcon}</div>
        )}
        <div className="absolute bottom-2 left-2 flex gap-1">
          <Badge className={cn('text-[10px] font-bold px-1.5 py-0 h-5', isPriceGood ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white')}>
            가격지수 {desktop.priceIndex}
          </Badge>
          {desktop.editorScore && (
            <Badge className="bg-teal-600/90 text-white text-[10px] font-bold px-1.5 py-0 h-5">에디터 {desktop.editorScore}점</Badge>
          )}
        </div>
      </div>

      <div className="p-3 flex flex-col flex-1">
        <div className="mb-2">
          <p className="text-xs text-slate-500 mb-0.5">{desktop.brand}</p>
          <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 group-hover:text-emerald-600 transition-colors leading-tight">{desktop.name}</h3>
          {desktop.editorComment && (
            <p className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-2">&ldquo;{desktop.editorComment}&rdquo;</p>
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
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">{desktop.specs.formFactor}</Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">{desktop.specs.ram}GB</Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">{desktop.specs.storage >= 1024 ? `${desktop.specs.storage / 1024}TB` : `${desktop.specs.storage}GB`}</Badge>
          {desktop.specs.gpu !== 'Intel UHD 770' && desktop.specs.gpu !== 'Intel Arc Graphics' && desktop.specs.gpu !== 'Radeon 760M' && desktop.specs.gpu !== '10코어 GPU' && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 hidden xl:flex">{desktop.specs.gpu.split(' ').slice(0, 2).join(' ')}</Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="text-xs font-medium">{desktop.rating.score}</span>
          <span className="text-[10px] text-slate-400">({desktop.rating.count})</span>
        </div>

        <div className="mb-2 mt-auto">
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-lg font-bold text-slate-900">{desktop.prices.current.toLocaleString()}원</span>
            {savingsPercent > 0 && <span className="text-xs text-slate-400 line-through">{desktop.prices.original.toLocaleString()}원</span>}
          </div>
          {savingsPercent > 0 && (
            <span className="text-[10px] text-emerald-600 font-medium">
              <TrendingDown className="w-3 h-3 inline mr-0.5" />{savingsPercent}% 할인
            </span>
          )}
          <p className="text-[10px] text-slate-400 mt-0.5">역대최저 {desktop.prices.lowest.toLocaleString()}원</p>
        </div>

        <a
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleCtaClick}
          className="flex items-center justify-center gap-1.5 w-full h-9 mb-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold transition-all shadow-sm hover:shadow-md"
        >
          <Zap className="w-3.5 h-3.5" />
          {ctaStore.store}에서 {ctaStore.price.toLocaleString()}원
          {(isAffiliatePlatform(ctaStore.store) || isCoupangUrl(ctaStore.url)) && <span className="text-[9px] bg-white/20 px-1 rounded">제휴</span>}
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>

        <div className="space-y-1 mb-2">
          {sortedStores.slice(0, isExpanded ? undefined : 2).map((store, idx) => {
            const origIdx = desktop.stores.indexOf(store);
            const storeUrl = (affiliateUrls as Record<number, string>)[origIdx] || store.url;
            const isAff = isAffiliatePlatform(store.store) || isCoupangUrl(store.url);
            return (
              <a key={idx} href={storeUrl} target="_blank" rel="noopener noreferrer"
                onClick={() => handleStoreClick(store, storeUrl)}
                className={cn('flex items-center justify-between p-1.5 rounded-md transition-colors', isAff ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-slate-50 hover:bg-slate-100')}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{store.storeLogo}</span>
                  <div>
                    <p className="text-xs font-medium flex items-center gap-1">
                      {store.store}
                      {isAff && <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded">제휴</span>}
                    </p>
                    <p className="text-[10px] text-slate-400">{store.updatedAt}</p>
                  </div>
                </div>
                <p className="text-xs font-bold">{store.price.toLocaleString()}원</p>
              </a>
            );
          })}
        </div>

        {sortedStores.length > 2 && (
          <Button variant="ghost" size="sm" className="w-full h-7 text-xs mb-2" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <>접기 <ChevronUp className="w-3 h-3 ml-1" /></> : <>+{sortedStores.length - 2}개 더 보기 <ChevronDown className="w-3 h-3 ml-1" /></>}
          </Button>
        )}

        <div className="flex gap-1.5 mt-auto">
          <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onSetPriceAlert(desktop.id)}>
            <Bell className="w-3.5 h-3.5 mr-1" />
            가격 알림
          </Button>
        </div>
      </div>
    </Card>
  );
}
