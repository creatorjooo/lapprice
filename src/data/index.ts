import type { Product, Laptop, Monitor, Desktop } from '@/types';
import { laptops, priceHistoryData as laptopPriceHistory } from './laptops';
import { monitors, monitorPriceHistory } from './monitors';
import { desktops, desktopPriceHistory } from './desktops';

// 전체 제품 목록 (모든 카테고리 통합)
export const allProducts: Product[] = [
  ...laptops,
  ...monitors,
  ...desktops,
];

// 제품 타입별 가져오기
export function getProductsByType(type: 'laptop'): Laptop[];
export function getProductsByType(type: 'monitor'): Monitor[];
export function getProductsByType(type: 'desktop'): Desktop[];
export function getProductsByType(type: string): Product[] {
  return allProducts.filter((p) => p.productType === type);
}

// 통합 가격 히스토리 조회
export function getPriceHistory(productId: string) {
  return (
    laptopPriceHistory[productId] ||
    monitorPriceHistory[productId] ||
    desktopPriceHistory[productId] ||
    []
  );
}

// 전체 핫딜 (전 카테고리 통합, 할인율+가격지수 기반)
export function getHotDeals(limit = 6): Product[] {
  return [...allProducts]
    .filter((p) => p.discount.percent > 0 && p.stock !== 'out')
    .sort((a, b) => {
      // 할인율 + 가격지수 복합 점수
      const scoreA = a.discount.percent * 0.6 + a.priceIndex * 0.4;
      const scoreB = b.discount.percent * 0.6 + b.priceIndex * 0.4;
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

// 전체 인기 제품 (에디터 점수 기반)
export function getTopPicks(type?: string, limit = 4): Product[] {
  let pool = type ? allProducts.filter((p) => p.productType === type) : allProducts;
  return [...pool]
    .filter((p) => p.editorScore && p.editorScore > 0)
    .sort((a, b) => (b.editorScore || 0) - (a.editorScore || 0))
    .slice(0, limit);
}

// 제품 ID로 찾기 (타입 무관)
export function findProductById(id: string): Product | undefined {
  return allProducts.find((p) => p.id === id);
}

// Re-export
export { laptops, monitors, desktops };
export { laptopPriceHistory, monitorPriceHistory, desktopPriceHistory };
