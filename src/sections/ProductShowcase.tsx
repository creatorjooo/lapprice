import { useMemo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ChevronRight, ArrowRight } from 'lucide-react';
import type { Laptop } from '@/types';
import { toImageSrc } from '@/utils/image';

interface ProductShowcaseProps {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  laptops: Laptop[];
  bgColor?: 'dark' | 'light' | 'gradient';
  textColor?: 'light' | 'dark';
  ctaText?: string;
  ctaAction?: () => void;
  secondaryCta?: string;
  secondaryAction?: () => void;
}

export default function ProductShowcase({
  id,
  title,
  subtitle,
  description,
  laptops,
  bgColor = 'dark',
  textColor = 'light',
  ctaText,
  ctaAction,
  secondaryCta,
  secondaryAction,
}: ProductShowcaseProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const isBudgetFocused = title.includes('가성비') || subtitle.includes('알뜰');
  const isPortableFocused = title.includes('울트라북') || subtitle.includes('가볍');

  const showcaseLaptops = useMemo(() => {
    const scored = laptops.map((laptop) => {
      const valueScore = laptop.priceIndex + laptop.discount.percent * 2;
      const portabilityScore = Math.max(0, 120 - laptop.specs.weight * 45);
      const performanceScore = laptop.editorScore || 70;
      const weightedScore = isBudgetFocused
        ? valueScore * 0.6 + portabilityScore * 0.2 + performanceScore * 0.2
        : isPortableFocused
          ? portabilityScore * 0.55 + valueScore * 0.3 + performanceScore * 0.15
          : performanceScore * 0.45 + valueScore * 0.35 + portabilityScore * 0.2;

      return { laptop, weightedScore: Math.round(weightedScore) };
    });

    return scored
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 4);
  }, [isBudgetFocused, isPortableFocused, laptops]);

  const bgClasses = {
    dark: 'bg-slate-900',
    light: 'bg-slate-50 dark:bg-slate-100',
    gradient: 'bg-gradient-to-b from-slate-900 to-slate-800',
  };

  const textClasses = {
    light: 'text-white',
    dark: 'text-slate-900',
  };

  const subtextClasses = {
    light: 'text-slate-400',
    dark: 'text-slate-600',
  };

  return (
    <section
      id={id}
      ref={ref}
      className={`relative min-h-[80vh] flex items-center justify-center py-20 ${bgClasses[bgColor]}`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-center lg:text-left"
          >
            <p className={`text-sm font-medium tracking-wider uppercase mb-4 ${subtextClasses[textColor]}`}>
              {subtitle}
            </p>
            <h2 className={`text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 ${textClasses[textColor]}`}>
              {title}
            </h2>
            <p className={`text-lg sm:text-xl leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0 ${subtextClasses[textColor]}`}>
              {description}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              {ctaText && ctaAction && (
                <button
                  onClick={ctaAction}
                  className="group flex items-center gap-2 text-blue-500 hover:text-blue-400 font-medium text-lg"
                >
                  {ctaText}
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
              {secondaryCta && secondaryAction && (
                <button
                  onClick={secondaryAction}
                  className={`flex items-center gap-2 font-medium text-lg ${textColor === 'light' ? 'text-white/70 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {secondaryCta}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Product Preview */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="grid grid-cols-2 gap-4">
              {showcaseLaptops.map(({ laptop, weightedScore }, index) => (
                <motion.div
                  key={laptop.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                  className={`group relative p-4 sm:p-6 rounded-2xl transition-all duration-300 hover:scale-105 cursor-pointer ${
                    bgColor === 'light' 
                      ? 'bg-white shadow-lg hover:shadow-xl' 
                      : 'bg-white/5 backdrop-blur-sm hover:bg-white/10'
                  }`}
                  onClick={ctaAction}
                >
                  <div className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/90 text-white font-semibold">
                    추천 {weightedScore}점
                  </div>
                  <div className="aspect-square flex items-center justify-center mb-4 overflow-hidden rounded-xl">
                    {laptop.images?.[0]?.startsWith('http') ? (
                      <img src={toImageSrc(laptop.images[0])} alt={laptop.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-4xl sm:text-5xl group-hover:scale-110 transition-transform">💻</span>
                    )}
                  </div>
                  <p className={`text-xs ${textColor === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {laptop.brand}
                  </p>
                  <p className={`text-sm font-semibold line-clamp-2 ${textClasses[textColor]}`}>
                    {laptop.name}
                  </p>
                  <p className="text-emerald-500 text-sm font-medium mt-2">
                    {laptop.prices.current.toLocaleString()}원
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
