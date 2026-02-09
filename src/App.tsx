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
import { laptops } from './data/laptops';
import { findProductById, allProducts } from './data/index';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { Laptop, PriceAlert } from './types';
import './App.css';

type PageType = 'home' | 'laptop' | 'monitor' | 'desktop' | 'admin';

function App() {
  // ─── 해시 라우팅 ───
  const [currentPage, setCurrentPage] = useState<PageType>('home');

  useEffect(() => {
    const detectPage = () => {
      const hash = window.location.hash.replace('#', '') || 'home';
      const validPages: PageType[] = ['home', 'laptop', 'monitor', 'desktop', 'admin'];
      setCurrentPage(validPages.includes(hash as PageType) ? (hash as PageType) : 'home');
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
    setCompareList((prev) => {
      const isAdding = !prev.includes(id);
      const product = findProductById(id);
      if (isAdding) {
        if (prev.length >= 4) {
          toast.error('최대 4개까지 비교할 수 있습니다.');
          return prev;
        }
        toast.success(`${product?.name}을(를) 비교 목록에 추가했습니다!`);
        return [...prev, id];
      } else {
        toast.info(`${product?.name} 비교 목록에서 제거되었습니다.`);
        return prev.filter((item) => item !== id);
      }
    });
  }, []);

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
    // 현재 페이지가 home이면 laptop으로 이동
    if (query.trim() && currentPage === 'home') {
      navigateToPage('laptop');
    }
  }, [currentPage, navigateToPage]);

  // ─── Compare 대상 (전 카테고리 통합) ───
  const compareLaptops = allProducts.filter((p) => compareList.includes(p.id)) as Laptop[];

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
      />

      <main>
        {currentPage !== 'home' && recentlyViewed.length > 0 && (
          <RecentlyViewed items={recentlyViewed} onNavigateToPage={navigateToPage} />
        )}
        {currentPage === 'home' && <HomePage onNavigateToPage={navigateToPage} />}
        {currentPage === 'laptop' && <LaptopPage {...pageProps} />}
        {currentPage === 'monitor' && <MonitorPage {...pageProps} />}
        {currentPage === 'desktop' && <DesktopPage {...pageProps} />}
      </main>

      <Newsletter />
      <Footer onNavigateToPage={navigateToPage} />

      {/* Compare Modal */}
      <CompareModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        laptops={compareLaptops}
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
        laptops={laptops}
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
