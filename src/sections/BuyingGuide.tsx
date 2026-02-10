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

interface PersonaConfig {
  categories: Laptop['category'][];
  budgetLimit: number;
  weights: {
    budget: number;
    value: number;
    portability: number;
    performance: number;
  };
}

interface ScoredPick {
  laptop: Laptop;
  finalScore: number;
  budgetScore: number;
  valueScore: number;
  portabilityScore: number;
  performanceScore: number;
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

const personaConfig: Record<string, PersonaConfig> = {
  gaming: {
    categories: ['gaming'],
    budgetLimit: 2200000,
    weights: { budget: 0.2, value: 0.25, portability: 0.1, performance: 0.45 },
  },
  office: {
    categories: ['business', 'budget', 'ultrabook'],
    budgetLimit: 1300000,
    weights: { budget: 0.4, value: 0.3, portability: 0.2, performance: 0.1 },
  },
  creator: {
    categories: ['creator', 'apple', 'gaming'],
    budgetLimit: 3000000,
    weights: { budget: 0.2, value: 0.2, portability: 0.1, performance: 0.5 },
  },
  portable: {
    categories: ['ultrabook', 'apple', 'business'],
    budgetLimit: 2200000,
    weights: { budget: 0.15, value: 0.2, portability: 0.5, performance: 0.15 },
  },
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function parseBatteryHours(battery: string): number {
  const hourMatch = battery.match(/(\d+)\s*시간/);
  if (hourMatch) return parseInt(hourMatch[1], 10);
  const whMatch = battery.match(/(\d+)\s*Wh/i);
  if (whMatch) {
    // Wh 기반 대략 추정치
    return Math.round(parseInt(whMatch[1], 10) / 5);
  }
  return 10;
}

function scorePerformance(laptop: Laptop): number {
  const cpu = laptop.specs.cpu.toLowerCase();
  const gpu = laptop.specs.gpu.toLowerCase();
  const ramScore = clamp((laptop.specs.ram / 32) * 100, 20, 100);

  const cpuScore =
    cpu.includes('ultra 9') || cpu.includes('i9') || cpu.includes('m4 max') ? 100
      : cpu.includes('ultra 7') || cpu.includes('i7') || cpu.includes('m4 pro') ? 85
        : cpu.includes('ultra 5') || cpu.includes('i5') || cpu.includes('m4') || cpu.includes('ryzen 7') ? 72
          : cpu.includes('ryzen 5') ? 62
            : 50;

  const gpuScore =
    gpu.includes('rtx 4090') || gpu.includes('rtx 4080') ? 100
      : gpu.includes('rtx 4070') ? 90
        : gpu.includes('rtx 4060') ? 80
          : gpu.includes('rtx') || gpu.includes('m4 max') ? 70
            : gpu.includes('arc') || gpu.includes('iris') ? 52
              : 45;

  return Math.round(cpuScore * 0.4 + gpuScore * 0.35 + ramScore * 0.25);
}

function scorePortability(laptop: Laptop): number {
  const weightScore = clamp((2.6 - laptop.specs.weight) / 1.8 * 100, 0, 100);
  const batteryHours = parseBatteryHours(laptop.specs.battery);
  const batteryScore = clamp((batteryHours - 6) / 14 * 100, 0, 100);
  return Math.round(weightScore * 0.7 + batteryScore * 0.3);
}

function scoreBudget(price: number, budgetLimit: number): number {
  if (price <= budgetLimit) {
    return clamp(100 - (price / budgetLimit) * 25, 75, 100);
  }
  // 예산 초과 시 강한 패널티
  const overRatio = (price - budgetLimit) / budgetLimit;
  return clamp(45 - overRatio * 140, 0, 45);
}

function scoreValue(laptop: Laptop): number {
  const discountScore = clamp(laptop.discount.percent * 3.5, 0, 100);
  const priceIndexScore = clamp(laptop.priceIndex, 0, 100);
  return Math.round(discountScore * 0.35 + priceIndexScore * 0.65);
}

function getBestPickForPersona(laptops: Laptop[], personaId: string): ScoredPick | null {
  const config = personaConfig[personaId];
  if (!config) return null;

  const candidates = laptops.filter((l) => config.categories.includes(l.category));
  if (candidates.length === 0) return null;

  const scored = candidates.map((laptop) => {
    const budgetScore = scoreBudget(laptop.prices.current, config.budgetLimit);
    const valueScore = scoreValue(laptop);
    const portabilityScore = scorePortability(laptop);
    const performanceScore = scorePerformance(laptop);

    // 예산을 크게 초과한 제품은 추가 패널티
    const hardBudgetPenalty = laptop.prices.current > config.budgetLimit * 1.5 ? 20 : 0;

    const finalScore = Math.round(
      budgetScore * config.weights.budget +
      valueScore * config.weights.value +
      portabilityScore * config.weights.portability +
      performanceScore * config.weights.performance -
      hardBudgetPenalty
    );

    return {
      laptop,
      finalScore,
      budgetScore,
      valueScore,
      portabilityScore,
      performanceScore,
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored[0];
}

export default function BuyingGuide({ laptops, onCategorySelect }: BuyingGuideProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  // 각 페르소나별 추천 제품 자동 선정 (예산 패널티 포함)
  const picks = useMemo(() => {
    return guideCategories.map((guide) => {
      const pick = getBestPickForPersona(laptops, guide.id);
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
                    추천 점수 {pick.finalScore}점
                  </p>
                  <p className="font-bold text-slate-900 text-sm mb-1">{pick.laptop.brand} {pick.laptop.name}</p>
                  <p className="text-lg font-bold text-slate-900">
                    {pick.laptop.prices.current.toLocaleString()}원
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    가성비 {pick.valueScore} · 휴대성 {pick.portabilityScore} · 예산적합 {pick.budgetScore}
                  </p>
                  {pick.laptop.prices.current > (personaConfig[guide.id]?.budgetLimit || 999999999) && (
                    <p className="text-[11px] text-rose-600 mt-1">
                      예산 초과 제품 (대안도 함께 확인 권장)
                    </p>
                  )}
                  {pick.laptop.editorComment && (
                    <p className="text-xs text-slate-500 mt-2 italic line-clamp-2">
                      &ldquo;{pick.laptop.editorComment}&rdquo;
                    </p>
                  )}
                  {pick.laptop.bestFor && (
                    <p className="text-[11px] text-slate-600 mt-1">{pick.laptop.bestFor}</p>
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
