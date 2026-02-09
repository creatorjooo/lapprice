import { useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { Laptop } from '@/types';

interface BuyingGuideProps {
  laptops: Laptop[];
  onCategorySelect: (category: string) => void;
}

interface GuideCategory {
  id: string;
  title: string;
  icon: string;
  specs: string[];
  filterCategory: string;
}

const guideCategories: GuideCategory[] = [
  {
    id: 'gaming',
    title: '게이밍',
    icon: '🎮',
    specs: ['RTX 4060 이상', '16GB+ RAM', '165Hz+ 화면'],
    filterCategory: 'gaming',
  },
  {
    id: 'office',
    title: '사무/학생',
    icon: '📚',
    specs: ['8GB RAM 이상', '가성비 중시', '가벼움 중시'],
    filterCategory: 'business',
  },
  {
    id: 'creator',
    title: '영상편집',
    icon: '🎬',
    specs: ['고성능 CPU', '32GB+ RAM', '색정확도 높은'],
    filterCategory: 'creator',
  },
  {
    id: 'portable',
    title: '가벼운 것',
    icon: '🪶',
    specs: ['1.5kg 이하', '올데이 배터리', '얇은 디자인'],
    filterCategory: 'ultrabook',
  },
];

export default function BuyingGuide({ laptops, onCategorySelect }: BuyingGuideProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  // 각 가이드 카테고리에 대해 에디터 픽 제품 자동 선정
  const picks = useMemo(() => {
    const categoryMap: Record<string, string[]> = {
      gaming: ['gaming'],
      office: ['business', 'budget'],
      creator: ['creator', 'gaming'],
      portable: ['ultrabook'],
    };

    return guideCategories.map((guide) => {
      const categories = categoryMap[guide.id] || [];
      const candidates = laptops.filter(
        (l) => categories.includes(l.category) && l.editorScore
      );
      // 에디터 점수 최고인 제품 선택
      const pick = candidates.sort((a, b) => (b.editorScore || 0) - (a.editorScore || 0))[0];
      return { guide, pick };
    });
  }, [laptops]);

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
            어떤 노트북이 필요하세요?
          </h2>
          <p className="text-slate-500 text-lg">
            전문가가 용도별로 추천해드립니다
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {picks.map(({ guide, pick }, index) => (
            <motion.div
              key={guide.id}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              onClick={() => onCategorySelect(guide.filterCategory)}
              className="group relative bg-slate-50 hover:bg-white rounded-2xl p-6 cursor-pointer transition-all hover:shadow-xl border border-transparent hover:border-slate-200"
            >
              {/* Category Icon & Title */}
              <div className="text-4xl mb-4">{guide.icon}</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{guide.title}</h3>

              {/* Specs */}
              <div className="space-y-1.5 mb-6">
                {guide.specs.map((spec) => (
                  <p key={spec} className="text-sm text-slate-500 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />
                    {spec}
                  </p>
                ))}
              </div>

              {/* Editor Pick */}
              {pick && (
                <div className="bg-white group-hover:bg-slate-50 rounded-xl p-4 border border-slate-100 transition-colors">
                  <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider mb-1">
                    에디터 픽 #{1}
                  </p>
                  <p className="font-bold text-slate-900 text-sm mb-1">{pick.brand} {pick.name}</p>
                  <p className="text-lg font-bold text-slate-900">
                    {pick.prices.current.toLocaleString()}원
                  </p>
                  {pick.editorComment && (
                    <p className="text-xs text-slate-500 mt-2 italic line-clamp-2">
                      &ldquo;{pick.editorComment}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {/* CTA */}
              <div className="mt-4 flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
                자세히 보기
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
