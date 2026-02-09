import { useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ProductCard from '@/components/ProductCard';
import type { Laptop, FilterState } from '@/types';

interface ProductListProps {
  laptops: Laptop[];
  filters: FilterState;
  wishlist: string[];
  compareList: string[];
  searchQuery?: string;
  onToggleWishlist: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onSetPriceAlert: (id: string) => void;
}

export default function ProductList({
  laptops,
  filters,
  wishlist,
  compareList,
  searchQuery,
  onToggleWishlist,
  onToggleCompare,
  onSetPriceAlert,
}: ProductListProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const filteredLaptops = useMemo(() => {
    let result = [...laptops];

    // Search query filter
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.brand.toLowerCase().includes(q) ||
          l.model.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q)) ||
          l.specs.cpu.toLowerCase().includes(q) ||
          l.specs.gpu.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (filters.category.length > 0 && !filters.category.includes('all')) {
      result = result.filter((l) => filters.category.includes(l.category));
    }

    // Brand filter
    if (filters.brand.length > 0) {
      result = result.filter((l) => filters.brand.includes(l.brand));
    }

    // Price range filter
    result = result.filter(
      (l) =>
        l.prices.current >= filters.priceRange[0] &&
        l.prices.current <= filters.priceRange[1]
    );

    // CPU filter
    if (filters.cpu.length > 0) {
      result = result.filter((l) =>
        filters.cpu.some((cpu) => l.specs.cpu.includes(cpu))
      );
    }

    // RAM filter
    if (filters.ram.length > 0) {
      result = result.filter((l) =>
        filters.ram.some((ram) => l.specs.ram === parseInt(ram))
      );
    }

    // Storage filter
    if (filters.storage.length > 0) {
      result = result.filter((l) =>
        filters.storage.some((storage) => l.specs.storage === parseInt(storage))
      );
    }

    // Display size filter
    if (filters.displaySize.length > 0) {
      result = result.filter((l) => {
        const size = l.specs.displaySize;
        return filters.displaySize.some((range) => {
          if (range === '13~14인치') return size >= 13 && size < 15;
          if (range === '15~16인치') return size >= 15 && size < 17;
          if (range === '17인치 이상') return size >= 17;
          return false;
        });
      });
    }

    // Weight filter
    if (filters.weight.length > 0) {
      result = result.filter((l) => {
        const weight = l.specs.weight;
        return filters.weight.some((range) => {
          if (range === '1kg 이하') return weight <= 1;
          if (range === '1~1.5kg') return weight > 1 && weight <= 1.5;
          if (range === '1.5~2kg') return weight > 1.5 && weight <= 2;
          if (range === '2kg 이상') return weight > 2;
          return false;
        });
      });
    }

    // Discount filter
    if (filters.discount.length > 0 && !filters.discount.includes('0')) {
      const minDiscount = Math.max(...filters.discount.map((d) => parseInt(d)));
      result = result.filter((l) => l.discount.percent >= minDiscount);
    }

    // Sort
    switch (filters.sort) {
      case 'price-asc':
        result.sort((a, b) => a.prices.current - b.prices.current);
        break;
      case 'price-desc':
        result.sort((a, b) => b.prices.current - a.prices.current);
        break;
      case 'discount':
        result.sort((a, b) => b.discount.percent - a.discount.percent);
        break;
      case 'price-index':
        result.sort((a, b) => b.priceIndex - a.priceIndex);
        break;
      case 'rating':
        result.sort((a, b) => b.rating.score - a.rating.score);
        break;
      case 'newest':
        result.sort((a, b) => (a.isNew === b.isNew ? 0 : a.isNew ? -1 : 1));
        break;
    }

    return result;
  }, [laptops, filters, searchQuery]);

  return (
    <section id="deals" ref={ref} className="relative py-4 lg:py-6">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="max-w-[1920px] mx-auto">
          {filteredLaptops.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  선택한 필터에 맞는 상품이 없습니다. 필터를 조정해 보세요.
                </AlertDescription>
              </Alert>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4">
              {filteredLaptops.map((laptop, index) => (
                <motion.div
                  key={laptop.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{
                    delay: Math.min(index * 0.03, 0.3),
                    duration: 0.4,
                    ease: [0.22, 1, 0.36, 1] as const,
                  }}
                >
                  <ProductCard
                    laptop={laptop}
                    isWishlisted={wishlist.includes(laptop.id)}
                    isCompared={compareList.includes(laptop.id)}
                    onToggleWishlist={onToggleWishlist}
                    onToggleCompare={onToggleCompare}
                    onSetPriceAlert={onSetPriceAlert}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
