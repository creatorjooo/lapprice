import { useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { ExternalLink, Zap, ChevronRight, GraduationCap, Shield, Smartphone, Battery, Cpu, Monitor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Laptop } from '@/types';
import { trackAffiliateClick, getPlatformKey } from '@/utils/tracking';

interface AppleSectionProps {
  laptops: Laptop[];
}

// M칩 비교 데이터
const chipComparison = [
  { chip: 'M4', cpu: '10코어', gpu: '10코어', memory: '최대 32GB', target: '일상/학생/사무', badge: '가성비' },
  { chip: 'M4 Pro', cpu: '12코어', gpu: '16코어', memory: '최대 48GB', target: '개발/영상편집', badge: '프로' },
  { chip: 'M4 Max', cpu: '16코어', gpu: '40코어', memory: '최대 128GB', target: '3D/전문 영상', badge: '최강' },
];

// "어떤 맥북?" 가이드
const buyingGuide = [
  {
    question: '가벼운 맥북이 필요해요',
    answer: 'MacBook Air 13" M4',
    reason: '1.24kg, 18시간 배터리. 카페에서도, 도서관에서도.',
    id: '13',
  },
  {
    question: '큰 화면으로 작업하고 싶어요',
    answer: 'MacBook Air 15" M4',
    reason: '15.3인치 넓은 화면에 6스피커 사운드. 재택근무 최적.',
    id: '14',
  },
  {
    question: '영상 편집을 해요',
    answer: 'MacBook Pro 14" M4 Pro',
    reason: 'M4 Pro 12코어로 4K ProRes 실시간 편집. 크리에이터 필수.',
    id: '16',
  },
  {
    question: '가장 강력한 맥이 필요해요',
    answer: 'MacBook Pro 16" M4 Max',
    reason: 'M4 Max 16코어 CPU + 40코어 GPU. 이 이상은 없습니다.',
    id: '17',
  },
];

export default function AppleSection({ laptops }: AppleSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const macbooks = useMemo(() => {
    return laptops.filter((l) => l.brand === '애플').sort((a, b) => a.prices.current - b.prices.current);
  }, [laptops]);

  const handleStoreClick = (laptop: Laptop, store: typeof laptop.stores[0]) => {
    trackAffiliateClick({
      productId: laptop.id,
      platform: getPlatformKey(store.store),
      source: 'apple_section',
      url: store.url,
      productName: laptop.name,
    });
  };

  if (macbooks.length === 0) return null;

  return (
    <section id="apple" ref={ref} className="relative overflow-hidden">
      {/* Part 1: Hero Banner - Apple 스타일 */}
      <div className="bg-[#000000] text-white py-20 sm:py-28">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <p className="text-[#86868b] text-sm font-medium tracking-wider mb-4">APPLE</p>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight mb-6">
              Mac.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2997ff] via-[#a855f7] to-[#ec4899]">
                최저가로 만나세요.
              </span>
            </h2>
            <p className="text-[#86868b] text-lg sm:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
              MacBook Air부터 MacBook Pro까지, 10개 쇼핑몰의
              실시간 최저가를 비교해드립니다.
            </p>

            {/* Quick Stats */}
            <div className="flex items-center justify-center gap-8 sm:gap-16">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-semibold">{macbooks.length}</p>
                <p className="text-xs text-[#86868b] mt-1">모델</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-semibold">
                  {Math.min(...macbooks.map((m) => m.prices.current)).toLocaleString()}원~
                </p>
                <p className="text-xs text-[#86868b] mt-1">최저가</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-semibold">M4</p>
                <p className="text-xs text-[#86868b] mt-1">최신 칩</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Part 2: MacBook 라인업 카드 */}
      <div className="bg-[#f5f5f7] py-16 sm:py-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mb-12"
          >
            <h3 className="text-3xl sm:text-4xl font-semibold text-[#1d1d1f] mb-3">
              MacBook 라인업
            </h3>
            <p className="text-[#86868b] text-lg">
              나에게 맞는 Mac을 찾아보세요
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {macbooks.map((mac, index) => {
              const lowestStore = mac.stores.reduce((min, s) => (s.price < min.price ? s : min), mac.stores[0]);

              return (
                <motion.div
                  key={mac.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                  className="bg-white rounded-3xl p-6 hover:shadow-xl transition-all group"
                >
                  {/* Editor Pick Badge */}
                  {mac.editorPick && (
                    <div className="mb-3">
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold">
                        {mac.editorPick}
                      </Badge>
                    </div>
                  )}

                  {/* Product Image */}
                  <div className="aspect-square bg-gradient-to-br from-[#f5f5f7] to-white rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <span className="text-5xl">💻</span>
                  </div>

                  {/* Name & Chip */}
                  <div className="mb-3">
                    <p className="text-[10px] text-[#86868b] uppercase tracking-wider">Apple</p>
                    <h4 className="text-base font-semibold text-[#1d1d1f] leading-tight">{mac.name}</h4>
                    <p className="text-xs text-[#86868b] mt-1">{mac.specs.cpu}</p>
                  </div>

                  {/* Key Specs */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[10px] bg-[#f5f5f7] text-[#1d1d1f] px-2 py-0.5 rounded-full">{mac.specs.ram}GB</span>
                    <span className="text-[10px] bg-[#f5f5f7] text-[#1d1d1f] px-2 py-0.5 rounded-full">{mac.specs.storage >= 1024 ? `${mac.specs.storage / 1024}TB` : `${mac.specs.storage}GB`}</span>
                    <span className="text-[10px] bg-[#f5f5f7] text-[#1d1d1f] px-2 py-0.5 rounded-full">{mac.specs.weight}kg</span>
                  </div>

                  {/* Editor Comment */}
                  {mac.editorComment && (
                    <p className="text-[10px] text-[#86868b] italic mb-3 line-clamp-2">
                      &ldquo;{mac.editorComment}&rdquo;
                    </p>
                  )}

                  {/* Price */}
                  <div className="mb-3 pt-3 border-t border-[#f5f5f7]">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-[#1d1d1f]">
                        {mac.prices.current.toLocaleString()}원
                      </span>
                    </div>
                    {mac.discount.percent > 0 && (
                      <p className="text-xs text-[#86868b] line-through">
                        {mac.prices.original.toLocaleString()}원
                      </p>
                    )}
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      역대최저 {mac.prices.lowest.toLocaleString()}원
                    </p>
                  </div>

                  {/* Editor Score */}
                  {mac.editorScore && (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 bg-[#f5f5f7] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          style={{ width: `${mac.editorScore}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-[#1d1d1f]">{mac.editorScore}</span>
                    </div>
                  )}

                  {/* CTA */}
                  <a
                    href={lowestStore.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleStoreClick(mac, lowestStore)}
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-[#0071e3] hover:bg-[#0077ed] text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {lowestStore.store} 최저가 구매
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>

                  {/* Other Stores */}
                  {mac.stores.length > 1 && (
                    <div className="mt-2 space-y-1">
                      {mac.stores.slice(1, 3).map((store, i) => (
                        <a
                          key={i}
                          href={store.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleStoreClick(mac, store)}
                          className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-[#f5f5f7] transition-colors text-[10px]"
                        >
                          <span className="text-[#86868b]">{store.store}</span>
                          <span className="font-medium text-[#1d1d1f]">{store.price.toLocaleString()}원</span>
                        </a>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Part 3: 어떤 맥북이 나한테 맞을까? */}
      <div className="bg-white py-16 sm:py-20">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center mb-12"
          >
            <h3 className="text-3xl sm:text-4xl font-semibold text-[#1d1d1f] mb-3">
              어떤 맥북이 나한테 맞을까?
            </h3>
            <p className="text-[#86868b] text-lg">
              용도에 따라 추천해드립니다
            </p>
          </motion.div>

          <div className="space-y-4">
            {buyingGuide.map((item, index) => {
              const mac = macbooks.find((m) => m.id === item.id);
              const store = mac?.stores[0];

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
                  className="bg-[#f5f5f7] rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:bg-[#ebebed] transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1d1d1f] mb-1">
                      &ldquo;{item.question}&rdquo;
                    </p>
                    <p className="text-lg font-bold text-[#0071e3]">{item.answer}</p>
                    <p className="text-xs text-[#86868b] mt-1">{item.reason}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {mac && (
                      <span className="text-lg font-bold text-[#1d1d1f]">
                        {mac.prices.current.toLocaleString()}원
                      </span>
                    )}
                    {mac && store && (
                      <a
                        href={store.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleStoreClick(mac, store)}
                        className="flex items-center gap-1 px-4 py-2 bg-[#0071e3] hover:bg-[#0077ed] text-white rounded-full text-xs font-semibold transition-colors"
                      >
                        구매
                        <ChevronRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Part 4: Apple Silicon 칩 비교 */}
      <div className="bg-[#000000] text-white py-16 sm:py-20">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center mb-12"
          >
            <h3 className="text-3xl sm:text-4xl font-semibold mb-3">
              Apple Silicon 칩 비교
            </h3>
            <p className="text-[#86868b] text-lg">
              M4 시리즈의 모든 것
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {chipComparison.map((chip, index) => (
              <motion.div
                key={chip.chip}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 transition-colors"
              >
                <Badge className="bg-white/10 text-white text-[10px] mb-4">{chip.badge}</Badge>
                <h4 className="text-2xl font-bold mb-4">{chip.chip}</h4>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#86868b] flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> CPU</span>
                    <span className="font-medium">{chip.cpu}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#86868b] flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> GPU</span>
                    <span className="font-medium">{chip.gpu}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#86868b] flex items-center gap-1.5"><Battery className="w-3.5 h-3.5" /> 메모리</span>
                    <span className="font-medium">{chip.memory}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-[#86868b]">추천 용도</p>
                  <p className="text-sm font-medium mt-1">{chip.target}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Part 5: 맥북 구매 팁 & 교육할인 */}
      <div className="bg-[#f5f5f7] py-16 sm:py-20">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center mb-12"
          >
            <h3 className="text-3xl sm:text-4xl font-semibold text-[#1d1d1f] mb-3">
              더 알뜰하게 맥북 사기
            </h3>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 교육할인 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="bg-white rounded-2xl p-6"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <GraduationCap className="w-5 h-5 text-blue-600" />
              </div>
              <h4 className="font-bold text-[#1d1d1f] mb-2">교육 할인</h4>
              <p className="text-xs text-[#86868b] leading-relaxed">
                대학생/교직원이라면 Apple Education Store에서 최대 12% 할인. 
                Back to School 시즌에는 AirPods 무료 증정도.
              </p>
              <a
                href="https://www.apple.com/kr/shop/go/education"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#0071e3] text-xs font-medium mt-3 hover:underline"
              >
                교육 스토어 가기 <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </motion.div>

            {/* 인증 리퍼 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.65 }}
              className="bg-white rounded-2xl p-6"
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <h4 className="font-bold text-[#1d1d1f] mb-2">인증 리퍼비시</h4>
              <p className="text-xs text-[#86868b] leading-relaxed">
                Apple 인증 리퍼비시 제품은 새 제품과 동일한 1년 보증. 
                최대 15% 할인된 가격에 구매 가능.
              </p>
              <a
                href="https://www.apple.com/kr/shop/refurbished/mac"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#0071e3] text-xs font-medium mt-3 hover:underline"
              >
                리퍼비시 보기 <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </motion.div>

            {/* 생태계 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="bg-white rounded-2xl p-6"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Smartphone className="w-5 h-5 text-purple-600" />
              </div>
              <h4 className="font-bold text-[#1d1d1f] mb-2">생태계 시너지</h4>
              <p className="text-xs text-[#86868b] leading-relaxed">
                iPhone, iPad, AirPods와 완벽 연동. 
                AirDrop, Handoff, 범용 제어로 기기 간 끊김 없는 작업.
              </p>
            </motion.div>

            {/* 리셀 가치 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.75 }}
              className="bg-white rounded-2xl p-6"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                <span className="text-lg">💰</span>
              </div>
              <h4 className="font-bold text-[#1d1d1f] mb-2">높은 리셀 가치</h4>
              <p className="text-xs text-[#86868b] leading-relaxed">
                MacBook은 중고 시장에서 가치가 잘 유지됩니다. 
                2-3년 후 판매 시에도 구매가의 50-70% 회수 가능.
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Part 6: 장단점 솔직 비교 */}
      <div className="bg-white py-16 sm:py-20">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-center mb-10"
          >
            <h3 className="text-3xl sm:text-4xl font-semibold text-[#1d1d1f] mb-3">
              맥북, 솔직히 말하면
            </h3>
            <p className="text-[#86868b]">
              좋은 점만 말하지 않습니다
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* 장점 */}
            <div className="bg-emerald-50 rounded-2xl p-6">
              <h4 className="font-bold text-emerald-800 mb-4 text-lg">이래서 맥북</h4>
              <div className="space-y-3">
                {[
                  'Apple Silicon 칩의 압도적 전력 효율',
                  'macOS + iOS 생태계 연동',
                  '업계 최고 수준의 디스플레이',
                  '올데이 배터리 (최대 24시간)',
                  '빌드 퀄리티와 높은 리셀 가치',
                  '조용한 팬리스 설계 (Air)',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-emerald-700">
                    <span className="text-emerald-500 mt-0.5 shrink-0">+</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 단점 */}
            <div className="bg-rose-50 rounded-2xl p-6">
              <h4 className="font-bold text-rose-800 mb-4 text-lg">이건 알고 사세요</h4>
              <div className="space-y-3">
                {[
                  '게임 호환성 부족 (Windows 게임 제한)',
                  '포트가 적은 편 (Air는 2개)',
                  '메모리/저장공간 업그레이드 불가',
                  'Windows 전용 소프트웨어 제한',
                  '수리 비용이 높음',
                  '가격 대비 저장공간이 작은 기본 사양',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-rose-700">
                    <span className="text-rose-500 mt-0.5 shrink-0">-</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-[#86868b] mt-6">
            * 솔직한 장단점을 알려드리는 게 저희의 역할입니다.
          </p>
        </div>
      </div>
    </section>
  );
}
