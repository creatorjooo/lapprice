import { useState, useCallback, useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import Navbar from './sections/Navbar';
import Newsletter from './sections/Newsletter';
import Footer from './sections/Footer';
import CompareModal from './components/CompareModal';
import PriceAlertModal from './components/PriceAlertModal';
import PriceAlertManager from './components/PriceAlertManager';
import RecentlyViewed from './components/RecentlyViewed';
import MobileCTABar from './components/MobileCTABar';
import AdminPanel from './pages/AdminPanel';
import HomePage from './pages/HomePage';
import LaptopPage from './pages/LaptopPage';
import MonitorPage from './pages/MonitorPage';
import DesktopPage from './pages/DesktopPage';
import { findProductById, allProducts } from './data/index';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { Laptop, PriceAlert, Product } from './types';
import './App.css';

type PageType = 'home' | 'laptop' | 'monitor' | 'desktop' | 'admin';

interface ExternalSearchCandidate {
  source: string;
  title: string;
  price: number;
  originalPrice?: number;
  link: string;
  image?: string;
  mallName?: string;
  query?: string;
  productType?: 'laptop' | 'monitor' | 'desktop';
}

interface TrackedProductItem {
  id: string;
  source: string;
  productType: 'laptop' | 'monitor' | 'desktop';
  query: string;
  title: string;
  link: string;
  image?: string;
  mallName?: string;
  lastPrice: number;
  lastOriginalPrice?: number;
}

function trackedToProduct(item: TrackedProductItem): Product {
  const common = {
    id: item.id,
    brand: (item.title || '').split(' ')[0] || '외부상품',
    name: item.title,
    model: item.title,
    prices: {
      original: item.lastOriginalPrice || item.lastPrice || 0,
      current: item.lastPrice || 0,
      lowest: item.lastPrice || 0,
      average: item.lastPrice || 0,
    },
    discount: {
      percent: item.lastOriginalPrice && item.lastOriginalPrice > item.lastPrice
        ? Math.round(((item.lastOriginalPrice - item.lastPrice) / item.lastOriginalPrice) * 100)
        : 0,
      amount: item.lastOriginalPrice && item.lastOriginalPrice > item.lastPrice
        ? (item.lastOriginalPrice - item.lastPrice)
        : 0,
    },
    priceIndex: 70,
    stores: [{
      store: item.mallName || item.source,
      storeLogo: '🛒',
      price: item.lastPrice || 0,
      shipping: 0,
      deliveryDays: '확인 필요',
      updatedAt: '실시간',
      url: item.link,
      isLowest: true,
    }],
    rating: { score: 0, count: 0 },
    reviews: [],
    stock: 'in' as const,
    isNew: false,
    isHot: false,
    releaseDate: new Date().toISOString().slice(0, 7),
    images: item.image ? [item.image] : [],
    tags: ['외부검색', '추적상품'],
    editorScore: undefined,
    editorPick: '외부 추적',
    editorComment: '외부 검색에서 추가된 추적 상품입니다.',
    pros: [],
    cons: [],
    bestFor: '외부 가격 추적',
  };

  if (item.productType === 'monitor') {
    return {
      productType: 'monitor',
      category: 'general',
      specs: {
        panelType: 'IPS',
        resolution: '1920x1080',
        resolutionLabel: 'FHD',
        refreshRate: 60,
        responseTime: '-',
        screenSize: 27,
        aspectRatio: '16:9',
        hdr: '없음',
        colorGamut: '-',
        ports: [],
        speakers: false,
        heightAdjust: false,
        pivot: false,
        vesa: false,
        curved: false,
      },
      ...common,
    };
  }

  if (item.productType === 'desktop') {
    return {
      productType: 'desktop',
      category: 'office',
      specs: {
        cpu: '-',
        cpuType: 'intel',
        gpu: '-',
        ram: 16,
        ramType: '-',
        storage: 512,
        storageType: '-',
        formFactor: '미들타워',
        psu: '-',
        os: '-',
        expansion: [],
      },
      ...common,
    };
  }

  return {
    productType: 'laptop',
    category: 'budget',
    specs: {
      cpu: '-',
      cpuType: 'intel',
      gpu: '-',
      ram: 16,
      ramType: '-',
      storage: 512,
      storageType: '-',
      display: '-',
      displaySize: 15.6,
      weight: 1.8,
      battery: '-',
    },
    ...common,
  };
}

function parseCompareKey(key: string): { kind: 'tracked' | 'catalog' | 'legacy'; productType?: string; id: string } {
  if (key.startsWith('tracked:')) {
    return { kind: 'tracked', id: key.replace('tracked:', '') };
  }
  if (key.includes(':')) {
    const [productType, id] = key.split(':');
    return { kind: 'catalog', productType, id };
  }
  return { kind: 'legacy', id: key };
}

function App() {
  // ─── 해시 라우팅 (카테고리 서브페이지 지원) ───
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);

  useEffect(() => {
    const detectPage = () => {
      const hash = window.location.hash.replace('#', '') || 'home';
      const validPages: PageType[] = ['home', 'laptop', 'monitor', 'desktop', 'admin'];

      // 서브페이지 지원: laptop-gaming, monitor-pro 등
      const parts = hash.split('-');
      const basePage = parts[0] as PageType;
      const category = parts.length > 1 ? parts.slice(1).join('-') : null;

      if (validPages.includes(basePage)) {
        setCurrentPage(basePage);
        setCurrentCategory(category);
      } else {
        setCurrentPage('home');
        setCurrentCategory(null);
      }
    };
    detectPage();
    window.addEventListener('hashchange', detectPage);
    return () => window.removeEventListener('hashchange', detectPage);
  }, []);

  const navigateToPage = useCallback((page: string) => {
    window.location.hash = page === 'home' ? '' : `#${page}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ─── 검색 ───
  const [searchQuery, setSearchQuery] = useState('');

  // ─── 최근 본 상품 (localStorage) ───
  const [recentlyViewed, setRecentlyViewed] = useLocalStorage<{ id: string; name: string; price: number; productType: string; image?: string; viewedAt: string }[]>('lapprice-recent', []);

  const addToRecentlyViewed = useCallback((productId: string) => {
    const product = findProductById(productId);
    if (!product) return;
    setRecentlyViewed((prev) => {
      const filtered = prev.filter(r => r.id !== productId);
      const entry = {
        id: product.id,
        name: product.name,
        price: product.prices.current,
        productType: product.productType,
        image: product.images?.[0],
        viewedAt: new Date().toISOString(),
      };
      return [entry, ...filtered].slice(0, 10);
    });
  }, [setRecentlyViewed]);

  // ─── Wishlist (localStorage) ───
  const [wishlist, setWishlist] = useLocalStorage<string[]>('lapprice-wishlist', []);

  // ─── Compare (localStorage) ───
  const [compareList, setCompareList] = useLocalStorage<string[]>('lapprice-compare', []);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // ─── Price Alert (localStorage) ───
  const [priceAlerts, setPriceAlerts] = useLocalStorage<PriceAlert[]>('lapprice-alerts', []);
  const [priceAlertLaptop, setPriceAlertLaptop] = useState<Laptop | null>(null);
  const [isPriceAlertModalOpen, setIsPriceAlertModalOpen] = useState(false);
  const [isAlertManagerOpen, setIsAlertManagerOpen] = useState(false);
  const [trackedProducts, setTrackedProducts] = useState<TrackedProductItem[]>([]);

  // 목표가 도달 알림 확인
  useEffect(() => {
    const activeAlerts = priceAlerts.filter((a) => a.isActive);
    activeAlerts.forEach((alert) => {
      const product = findProductById(alert.laptopId);
      if (product && product.prices.current <= alert.targetPrice) {
        toast.success(
          `🎉 ${product.name}이(가) 목표 가격 ${alert.targetPrice.toLocaleString()}원에 도달했습니다! 현재가: ${product.prices.current.toLocaleString()}원`,
          { duration: 8000 }
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handlers ───
  const fetchTrackedProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/tracked-products');
      if (!response.ok) return;
      const data = await response.json();
      setTrackedProducts(Array.isArray(data.items) ? data.items : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTrackedProducts();
  }, [fetchTrackedProducts]);

  const handleToggleWishlist = useCallback((id: string) => {
    setWishlist((prev) => {
      const isAdding = !prev.includes(id);
      const product = findProductById(id);
      if (isAdding) {
        toast.success(`${product?.name}을(를) 찜했습니다!`);
        return [...prev, id];
      } else {
        toast.info(`${product?.name} 찜이 해제되었습니다.`);
        return prev.filter((item) => item !== id);
      }
    });
  }, []);

  const handleToggleCompare = useCallback((id: string) => {
    const parsed = parseCompareKey(id);
    const productName =
      parsed.kind === 'tracked'
        ? (trackedProducts.find((p) => p.id === parsed.id)?.title || '외부 상품')
        : parsed.kind === 'catalog'
          ? (allProducts.find((p) => p.productType === parsed.productType && p.id === parsed.id)?.name || '상품')
          : (findProductById(parsed.id)?.name || '상품');

    setCompareList((prev) => {
      const isAdding = !prev.includes(id);
      if (isAdding) {
        if (prev.length >= 4) {
          toast.error('최대 4개까지 비교할 수 있습니다.');
          return prev;
        }
        toast.success(`${productName}을(를) 비교 목록에 추가했습니다!`);
        return [...prev, id];
      } else {
        toast.info(`${productName} 비교 목록에서 제거되었습니다.`);
        return prev.filter((item) => item !== id);
      }
    });
  }, [trackedProducts]);

  const handleClearCompare = useCallback(() => {
    setCompareList([]);
    toast.info('비교 목록이 초기화되었습니다.');
  }, []);

  const handleSetPriceAlert = useCallback((id: string) => {
    const product = findProductById(id);
    if (product && product.productType === 'laptop') {
      setPriceAlertLaptop(product);
      setIsPriceAlertModalOpen(true);
    } else if (product) {
      // 모니터/데스크탑도 가격 알림 가능 (Laptop 타입 캐스팅 — PriceAlertModal이 name, prices만 사용)
      setPriceAlertLaptop(product as unknown as Laptop);
      setIsPriceAlertModalOpen(true);
    }
  }, []);

  const handleSavePriceAlert = useCallback((laptopId: string, targetPrice: number, email: string) => {
    const newAlert: PriceAlert = {
      id: crypto.randomUUID(),
      laptopId,
      targetPrice,
      email,
      createdAt: new Date().toISOString(),
      isActive: true,
    };
    setPriceAlerts((prev) => [...prev, newAlert]);
    toast.success('가격 알림이 설정되었습니다!');
    setIsPriceAlertModalOpen(false);
  }, [setPriceAlerts]);

  const handleToggleAlert = useCallback((alertId: string) => {
    setPriceAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, isActive: !a.isActive } : a)));
  }, [setPriceAlerts]);

  const handleDeleteAlert = useCallback((alertId: string) => {
    setPriceAlerts((prev) => prev.filter((a) => a.id !== alertId));
    toast.info('알림이 삭제되었습니다.');
  }, [setPriceAlerts]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query.trim());
    // 홈이면 노트북 페이지로 이동, 이미 제품 페이지면 그대로 유지
    if (query.trim() && !['laptop', 'monitor', 'desktop'].includes(currentPage)) {
      navigateToPage('laptop');
    }
  }, [currentPage, navigateToPage]);

  // ─── Compare 대상 (전 카테고리 통합) ───
  const trackedAsProducts = trackedProducts.map(trackedToProduct);
  const compareProducts = compareList
    .map((key) => {
      const parsed = parseCompareKey(key);
      if (parsed.kind === 'tracked') {
        const tracked = trackedAsProducts.find((p) => p.id === parsed.id);
        return tracked ? { ...tracked, id: key } : null;
      }
      if (parsed.kind === 'catalog') {
        const product = allProducts.find((p) => p.productType === parsed.productType && p.id === parsed.id);
        return product ? { ...product, id: key } : null;
      }
      const legacy = allProducts.find((p) => p.id === parsed.id);
      return legacy ? { ...legacy, id: key } : null;
    })
    .filter(Boolean) as Product[];

  const registerTrackedProduct = useCallback(async (candidate: ExternalSearchCandidate) => {
    const response = await fetch('/api/tracked-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: candidate.source,
        title: candidate.title,
        link: candidate.link,
        query: candidate.query || candidate.title,
        image: candidate.image,
        mallName: candidate.mallName,
        price: candidate.price,
        originalPrice: candidate.originalPrice || candidate.price,
        productType: candidate.productType || 'laptop',
      }),
    });

    if (!response.ok) {
      throw new Error('추적 등록 실패');
    }
    const data = await response.json();
    await fetchTrackedProducts();
    return data.item as TrackedProductItem;
  }, [fetchTrackedProducts]);

  const handleTrackExternalProduct = useCallback(async (candidate: ExternalSearchCandidate) => {
    try {
      await registerTrackedProduct(candidate);
      toast.success('외부 상품 추적이 추가되었습니다.');
    } catch {
      toast.error('추적 추가에 실패했습니다.');
    }
  }, [registerTrackedProduct]);

  const handleAddExternalToCompare = useCallback(async (candidate: ExternalSearchCandidate) => {
    try {
      const tracked = await registerTrackedProduct(candidate);
      setCompareList((prev) => {
        const compareKey = `tracked:${tracked.id}`;
        if (prev.includes(compareKey)) return prev;
        if (prev.length >= 4) {
          toast.error('최대 4개까지 비교할 수 있습니다.');
          return prev;
        }
        return [...prev, compareKey];
      });
      toast.success('외부 상품을 비교 목록에 추가했습니다.');
    } catch {
      toast.error('외부 상품 비교 추가에 실패했습니다.');
    }
  }, [registerTrackedProduct, setCompareList]);

  // ─── 관리자 모드 ───
  if (currentPage === 'admin') {
    return <AdminPanel />;
  }

  // ─── 공통 페이지 props ───
  const pageProps = {
    wishlist,
    compareList,
    searchQuery,
    onToggleWishlist: handleToggleWishlist,
    onToggleCompare: handleToggleCompare,
    onSetPriceAlert: (id: string) => { addToRecentlyViewed(id); handleSetPriceAlert(id); },
    onOpenCompare: () => setIsCompareModalOpen(true),
    onSearch: handleSearch,
  };

  return (
    <div className="min-h-screen bg-white">
      <Toaster position="top-right" richColors />

      <Navbar
        currentPage={currentPage}
        wishlistCount={wishlist.length}
        compareCount={compareList.length}
        alertCount={priceAlerts.filter((a) => a.isActive).length}
        onSearch={handleSearch}
        onNavigateToPage={navigateToPage}
        onOpenAlertManager={() => setIsAlertManagerOpen(true)}
        onOpenCompare={() => setIsCompareModalOpen(true)}
        onTrackExternalProduct={handleTrackExternalProduct}
        onAddExternalToCompare={handleAddExternalToCompare}
      />

      <main>
        {currentPage !== 'home' && recentlyViewed.length > 0 && (
          <RecentlyViewed items={recentlyViewed} onNavigateToPage={navigateToPage} />
        )}
        {currentPage === 'home' && <HomePage onNavigateToPage={navigateToPage} />}
        {currentPage === 'laptop' && <LaptopPage {...pageProps} category={currentCategory} onNavigateToPage={navigateToPage} />}
        {currentPage === 'monitor' && <MonitorPage {...pageProps} category={currentCategory} onNavigateToPage={navigateToPage} />}
        {currentPage === 'desktop' && <DesktopPage {...pageProps} category={currentCategory} onNavigateToPage={navigateToPage} />}
      </main>

      <Newsletter />
      <Footer onNavigateToPage={navigateToPage} />

      {/* Compare Modal */}
      <CompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        products={compareProducts}
        onRemove={handleToggleCompare}
        onClear={handleClearCompare}
      />

      {/* Price Alert Modal */}
      <PriceAlertModal
        isOpen={isPriceAlertModalOpen}
        onClose={() => setIsPriceAlertModalOpen(false)}
        laptop={priceAlertLaptop}
        onSetAlert={handleSavePriceAlert}
      />

      {/* Price Alert Manager */}
      <PriceAlertManager
        isOpen={isAlertManagerOpen}
        onClose={() => setIsAlertManagerOpen(false)}
        alerts={priceAlerts}
        products={allProducts}
        onToggleAlert={handleToggleAlert}
        onDeleteAlert={handleDeleteAlert}
      />

      {/* Mobile Fixed CTA Bar */}
      <MobileCTABar currentPage={currentPage} onNavigateToPage={navigateToPage} />

      {/* Compare Floating Button */}
      {compareList.length > 0 && (
        <button
          onClick={() => setIsCompareModalOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          <span className="font-semibold">비교하기</span>
          <span className="w-6 h-6 bg-emerald-500 text-white rounded-full text-sm flex items-center justify-center">
            {compareList.length}
          </span>
        </button>
      )}
    </div>
  );
}

export default App;
