import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { TrendingDown, Package, Percent, RefreshCw, TrendingUp, Sparkles } from 'lucide-react';
import type { Stats as StatsType } from '@/types';

interface StatsProps {
  stats: StatsType;
}

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return (
    <span ref={ref}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

export default function Stats({ stats }: StatsProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const statItems = [
    {
      icon: TrendingDown,
      label: '오늘의 최저가',
      value: stats.todayLowest,
      prefix: '',
      suffix: '원',
      subtext: '역대 최저가 대비 -12%',
      subtextColor: 'text-emerald-600 dark:text-emerald-400',
      bgGradient: 'from-emerald-500/10 to-teal-500/10',
    },
    {
      icon: Package,
      label: '등록 상품',
      value: stats.totalProducts,
      prefix: '',
      suffix: '+',
      subtext: '매일 업데이트',
      subtextColor: 'text-blue-600 dark:text-blue-400',
      bgGradient: 'from-blue-500/10 to-indigo-500/10',
    },
    {
      icon: Percent,
      label: '평균 할인율',
      value: stats.averageDiscount,
      prefix: '',
      suffix: '%',
      subtext: '최대 50% 할인',
      subtextColor: 'text-amber-600 dark:text-amber-400',
      bgGradient: 'from-amber-500/10 to-orange-500/10',
    },
    {
      icon: RefreshCw,
      label: '오늘의 가격 업데이트',
      value: stats.todayUpdates,
      prefix: '',
      suffix: '+',
      subtext: '실시간 반영',
      subtextColor: 'text-purple-600 dark:text-purple-400',
      bgGradient: 'from-purple-500/10 to-pink-500/10',
    },
  ];

  const highlights = [
    {
      icon: TrendingUp,
      label: '오늘의 가격 인하',
      value: stats.priceDrops,
      suffix: '개',
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-500/10',
    },
    {
      icon: Sparkles,
      label: '신규 입고',
      value: stats.newArrivals,
      suffix: '개',
      color: 'text-violet-600 dark:text-violet-400',
      bgColor: 'bg-violet-500/10',
    },
  ];

  return (
    <section ref={ref} className="relative py-16 lg:py-24">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Main Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6"
          >
            {statItems.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="group relative p-5 lg:p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <stat.icon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{stat.label}</p>
                  <p className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                    <AnimatedNumber value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                  </p>
                  <p className={`text-xs font-medium ${stat.subtextColor}`}>
                    {stat.subtext}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-wrap justify-center gap-4"
          >
            {highlights.map((highlight) => (
              <div
                key={highlight.label}
                className="flex items-center gap-3 px-5 py-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <div className={`w-8 h-8 rounded-full ${highlight.bgColor} flex items-center justify-center`}>
                  <highlight.icon className={`w-4 h-4 ${highlight.color}`} />
                </div>
                <span className="text-sm text-slate-600 dark:text-slate-300">{highlight.label}</span>
                <span className={`text-sm font-bold ${highlight.color}`}>
                  {highlight.value}{highlight.suffix}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
