import { X, Check, Minus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Laptop } from '@/types';
import { cn } from '@/lib/utils';
import { useAffiliateBatch, isCoupangUrl } from '@/hooks/useAffiliateLink';
import { trackAffiliateClick, getPlatformKey, isAffiliatePlatform } from '@/utils/tracking';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  laptops: Laptop[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function CompareModal({
  isOpen,
  onClose,
  laptops,
  onRemove,
  onClear,
}: CompareModalProps) {
  if (laptops.length === 0) {
    return null;
  }

  const compareFields = [
    { label: '이미지', key: 'image', render: (_laptop: Laptop) => (
      <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-lg flex items-center justify-center">
        <span className="text-4xl">💻</span>
      </div>
    )},
    { label: '가격', key: 'price', render: (laptop: Laptop) => (
      <div>
        <p className="text-lg font-bold">{laptop.prices.current.toLocaleString()}원</p>
        {laptop.discount.percent > 0 && (
          <p className="text-sm text-slate-400 line-through">{laptop.prices.original.toLocaleString()}원</p>
        )}
      </div>
    )},
    { label: '할인율', key: 'discount', render: (laptop: Laptop) => (
      laptop.discount.percent > 0 ? (
        <Badge className="bg-emerald-500 text-white">-{laptop.discount.percent}%</Badge>
      ) : (
        <Minus className="w-4 h-4 text-slate-400" />
      )
    )},
    { label: '가격지수', key: 'priceIndex', render: (laptop: Laptop) => (
      <Badge className={cn(
        laptop.priceIndex >= 80 ? 'bg-emerald-500' : laptop.priceIndex >= 60 ? 'bg-amber-500' : 'bg-rose-500',
        'text-white'
      )}>
        {laptop.priceIndex}점
      </Badge>
    )},
    { label: 'CPU', key: 'cpu', render: (laptop: Laptop) => <span className="text-sm">{laptop.specs.cpu}</span> },
    { label: 'GPU', key: 'gpu', render: (laptop: Laptop) => <span className="text-sm">{laptop.specs.gpu}</span> },
    { label: 'RAM', key: 'ram', render: (laptop: Laptop) => <span className="text-sm">{laptop.specs.ram}GB {laptop.specs.ramType}</span> },
    { label: '저장공간', key: 'storage', render: (laptop: Laptop) => <span className="text-sm">{laptop.specs.storage}GB {laptop.specs.storageType}</span> },
    { label: '디스플레이', key: 'display', render: (laptop: Laptop) => <span className="text-sm">{laptop.specs.display}</span> },
    { label: '무게', key: 'weight', render: (laptop: Laptop) => <span className="text-sm">{laptop.specs.weight}kg</span> },
    { label: '배터리', key: 'battery', render: (laptop: Laptop) => <span className="text-sm">{laptop.specs.battery}</span> },
    { label: '평점', key: 'rating', render: (laptop: Laptop) => (
      <div className="flex items-center gap-1">
        <span className="text-amber-400">★</span>
        <span>{laptop.rating.score}</span>
        <span className="text-slate-400 text-sm">({laptop.rating.count})</span>
      </div>
    )},
    { label: '최저가 매장', key: 'store', render: (laptop: Laptop) => (
      <div>
        <p className="text-sm font-medium">{laptop.stores[0].store}</p>
        <p className="text-xs text-slate-400">{laptop.stores[0].deliveryDays}</p>
      </div>
    )},
  ];

  const getBestValue = (key: string) => {
    if (laptops.length < 2) return null;
    
    switch (key) {
      case 'price':
        return Math.min(...laptops.map((l) => l.prices.current));
      case 'discount':
        return Math.max(...laptops.map((l) => l.discount.percent));
      case 'priceIndex':
        return Math.max(...laptops.map((l) => l.priceIndex));
      case 'ram':
        return Math.max(...laptops.map((l) => l.specs.ram));
      case 'weight':
        return Math.min(...laptops.map((l) => l.specs.weight));
      case 'rating':
        return Math.max(...laptops.map((l) => l.rating.score));
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">상품 비교</DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClear}>
                전체 삭제
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(90vh-100px)]">
          <div className="p-6">
            {/* Product Headers */}
            <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `120px repeat(${laptops.length}, minmax(200px, 1fr))` }}>
              <div className="font-semibold text-slate-500">상품명</div>
              {laptops.map((laptop) => (
                <div key={laptop.id} className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"
                    onClick={() => onRemove(laptop.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                  <h3 className="font-semibold text-sm line-clamp-2 pr-6">{laptop.name}</h3>
                  <p className="text-xs text-slate-500">{laptop.brand}</p>
                </div>
              ))}
            </div>

            {/* Compare Fields */}
            <div className="space-y-4">
              {compareFields.map((field) => {
                const bestValue = getBestValue(field.key);
                
                return (
                  <div
                    key={field.key}
                    className="grid gap-4 py-3 border-t border-slate-100 dark:border-slate-800"
                    style={{ gridTemplateColumns: `120px repeat(${laptops.length}, minmax(200px, 1fr))` }}
                  >
                    <div className="font-medium text-sm text-slate-600 dark:text-slate-400">
                      {field.label}
                    </div>
                    {laptops.map((laptop) => {
                      let isBest = false;
                      if (bestValue !== null) {
                        if (field.key === 'price') isBest = laptop.prices.current === bestValue;
                        if (field.key === 'discount') isBest = laptop.discount.percent === bestValue;
                        if (field.key === 'priceIndex') isBest = laptop.priceIndex === bestValue;
                        if (field.key === 'ram') isBest = laptop.specs.ram === bestValue;
                        if (field.key === 'weight') isBest = laptop.specs.weight === bestValue;
                        if (field.key === 'rating') isBest = laptop.rating.score === bestValue;
                      }

                      return (
                        <div
                          key={laptop.id}
                          className={cn(
                            'p-2 rounded-lg',
                            isBest && 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200 dark:ring-emerald-800'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {field.render(laptop)}
                            {isBest && <Check className="w-4 h-4 text-emerald-500" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons — 어필리에이트 구매 버튼 */}
            <CompareActionButtons laptops={laptops} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── 어필리에이트 구매 버튼 컴포넌트 ───
function CompareActionButtons({ laptops }: { laptops: Laptop[] }) {
  // 각 노트북의 최적 구매 URL: 어필리에이트 스토어 우선
  const bestStores = laptops.map((laptop) => {
    const affStore = laptop.stores.find(s => isAffiliatePlatform(s.store) || isCoupangUrl(s.url));
    return affStore || laptop.stores[0];
  });
  const urls = bestStores.map(s => s.url);
  const affiliateUrls = useAffiliateBatch(urls, 'compare_modal');

  return (
    <div
      className="grid gap-4 mt-6 pt-6 border-t"
      style={{ gridTemplateColumns: `120px repeat(${laptops.length}, minmax(200px, 1fr))` }}
    >
      <div />
      {laptops.map((laptop, idx) => {
        const store = bestStores[idx];
        const url = affiliateUrls[idx] || store.url;
        const isAff = isAffiliatePlatform(store.store) || isCoupangUrl(store.url);
        return (
          <Button key={laptop.id} className="w-full" asChild>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackAffiliateClick({
                  productId: laptop.id,
                  platform: getPlatformKey(store.store),
                  source: 'compare_modal',
                  url,
                  productName: laptop.name,
                });
              }}
            >
              {store.store} 구매하기
              {isAff && <span className="ml-1 text-[9px] bg-white/20 px-1 rounded">제휴</span>}
              <ExternalLink className="w-3 h-3 ml-1 opacity-60" />
            </a>
          </Button>
        );
      })}
    </div>
  );
}
