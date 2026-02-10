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
import type { Product } from '@/types';
import { cn } from '@/lib/utils';
import { useAffiliateBatch, isCoupangUrl } from '@/hooks/useAffiliateLink';
import { trackAffiliateClick, getPlatformKey, isAffiliatePlatform } from '@/utils/tracking';
import { toImageSrc } from '@/utils/image';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export default function CompareModal({
  isOpen,
  onClose,
  products,
  onRemove,
  onClear,
}: CompareModalProps) {
  if (products.length === 0) {
    return null;
  }

  const getLowestStore = (product: Product) => {
    const explicitLowest = product.stores.find((s) => s.isLowest);
    if (explicitLowest) return explicitLowest;
    return product.stores.reduce((min, s) => (s.price < min.price ? s : min), product.stores[0]);
  };

  const getTypeLabel = (product: Product) => {
    if (product.productType === 'laptop') return '노트북';
    if (product.productType === 'monitor') return '모니터';
    return '데스크탑';
  };

  const getSpecSummary = (product: Product) => {
    if (product.productType === 'laptop') {
      return `${product.specs.cpu} / ${product.specs.gpu} / ${product.specs.ram}GB / ${product.specs.storage}GB`;
    }
    if (product.productType === 'monitor') {
      return `${product.specs.screenSize}" ${product.specs.resolutionLabel} ${product.specs.refreshRate}Hz ${product.specs.panelType}`;
    }
    return `${product.specs.cpu} / ${product.specs.gpu} / ${product.specs.ram}GB / ${product.specs.formFactor}`;
  };

  const compareFields = [
    { label: '이미지', key: 'image', render: (product: Product) => (
      <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-lg flex items-center justify-center overflow-hidden">
        {product.images?.[0]?.startsWith('http') ? (
          <img src={toImageSrc(product.images[0])} alt={product.name} className="w-full h-full object-contain" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-4xl">{product.productType === 'monitor' ? '🖥️' : '💻'}</span>
        )}
      </div>
    )},
    { label: '타입', key: 'type', render: (product: Product) => (
      <Badge variant="outline" className="text-xs">{getTypeLabel(product)}</Badge>
    )},
    { label: '가격', key: 'price', render: (product: Product) => (
      <div>
        <p className="text-lg font-bold">{product.prices.current.toLocaleString()}원</p>
        {product.discount.percent > 0 && (
          <p className="text-sm text-slate-400 line-through">{product.prices.original.toLocaleString()}원</p>
        )}
      </div>
    )},
    { label: '할인율', key: 'discount', render: (product: Product) => (
      product.discount.percent > 0 ? (
        <Badge className="bg-emerald-500 text-white">-{product.discount.percent}%</Badge>
      ) : (
        <Minus className="w-4 h-4 text-slate-400" />
      )
    )},
    { label: '가격지수', key: 'priceIndex', render: (product: Product) => (
      <Badge className={cn(
        product.priceIndex >= 80 ? 'bg-emerald-500' : product.priceIndex >= 60 ? 'bg-amber-500' : 'bg-rose-500',
        'text-white'
      )}>
        {product.priceIndex}점
      </Badge>
    )},
    { label: '주요 사양', key: 'specSummary', render: (product: Product) => <span className="text-sm">{getSpecSummary(product)}</span> },
    { label: '평점', key: 'rating', render: (product: Product) => (
      <div className="flex items-center gap-1">
        <span className="text-amber-400">★</span>
        <span>{product.rating.score}</span>
        <span className="text-slate-400 text-sm">({product.rating.count})</span>
      </div>
    )},
    { label: '최저가 매장', key: 'store', render: (product: Product) => (
      <div>
        <p className="text-sm font-medium flex items-center gap-1">
          {getLowestStore(product).store}
          <Badge className="bg-emerald-500/10 text-emerald-700 text-[9px] px-1 py-0 h-4">최저가</Badge>
        </p>
        <p className="text-xs text-slate-400">{getLowestStore(product).deliveryDays}</p>
        <p className="text-xs font-semibold">{getLowestStore(product).price.toLocaleString()}원</p>
      </div>
    )},
  ];

  const getBestValue = (key: string) => {
    if (products.length < 2) return null;
    
    switch (key) {
      case 'price':
        return Math.min(...products.map((l) => l.prices.current));
      case 'discount':
        return Math.max(...products.map((l) => l.discount.percent));
      case 'priceIndex':
        return Math.max(...products.map((l) => l.priceIndex));
      case 'rating':
        return Math.max(...products.map((l) => l.rating.score));
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
            <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `120px repeat(${products.length}, minmax(200px, 1fr))` }}>
              <div className="font-semibold text-slate-500">상품명</div>
              {products.map((product) => (
                <div key={product.id} className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200"
                    onClick={() => onRemove(product.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                  <h3 className="font-semibold text-sm line-clamp-2 pr-6">{product.name}</h3>
                  <p className="text-xs text-slate-500">{product.brand}</p>
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
                    style={{ gridTemplateColumns: `120px repeat(${products.length}, minmax(200px, 1fr))` }}
                  >
                    <div className="font-medium text-sm text-slate-600 dark:text-slate-400">
                      {field.label}
                    </div>
                    {products.map((product) => {
                      let isBest = false;
                      if (bestValue !== null) {
                        if (field.key === 'price') isBest = product.prices.current === bestValue;
                        if (field.key === 'discount') isBest = product.discount.percent === bestValue;
                        if (field.key === 'priceIndex') isBest = product.priceIndex === bestValue;
                        if (field.key === 'rating') isBest = product.rating.score === bestValue;
                      }

                      return (
                        <div
                          key={product.id}
                          className={cn(
                            'p-2 rounded-lg',
                            isBest && 'bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-200 dark:ring-emerald-800'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {field.render(product)}
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
            <CompareActionButtons products={products} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── 어필리에이트 구매 버튼 컴포넌트 ───
function CompareActionButtons({ products }: { products: Product[] }) {
  const bestStores = products.map((product) => {
    const affStore = product.stores.find((s) => isAffiliatePlatform(s.store) || isCoupangUrl(s.url));
    return affStore || product.stores[0];
  });
  const urls = bestStores.map((s) => s.url);
  const { affiliateUrls } = useAffiliateBatch(urls, 'compare_modal');

  return (
    <div
      className="grid gap-4 mt-6 pt-6 border-t"
      style={{ gridTemplateColumns: `120px repeat(${products.length}, minmax(200px, 1fr))` }}
    >
      <div />
      {products.map((product, idx) => {
        const store = bestStores[idx];
        const url = affiliateUrls[idx] || store.url;
        const isAff = isAffiliatePlatform(store.store) || isCoupangUrl(store.url);
        return (
          <Button key={product.id} className="w-full" asChild>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackAffiliateClick({
                  productId: product.id,
                  platform: getPlatformKey(store.store),
                  source: 'compare_modal',
                  url,
                  productName: product.name,
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
