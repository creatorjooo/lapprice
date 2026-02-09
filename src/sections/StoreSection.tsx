import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import type { Laptop } from '@/types';
import { categories } from '@/data/laptops';

interface StoreSectionProps {
  laptops: Laptop[];
  onNavigate: (section: string) => void;
  onCategorySelect: (category: string) => void;
}

export default function StoreSection({ laptops, onNavigate, onCategorySelect }: StoreSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [scrollPosition, setScrollPosition] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      const newPosition = direction === 'left' 
        ? scrollPosition - scrollAmount 
        : scrollPosition + scrollAmount;
      scrollContainerRef.current.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  // Get featured laptops (hot deals)
  const featuredLaptops = laptops
    .filter(l => l.isHot || l.discount.percent >= 20)
    .slice(0, 8);

  return (
    <section
      id="store"
      ref={ref}
      className="relative bg-slate-50 dark:bg-slate-100 py-20"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <p className="text-sm text-slate-500 font-medium tracking-wider uppercase mb-2">
            LapPrice 스토어
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-slate-900 tracking-tight">
            나에게 딱 맞는
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              {" "}노트북을 찾아보세요.
            </span>
          </h2>
        </motion.div>

        {/* Category Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-16"
        >
          {categories.map((category, index) => (
            <motion.button
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              onClick={() => onCategorySelect(category.id)}
              className="group relative p-6 bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 text-left"
            >
              <span className="text-3xl mb-3 block">{category.icon}</span>
              <p className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                {category.name}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {category.count.toLocaleString()}개 제품
              </p>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all absolute bottom-6 right-6" />
            </motion.button>
          ))}
        </motion.div>

        {/* Featured Deals Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-semibold text-slate-900">오늘의 특가</h3>
            <div className="flex gap-2">
              <button
                onClick={() => scroll('left')}
                className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scroll('right')}
                className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {featuredLaptops.map((laptop, index) => (
              <motion.div
                key={laptop.id}
                initial={{ opacity: 0, x: 20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.5 + index * 0.05 }}
                onClick={() => onNavigate('store')}
                className="flex-shrink-0 w-[240px] bg-white rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="aspect-[4/3] bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                  <span className="text-5xl group-hover:scale-110 transition-transform">💻</span>
                </div>
                {laptop.discount.percent > 0 && (
                  <span className="inline-block px-2 py-1 bg-rose-500 text-white text-xs font-medium rounded-full mb-2">
                    {laptop.discount.percent}% 할인
                  </span>
                )}
                <p className="text-xs text-slate-500">{laptop.brand}</p>
                <p className="font-semibold text-slate-900 line-clamp-1">{laptop.name}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-lg font-bold text-slate-900">
                    {laptop.prices.current.toLocaleString()}원
                  </span>
                  {laptop.discount.percent > 0 && (
                    <span className="text-sm text-slate-400 line-through">
                      {laptop.prices.original.toLocaleString()}원
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 flex flex-wrap gap-4 justify-center"
        >
          {['신제품', '베스트셀러', '100만원 이하', '게이밍 특가'].map((link) => (
            <button
              key={link}
              onClick={() => onNavigate('store')}
              className="px-6 py-3 bg-white rounded-full text-sm font-medium text-slate-700 hover:bg-slate-900 hover:text-white transition-all shadow-sm hover:shadow-md"
            >
              {link}
            </button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
