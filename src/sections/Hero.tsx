import { useRef, useEffect } from 'react';
import { motion, useInView, useAnimation } from 'framer-motion';
import { ChevronRight, ArrowRight } from 'lucide-react';

interface HeroProps {
  onNavigate: (section: string) => void;
}

export default function Hero({ onNavigate }: HeroProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start('visible');
    }
  }, [isInView, controls]);

  return (
    <section
      id="home"
      ref={ref}
      className="relative min-h-screen bg-slate-900 overflow-hidden"
    >
      {/* Background Gradient */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-radial from-blue-500/20 via-purple-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen pt-12 pb-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={controls}
          variants={{
            visible: { opacity: 1, y: 0, transition: { duration: 0.8, delay: 0.2 } }
          }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Pre-title */}
          <p className="text-emerald-400 text-sm font-medium tracking-wider uppercase mb-4">
            실시간 가격비교
          </p>

          {/* Main Title */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-semibold text-white tracking-tight leading-[1.1] mb-6">
            노트북 최저가,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
              한눈에 비교하세요.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            쿠팡, 네이버, 11번가 등 10개 쇼핑몰의 실시간 가격을 비교하고
            전문가 추천으로 최적의 구매 시점을 찾아보세요.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('store')}
              className="group flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-base font-medium transition-all"
            >
              최저가 보기
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => onNavigate('gaming')}
              className="flex items-center gap-2 px-8 py-4 text-blue-400 hover:text-blue-300 text-base font-medium transition-colors"
            >
              게이밍 노트북
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Hero Visual */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={controls}
          variants={{
            visible: { opacity: 1, y: 0, transition: { duration: 1, delay: 0.5 } }
          }}
          className="mt-16 relative"
        >
          <div className="relative w-[300px] sm:w-[400px] lg:w-[500px] aspect-[4/3]">
            {/* Laptop Mockup */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl shadow-2xl transform perspective-1000 rotate-x-12">
              <div className="absolute inset-4 bg-slate-900 rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-purple-500/20 to-pink-500/30" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-6xl sm:text-7xl lg:text-8xl">💻</span>
                </div>
              </div>
            </div>
            {/* Glow Effect */}
            <div className="absolute -inset-10 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-3xl -z-10" />
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={controls}
          variants={{
            visible: { opacity: 1, transition: { duration: 0.8, delay: 0.8 } }
          }}
          className="mt-20 grid grid-cols-3 gap-8 sm:gap-16"
        >
          {[
            { value: '1,200+', label: '제품' },
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

      {/* Scroll Indicator */}
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
  );
}
