import { ChevronRight } from 'lucide-react';
import { toImageSrc } from '@/utils/image';

interface RecentItem {
  id: string;
  name: string;
  price: number;
  productType: string;
  image?: string;
  viewedAt: string;
}

interface RecentlyViewedProps {
  items: RecentItem[];
  onNavigateToPage: (page: string) => void;
}

export default function RecentlyViewed({ items, onNavigateToPage }: RecentlyViewedProps) {
  if (items.length === 0) return null;

  const typeLabels: Record<string, string> = { laptop: '노트북', monitor: '모니터', desktop: '데스크탑' };
  const emojiMap: Record<string, string> = { laptop: '💻', monitor: '🖥️', desktop: '🖥️' };

  return (
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">최근 본 상품</h3>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigateToPage(item.productType)}
              className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all flex-shrink-0 min-w-[180px] max-w-[240px]"
            >
              <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                {item.image?.startsWith('http') ? (
                  <img src={toImageSrc(item.image)} alt="" className="w-full h-full object-contain" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-sm">{emojiMap[item.productType] || '📦'}</span>
                )}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[11px] text-slate-900 font-medium truncate">{item.name}</p>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-blue-600 font-bold">{item.price > 0 ? `${item.price.toLocaleString()}원` : '가격 확인 필요'}</span>
                  <span className="text-[9px] text-slate-400">{typeLabels[item.productType]}</span>
                </div>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
