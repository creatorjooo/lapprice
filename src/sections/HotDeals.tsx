import { useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { Zap, ExternalLink, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Laptop } from '@/types';
import { isAffiliatePlatform, trackAffiliateClick, getPlatformKey } from '@/utils/tracking';

interface HotDealsProps {
  laptops: Laptop[];
}

export default function HotDeals({ laptops }: HotDealsProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const hotDeals = useMemo(() => {
    // 선정 기준: 가격지수 높은 것, 할인율 높은 것, 어필리에이트 스토어 우선
    const candidates = laptops
      .filter((l) => l.priceIndex >= 78 || l.discount.percent >= 20)
      .sort((a, b) => {
        // 어필리에이트 스토어가 있는 제품 우선
        const aHasAffiliate = a.stores.some((s) => isAffiliatePlatform(s.store));
        const bHasAffiliate = b.stores.some((s) => isAffiliatePlatform(s.store));
        if (aHasAffiliate && !bHasAffiliate) return -1;
        if (!aHasAffiliate && bHasAffiliate) return 1;
        return b.priceIndex - a.priceIndex;
      });
    return candidates.slice(0, 3);
  }, [laptops]);

  const getTimingLabel = (laptop: Laptop) => {
    const current = laptop.prices.current;
    const lowest = laptop.prices.lowest;
    if (current <= lowest) return '역대 최저가!';
    const diff = ((current - lowest) / lowest) * 100;
    if (diff <= 5) return '최저가 근접';
    return `평균 대비 -${Math.round(((laptop.prices.average - current) / laptop.prices.average) * 100)}%`;
  };

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <section ref={ref} className="bg-gradient-to-b from-slate-900 to-slate-800 py-16 sm:py-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-10"
        >
          <div>
            <h2 className="text-3xl sm:text-4xl font-semibold text-white mb-2">
              오늘의 핫딜
            </h2>
            <p className="text-slate-400">
              지금 사면 가장 이득인 제품들
            </p>
          </div>
          <span className="text-sm text-slate-500">{today} 기준</span>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {hotDeals.map((laptop, index) => {
            // 어필리에이트 스토어 중 최저가 찾기
            const affiliateStore = laptop.stores.find((s) => isAffiliatePlatform(s.store)) || laptop.stores[0];
            const timingLabel = getTimingLabel(laptop);

            return (
              <motion.div
                key={laptop.id}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.15 * index }}
                className="relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-blue-500/50 transition-all group"
              >
                {/* Rank */}
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">
                  {index + 1}
                </div>

                {/* Product Info */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-slate-700/50 rounded-xl flex items-center justify-center text-3xl shrink-0 overflow-hidden">
                    {laptop.images?.[0]?.startsWith('http') ? (
                      <img src={laptop.images[0]} alt={laptop.name} className="w-full h-full object-contain" loading="lazy" />
                    ) : '💻'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">{laptop.brand}</p>
                    <h3 className="text-white font-bold truncate">{laptop.name}</h3>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-2xl font-bold text-white">
                      {laptop.prices.current.toLocaleString()}원
                    </span>
                    {laptop.discount.percent > 0 && (
                      <Badge className="bg-rose-500/20 text-rose-400 text-xs">
                        <TrendingDown className="w-3 h-3 mr-1" />
                        -{laptop.discount.percent}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-emerald-400 font-medium">
                    {timingLabel}
                  </p>
                </div>

                {/* CTA */}
                <a
                  href={affiliateStore.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackAffiliateClick({ productId: laptop.id, platform: getPlatformKey(affiliateStore.store), source: 'cta_button', url: affiliateStore.url, productName: laptop.name })}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg"
                >
                  <Zap className="w-4 h-4" />
                  {affiliateStore.store}에서 구매하기
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </a>

                {/* Timing hint */}
                <p className="text-center text-[10px] text-slate-500 mt-2">
                  가격 유지 보장 없음
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
