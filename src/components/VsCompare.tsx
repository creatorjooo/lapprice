import { useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Laptop } from '@/types';
import { isAffiliatePlatform, trackAffiliateClick, getPlatformKey } from '@/utils/tracking';

interface VsCompareProps {
  laptops: Laptop[];
}

interface VsPair {
  idA: string;
  idB: string;
  title: string;
  conclusion: string;
}

const vsPairs: VsPair[] = [
  {
    idA: '1',
    idB: '4',
    title: '게이밍 가성비 대결',
    conclusion: '가성비는 MSI Thin, 성능은 Gaming A16',
  },
  {
    idA: '9',
    idB: '10',
    title: '울트라북 대결',
    conclusion: '휴대성은 LG 그램, 디스플레이는 ASUS 젠북',
  },
  {
    idA: '6',
    idB: '3',
    title: '고성능 게이밍',
    conclusion: 'OLED+프리미엄은 ROG, 가격은 니트로',
  },
];

export default function VsCompare({ laptops }: VsCompareProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const comparisons = useMemo(() => {
    return vsPairs.map((pair) => {
      const laptopA = laptops.find((l) => l.id === pair.idA);
      const laptopB = laptops.find((l) => l.id === pair.idB);
      return { ...pair, laptopA, laptopB };
    }).filter((c) => c.laptopA && c.laptopB);
  }, [laptops]);

  const getAffiliateUrl = (laptop: Laptop) => {
    const affiliateStore = laptop.stores.find((s) => isAffiliatePlatform(s.store));
    return affiliateStore || laptop.stores[0];
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `${(price / 10000).toFixed(0)}만`;
    return `${(price / 10000).toFixed(1)}만`;
  };

  return (
    <section ref={ref} className="bg-white py-16 sm:py-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 mb-3">
            인기 비교
          </h2>
          <p className="text-slate-500 text-lg">
            가장 많이 비교하는 조합을 한눈에
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {comparisons.map(({ idA, idB, title, conclusion, laptopA, laptopB }, index) => {
            if (!laptopA || !laptopB) return null;
            const storeA = getAffiliateUrl(laptopA);
            const storeB = getAffiliateUrl(laptopB);

            return (
              <motion.div
                key={`${idA}-${idB}`}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 * index }}
                className="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:shadow-lg transition-all"
              >
                {/* Title */}
                <Badge className="bg-purple-100 text-purple-700 text-xs mb-4">{title}</Badge>

                {/* VS Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-center flex-1">
                    <p className="text-xs text-slate-500">{laptopA.brand}</p>
                    <p className="text-sm font-bold text-slate-900 line-clamp-1">{laptopA.name}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs mx-2 shrink-0">
                    VS
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-xs text-slate-500">{laptopB.brand}</p>
                    <p className="text-sm font-bold text-slate-900 line-clamp-1">{laptopB.name}</p>
                  </div>
                </div>

                {/* Specs Comparison */}
                <div className="space-y-2 mb-4">
                  <CompareRow label="가격" valA={`${formatPrice(laptopA.prices.current)}원`} valB={`${formatPrice(laptopB.prices.current)}원`} better={laptopA.prices.current < laptopB.prices.current ? 'a' : 'b'} />
                  <CompareRow label="GPU" valA={laptopA.specs.gpu.split(' ').slice(0, 2).join(' ')} valB={laptopB.specs.gpu.split(' ').slice(0, 2).join(' ')} />
                  <CompareRow label="무게" valA={`${laptopA.specs.weight}kg`} valB={`${laptopB.specs.weight}kg`} better={laptopA.specs.weight < laptopB.specs.weight ? 'a' : 'b'} />
                  <CompareRow label="에디터" valA={laptopA.editorScore ? `${laptopA.editorScore}점` : '-'} valB={laptopB.editorScore ? `${laptopB.editorScore}점` : '-'} better={(laptopA.editorScore || 0) > (laptopB.editorScore || 0) ? 'a' : 'b'} />
                </div>

                {/* Conclusion */}
                <p className="text-xs text-slate-600 bg-white rounded-lg p-3 mb-4 text-center font-medium">
                  {conclusion}
                </p>

                {/* Buy Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={storeA.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackAffiliateClick({ productId: laptopA.id, platform: getPlatformKey(storeA.store), source: 'compare', url: storeA.url, productName: laptopA.name })}
                    className="flex items-center justify-center gap-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    {laptopA.name.split(' ')[0]} 구매
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                  <a
                    href={storeB.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackAffiliateClick({ productId: laptopB.id, platform: getPlatformKey(storeB.store), source: 'compare', url: storeB.url, productName: laptopB.name })}
                    className="flex items-center justify-center gap-1 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    {laptopB.name.split(' ')[0]} 구매
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CompareRow({ label, valA, valB, better }: { label: string; valA: string; valB: string; better?: 'a' | 'b' }) {
  return (
    <div className="flex items-center text-xs">
      <span className={`flex-1 text-right pr-3 ${better === 'a' ? 'text-emerald-600 font-bold' : 'text-slate-600'}`}>
        {valA}
      </span>
      <span className="w-16 text-center text-slate-400 font-medium shrink-0">{label}</span>
      <span className={`flex-1 text-left pl-3 ${better === 'b' ? 'text-emerald-600 font-bold' : 'text-slate-600'}`}>
        {valB}
      </span>
    </div>
  );
}
