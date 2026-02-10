import { useRef, useEffect } from 'react';
import { motion, useInView, useAnimation } from 'framer-motion';
import { ArrowRight, Monitor, Cpu, Laptop, ExternalLink, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getTopPicks, getHotDeals } from '@/data/index';
import { trackAffiliateClick, getPlatformKey } from '@/utils/tracking';

interface HomePageProps {
  onNavigateToPage: (page: string) => void;
}

export default function HomePage({ onNavigateToPage }: HomePageProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) controls.start('visible');
  }, [isInView, controls]);

  const laptopPicks = getTopPicks('laptop', 3);
  const monitorPicks = getTopPicks('monitor', 3);
  const desktopPicks = getTopPicks('desktop', 3);
  const hotDeals = getHotDeals(6);

  const categories = [
    {
      name: '노트북',
      icon: <Laptop className="w-8 h-8" />,
      emoji: '💻',
      hash: 'laptop',
      description: '게이밍, 울트라북, 비즈니스, 크리에이터',
      count: '1,200+',
      products: laptopPicks,
      gradient: 'from-blue-600 to-indigo-700',
    },
    {
      name: '모니터',
      icon: <Monitor className="w-8 h-8" />,
      emoji: '🖥️',
      hash: 'monitor',
      description: '게이밍, 전문가용, 울트라와이드, 가성비',
      count: '450+',
      products: monitorPicks,
      gradient: 'from-purple-600 to-pink-600',
    },
    {
      name: '데스크탑',
      icon: <Cpu className="w-8 h-8" />,
      emoji: '🖥️',
      hash: 'desktop',
      description: '게이밍PC, 미니PC, 올인원, 사무용',
      count: '320+',
      products: desktopPicks,
      gradient: 'from-emerald-600 to-teal-600',
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <section ref={ref} className="relative min-h-screen bg-slate-900 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-blue-500/20 via-purple-500/10 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen pt-12 pb-20 px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={controls}
            variants={{ visible: { opacity: 1, y: 0, transition: { duration: 0.8, delay: 0.2 } } }}
            className="text-center max-w-4xl mx-auto"
          >
            <p className="text-emerald-400 text-sm font-medium tracking-wider uppercase mb-4">
              실시간 가격비교
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-semibold text-white tracking-tight leading-[1.1] mb-6">
              IT 제품 최저가,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                한눈에 비교하세요.
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              노트북, 모니터, 데스크탑 — 10개 쇼핑몰의 실시간 가격을 비교하고
              전문가 추천으로 최적의 구매 시점을 찾아보세요.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onNavigateToPage('laptop')}
                className="group flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-base font-medium transition-all"
              >
                노트북 최저가
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => onNavigateToPage('monitor')}
                className="flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-full text-base font-medium transition-all"
              >
                모니터 최저가
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigateToPage('desktop')}
                className="flex items-center gap-2 px-8 py-4 text-emerald-400 hover:text-emerald-300 text-base font-medium transition-colors"
              >
                데스크탑 보기
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={controls}
            variants={{ visible: { opacity: 1, transition: { duration: 0.8, delay: 0.8 } } }}
            className="mt-20 grid grid-cols-3 gap-8 sm:gap-16"
          >
            {[
              { value: '2,000+', label: '제품' },
              { value: '10개', label: '쇼핑몰' },
              { value: '24/7', label: '실시간 모니터링' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-semibold text-white">{stat.value}</p>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 border-2 border-slate-600 rounded-full flex justify-center pt-2">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1 h-2 bg-slate-400 rounded-full"
            />
          </div>
        </motion.div>
      </section>

      {/* Category Cards */}
      <section className="py-16 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">카테고리별 최저가</h2>
            <p className="text-slate-500">원하는 제품군을 선택하세요</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <button
                key={cat.hash}
                onClick={() => onNavigateToPage(cat.hash)}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-br text-white p-8 text-left transition-all hover:scale-[1.02] hover:shadow-xl"
                style={{ background: undefined }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient} opacity-90`} />
                <div className="relative z-10">
                  <div className="text-5xl mb-4">{cat.emoji}</div>
                  <h3 className="text-2xl font-bold mb-1">{cat.name}</h3>
                  <p className="text-white/70 text-sm mb-4">{cat.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{cat.count} 제품</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Top Picks per Category */}
      {categories.map((cat) => (
        <section key={cat.hash} className="py-12 bg-slate-50 border-b border-slate-100">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{cat.emoji} {cat.name} 인기 TOP 3</h2>
                <p className="text-slate-500 text-sm mt-1">에디터 추천 기반</p>
              </div>
              <button
                onClick={() => onNavigateToPage(cat.hash)}
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                전체보기 <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cat.products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => onNavigateToPage(cat.hash)}
                  className="cursor-pointer group bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
                      {product.images?.[0]?.startsWith('http') ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-contain" loading="lazy" />
                      ) : (
                        cat.emoji
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-slate-500">{product.brand}</p>
                        {product.editorPick && (
                          <Badge className="bg-amber-500/10 text-amber-600 text-[9px] px-1.5 h-4">
                            {product.editorPick}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                      {product.editorComment && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 italic">
                          &ldquo;{product.editorComment}&rdquo;
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-base font-bold text-slate-900">
                          {product.prices.current.toLocaleString()}원
                        </span>
                        {product.discount.percent > 0 && (
                          <span className="text-xs text-emerald-600 font-medium">
                            -{product.discount.percent}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Hot Deals (All Categories) */}
      <section className="py-16 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">🔥 오늘의 핫딜</h2>
            <p className="text-slate-500">전 카테고리 통합 최고의 할인</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {hotDeals.map((deal) => {
              const typeLabel = deal.productType === 'laptop' ? '💻 노트북' : deal.productType === 'monitor' ? '🖥️ 모니터' : '🖥️ 데스크탑';
              const pageHash = deal.productType;
              return (
                <div
                  key={deal.id}
                  onClick={() => onNavigateToPage(pageHash)}
                  className="cursor-pointer group bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-all hover:-translate-y-0.5 relative overflow-hidden"
                >
                  {deal.discount.percent >= 20 && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-rose-500 text-white text-xs">-{deal.discount.percent}%</Badge>
                    </div>
                  )}
                  <Badge variant="secondary" className="text-[10px] mb-3">{typeLabel}</Badge>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                      {deal.images?.[0]?.startsWith('http') ? (
                        <img src={deal.images[0]} alt={deal.name} className="w-full h-full object-contain" loading="lazy" />
                      ) : (
                        deal.productType === 'laptop' ? '💻' : deal.productType === 'monitor' ? '🖥️' : '🖥️'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">{deal.brand}</p>
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {deal.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-base font-bold text-slate-900">{deal.prices.current.toLocaleString()}원</span>
                        <span className="text-xs text-slate-400 line-through">{deal.prices.original.toLocaleString()}원</span>
                      </div>
                    </div>
                  </div>
                  {deal.stores?.[0] && (
                    <a
                      href={deal.stores[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        trackAffiliateClick({
                          productId: deal.id,
                          platform: getPlatformKey(deal.stores[0].store),
                          source: 'cta_button',
                          url: deal.stores[0].url,
                          productName: deal.name,
                        });
                      }}
                      className="mt-3 flex items-center justify-center gap-1.5 w-full h-8 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold transition-all"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {deal.stores[0].store} 최저가 구매
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
