import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { categories } from '@/data/laptops';
import { cn } from '@/lib/utils';

interface CategoriesProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export default function Categories({ selectedCategory, onSelectCategory }: CategoriesProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  return (
    <section id="categories" ref={ref} className="relative py-12 lg:py-16">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h2 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mb-2">
              카테고리
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              원하는 카테고리를 선택하여 맞춤형 노트북을 찾아보세요
            </p>
          </motion.div>

          {/* Categories Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 lg:gap-4"
          >
            {categories.map((category, index) => {
              const isSelected = selectedCategory === category.id;
              const isHovered = hoveredCategory === category.id;

              return (
                <motion.button
                  key={category.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.1 * index, duration: 0.4 }}
                  onClick={() => onSelectCategory(category.id)}
                  onMouseEnter={() => setHoveredCategory(category.id)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={cn(
                    'relative group p-4 lg:p-6 rounded-2xl border-2 transition-all duration-300',
                    isSelected
                      ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500'
                  )}
                >
                  {/* Hover Glow Effect */}
                  {!isSelected && (
                    <div
                      className={cn(
                        'absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 transition-opacity duration-300',
                        isHovered ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  )}

                  <div className="relative z-10 flex flex-col items-center text-center">
                    <span className="text-2xl lg:text-3xl mb-2">{category.icon}</span>
                    <span
                      className={cn(
                        'text-sm font-semibold mb-1 transition-colors',
                        isSelected
                          ? 'text-white dark:text-slate-900'
                          : 'text-slate-900 dark:text-white'
                      )}
                    >
                      {category.name}
                    </span>
                    <span
                      className={cn(
                        'text-xs transition-colors',
                        isSelected
                          ? 'text-slate-300 dark:text-slate-500'
                          : 'text-slate-500 dark:text-slate-400'
                      )}
                    >
                      {category.count.toLocaleString()}개
                    </span>
                  </div>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <motion.div
                      layoutId="selectedCategory"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-emerald-500 rounded-full"
                    />
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
