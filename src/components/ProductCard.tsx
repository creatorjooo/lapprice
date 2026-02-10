import { useState, useMemo } from 'react';
import { 
  Heart, 
  TrendingDown, 
  Bell, 
  ChevronDown, 
  ChevronUp,
  Star,
  Truck,
  Clock,
  BarChart3,
  Cpu,
  HardDrive,
  Monitor,
  Weight,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import type { Laptop } from '@/types';
import { priceHistoryData } from '@/data/laptops';
import { cn } from '@/lib/utils';
import { useAffiliateBatch, isCoupangUrl } from '@/hooks/useAffiliateLink';
import { trackAffiliateClick, getPlatformKey, isAffiliatePlatform } from '@/utils/tracking';

interface ProductCardProps {
  laptop: Laptop;
  isWishlisted: boolean;
  isCompared: boolean;
  onToggleWishlist: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onSetPriceAlert: (id: string) => void;
}

export default function ProductCard({
  laptop,
  isWishlisted,
  isCompared,
  onToggleWishlist,
  onToggleCompare,
  onSetPriceAlert,
}: ProductCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPriceHistory, setShowPriceHistory] = useState(false);

  const priceHistory = priceHistoryData[laptop.id] || [];
  const savingsAmount = laptop.prices.original - laptop.prices.current;
  const savingsPercent = Math.round((savingsAmount / laptop.prices.original) * 100);
  const isPriceGood = laptop.priceIndex >= 80;

  // 구매 타이밍 어드바이저
  const priceTiming = useMemo(() => {
    const current = laptop.prices.current;
    const lowest = laptop.prices.lowest;
    const average = laptop.prices.average;
    const diffFromLowest = ((current - lowest) / lowest) * 100;
    const diffFromAverage = ((average - current) / average) * 100;

    if (current <= lowest) return { label: '역대 최저가', sublabel: '지금이 구매 적기!', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: '🔥' };
    if (diffFromLowest <= 5) return { label: '최저가 근접', sublabel: `최저 대비 ${Math.round(diffFromLowest)}% 이내`, color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400', icon: '👍' };
    if (diffFromAverage >= 15) return { label: '평균보다 저렴', sublabel: `평균 대비 ${Math.round(diffFromAverage)}% 저렴`, color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400', icon: '💰' };
    if (diffFromAverage >= 0) return { label: '적정 가격', sublabel: '더 떨어질 수 있음', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400', icon: '⏳' };
    return { label: '고점 주의', sublabel: '기다리세요', color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400', icon: '⚠️' };
  }, [laptop.prices]);

  // 어필리에이트 수익 스토어 우선 정렬 (쿠팡 > 네이버 > 기타)
  const sortedStores = useMemo(() => {
    return [...laptop.stores].sort((a, b) => {
      const aIsAffiliate = isAffiliatePlatform(a.store);
      const bIsAffiliate = isAffiliatePlatform(b.store);
      if (aIsAffiliate && !bIsAffiliate) return -1;
      if (!aIsAffiliate && bIsAffiliate) return 1;
      // 같은 어필리에이트 스토어끼리는 가격 순
      return a.price - b.price;
    });
  }, [laptop.stores]);

  // 스토어 URL 배열에서 쿠팡 URL을 어필리에이트로 변환
  const storeUrls = useMemo(() => sortedStores.map((s) => s.url), [sortedStores]);
  const { affiliateUrls } = useAffiliateBatch(storeUrls, `lapprice_product_${laptop.id}`);

  // CTA 대상: 어필리에이트 스토어 중 최저가
  const ctaStore = useMemo(() => {
    const affiliateStores = sortedStores.filter((s) => isAffiliatePlatform(s.store));
    if (affiliateStores.length === 0) return sortedStores[0];
    return affiliateStores.reduce((min, s) => (s.price < min.price ? s : min), affiliateStores[0]);
  }, [sortedStores]);

  const ctaStoreIndex = sortedStores.indexOf(ctaStore);
  const ctaAffiliateUrl = affiliateUrls[ctaStoreIndex] || ctaStore?.url;

  // 클릭 트래킹 핸들러
  const handleStoreClick = (store: typeof laptop.stores[0], url: string, source: 'productcard' | 'cta_button') => {
    trackAffiliateClick({
      productId: laptop.id,
      platform: getPlatformKey(store.store),
      source,
      url,
      productName: laptop.name,
    });
  };

  const getStockBadge = () => {
    switch (laptop.stock) {
      case 'in':
        return { label: '재고있음', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
      case 'low':
        return { label: '재고부족', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' };
      case 'out':
        return { label: '품절', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' };
    }
  };

  const stockBadge = getStockBadge();

  return (
    <TooltipProvider>
      <Card className="group relative overflow-hidden border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 h-full flex flex-col">
        {/* Badges */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {laptop.isHot && (
            <Badge className="bg-rose-500 text-white text-[10px] px-1.5 py-0 h-5">
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                HOT
              </span>
            </Badge>
          )}
          {laptop.isNew && (
            <Badge className="bg-violet-500 text-white text-[10px] px-1.5 py-0 h-5">NEW</Badge>
          )}
          {savingsPercent >= 30 && (
            <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 h-5">-{savingsPercent}%</Badge>
          )}
        </div>

        {/* Actions */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="w-7 h-7 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm"
                onClick={() => onToggleWishlist(laptop.id)}
              >
                <Heart className={cn('w-3.5 h-3.5', isWishlisted && 'fill-rose-500 text-rose-500')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isWishlisted ? '찜 해제' : '찜하기'}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className={cn(
                  'w-7 h-7 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm',
                  isCompared && 'ring-2 ring-emerald-500'
                )}
                onClick={() => onToggleCompare(laptop.id)}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isCompared ? '비교에서 제거' : '비교에 추가'}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Product Image Placeholder */}
        <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center flex-shrink-0">
          {/* Editor Pick Badge */}
          {laptop.editorPick && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-md">
                {laptop.editorPick}
              </Badge>
            </div>
          )}
          {laptop.images?.[0]?.startsWith('http') ? (
            <img src={laptop.images[0]} alt={laptop.name} className="w-full h-full object-contain" loading="lazy" />
          ) : (
            <div className="text-4xl lg:text-5xl">💻</div>
          )}
          {/* Price Index Badge + Editor Score */}
          <div className="absolute bottom-2 left-2 flex gap-1">
            <Badge
              className={cn(
                'text-[10px] font-bold px-1.5 py-0 h-5',
                isPriceGood
                  ? 'bg-emerald-500/90 text-white'
                  : 'bg-amber-500/90 text-white'
              )}
            >
              가격지수 {laptop.priceIndex}
            </Badge>
            {laptop.editorScore && (
              <Badge className="bg-blue-600/90 text-white text-[10px] font-bold px-1.5 py-0 h-5">
                에디터 {laptop.editorScore}점
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col flex-1">
          {/* Brand & Name */}
          <div className="mb-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{laptop.brand}</p>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-tight">
              {laptop.name}
            </h3>
            {laptop.editorComment && (
              <p className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-2">
                &ldquo;{laptop.editorComment}&rdquo;
              </p>
            )}
          </div>

          {/* Specs */}
          <div className="flex flex-wrap gap-1 mb-2">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 flex items-center gap-0.5">
              <Cpu className="w-3 h-3" />
              {laptop.specs.ram}GB
            </Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 flex items-center gap-0.5">
              <HardDrive className="w-3 h-3" />
              {laptop.specs.storage}GB
            </Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 flex items-center gap-0.5">
              <Monitor className="w-3 h-3" />
              {laptop.specs.displaySize}&quot;
            </Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 flex items-center gap-0.5 hidden xl:flex">
              <Weight className="w-3 h-3" />
              {laptop.specs.weight}kg
            </Badge>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1.5 mb-2">
            <div className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span className="text-xs font-medium">{laptop.rating.score}</span>
            </div>
            <span className="text-[10px] text-slate-400">({laptop.rating.count})</span>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 ml-auto', stockBadge.color)}>
              {stockBadge.label}
            </Badge>
          </div>

          {/* Price */}
          <div className="mb-2 mt-auto">
            <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                {laptop.prices.current.toLocaleString()}원
              </span>
              {savingsPercent > 0 && (
                <span className="text-xs text-slate-400 line-through">
                  {laptop.prices.original.toLocaleString()}원
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              {savingsPercent > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  <TrendingDown className="w-3 h-3 inline mr-0.5" />
                  {savingsPercent}% 할인
                </span>
              )}
              <span className="text-slate-500">
                평균대비 {' '}
                {laptop.prices.current < laptop.prices.average ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    -{Math.round(((laptop.prices.average - laptop.prices.current) / laptop.prices.average) * 100)}%
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400">
                    +{Math.round(((laptop.prices.current - laptop.prices.average) / laptop.prices.average) * 100)}%
                  </span>
                )}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              역대최저 {laptop.prices.lowest.toLocaleString()}원
            </p>
          </div>

          {/* 구매 타이밍 어드바이저 */}
          <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium mb-2', priceTiming.color)}>
            <span>{priceTiming.icon}</span>
            <span>{priceTiming.label}</span>
            <span className="opacity-70">-- {priceTiming.sublabel}</span>
          </div>

          {/* 장단점 미리보기 (확장 시) */}
          {isExpanded && laptop.pros && laptop.cons && (
            <div className="mb-2 p-2 bg-slate-50 dark:bg-slate-700/30 rounded-md text-[10px] space-y-1">
              {laptop.pros.slice(0, 2).map((pro, i) => (
                <div key={`pro-${i}`} className="flex items-start gap-1 text-emerald-600 dark:text-emerald-400">
                  <span className="shrink-0">+</span>
                  <span>{pro}</span>
                </div>
              ))}
              {laptop.cons.slice(0, 2).map((con, i) => (
                <div key={`con-${i}`} className="flex items-start gap-1 text-rose-600 dark:text-rose-400">
                  <span className="shrink-0">-</span>
                  <span>{con}</span>
                </div>
              ))}
            </div>
          )}

          {/* CTA 버튼 - 어필리에이트 최저가 바로가기 */}
          {ctaStore && (
            <a
              href={ctaAffiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleStoreClick(ctaStore, ctaAffiliateUrl, 'cta_button')}
              className="flex items-center justify-center gap-1.5 w-full h-9 mb-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-semibold transition-all shadow-sm hover:shadow-md"
            >
              <Zap className="w-3.5 h-3.5" />
              {ctaStore.store}에서 {ctaStore.price.toLocaleString()}원에 구매
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}

          {/* Store Prices */}
          <div className="space-y-1 mb-2">
            {sortedStores.slice(0, isExpanded ? undefined : 2).map((store, index) => {
              const storeUrl = affiliateUrls[index] || store.url;
              const isCoupang = isCoupangUrl(store.url);
              const isAffil = isAffiliatePlatform(store.store);

              return (
                <a
                  key={index}
                  href={storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleStoreClick(store, storeUrl, 'productcard')}
                  className={cn(
                    'flex items-center justify-between p-1.5 rounded-md transition-colors',
                    isAffil
                      ? 'bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-100 dark:border-blue-900/50'
                      : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{store.storeLogo}</span>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-medium">{store.store}</p>
                        {isCoupang && (
                          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[8px] px-1 py-0 h-3.5 font-normal">
                            로켓배송
                          </Badge>
                        )}
                        {isAffil && (
                          <span className="text-[8px] text-slate-400">제휴</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {store.updatedAt}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{store.price.toLocaleString()}원</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-0.5 justify-end">
                      <Truck className="w-2.5 h-2.5" />
                      {store.deliveryDays}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>

          {/* Expand Button */}
          {sortedStores.length > 2 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs mb-2"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  접기 <ChevronUp className="w-3 h-3 ml-1" />
                </>
              ) : (
                <>
                  +{sortedStores.length - 2}개 더 보기 <ChevronDown className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          )}

          {/* Actions */}
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
                  <DialogTitle>{laptop.name} 가격 추이</DialogTitle>
                </DialogHeader>
                <div className="h-80 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip
                        formatter={(value: number) => [`${value.toLocaleString()}원`, '가격']}
                      />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ fill: '#10b981' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => onSetPriceAlert(laptop.id)}
            >
              <Bell className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
}
