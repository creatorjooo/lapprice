import { useState, useEffect } from 'react';
import { Search, ShoppingBag, Menu, X, Laptop, Bell, Loader2, ExternalLink, Zap, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useShoppingSearch, PLATFORM_NAMES } from '@/hooks/useShoppingSearch';
import { trackAffiliateClick } from '@/utils/tracking';
import { cn } from '@/lib/utils';

interface NavbarProps {
  currentPage: string;
  wishlistCount: number;
  compareCount: number;
  alertCount?: number;
  onSearch: (query: string) => void;
  onNavigateToPage: (page: string) => void;
  onOpenAlertManager?: () => void;
  onOpenCompare?: () => void;
}

const productTypes = [
  {
    name: '노트북',
    hash: 'laptop',
    icon: '💻',
    subLinks: [
      { name: 'Apple', section: 'apple' },
      { name: '게이밍', section: 'gaming' },
      { name: '울트라북', section: 'ultrabook' },
      { name: '비즈니스', section: 'business' },
      { name: '가성비', section: 'budget' },
    ],
  },
  {
    name: '모니터',
    hash: 'monitor',
    icon: '🖥️',
    subLinks: [
      { name: '게이밍', section: 'mon-gaming' },
      { name: '전문가용', section: 'mon-pro' },
      { name: '울트라와이드', section: 'mon-ultrawide' },
      { name: '가성비', section: 'mon-general' },
    ],
  },
  {
    name: '데스크탑',
    hash: 'desktop',
    icon: '🖥️',
    subLinks: [
      { name: '게이밍PC', section: 'desk-gaming' },
      { name: 'Mac', section: 'desk-mac' },
      { name: '미니PC', section: 'desk-mini' },
      { name: '사무용', section: 'desk-office' },
    ],
  },
];

export default function Navbar({
  currentPage,
  wishlistCount,
  compareCount,
  alertCount = 0,
  onSearch,
  onNavigateToPage,
  onOpenAlertManager,
  onOpenCompare,
}: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredType, setHoveredType] = useState<string | null>(null);
  const { localResults, externalResults, isLoading, platformStatus, search: doSearch, clearResults } = useShoppingSearch();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
    setIsSearchOpen(false);
    clearResults();
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    doSearch(value);
  };

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          isScrolled
            ? 'bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/50'
            : 'bg-slate-900/90 backdrop-blur-sm'
        )}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-12">
            {/* Logo */}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); onNavigateToPage('home'); }}
              className="flex items-center gap-2 group"
            >
              <Laptop className={cn('w-5 h-5 transition-colors', isScrolled ? 'text-slate-900' : 'text-white')} />
              <span className={cn('text-sm font-semibold tracking-tight transition-colors', isScrolled ? 'text-slate-900' : 'text-white')}>
                LapPrice
              </span>
            </a>

            {/* Desktop Navigation - Mega Menu */}
            <nav className="hidden lg:flex items-center gap-1">
              {productTypes.map((type) => (
                <div
                  key={type.hash}
                  className="relative"
                  onMouseEnter={() => setHoveredType(type.hash)}
                  onMouseLeave={() => setHoveredType(null)}
                >
                  <button
                    onClick={() => onNavigateToPage(type.hash)}
                    className={cn(
                      'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                      currentPage === type.hash
                        ? isScrolled
                          ? 'bg-slate-900 text-white'
                          : 'bg-white/20 text-white'
                        : isScrolled
                          ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-white/90 hover:bg-white/10'
                    )}
                  >
                    <span>{type.icon}</span>
                    <span>{type.name}</span>
                    <ChevronDown className={cn('w-3 h-3 transition-transform', hoveredType === type.hash && 'rotate-180')} />
                  </button>

                  {/* Dropdown */}
                  {hoveredType === type.hash && (
                    <div className="absolute top-full left-0 pt-1 w-40 z-50">
                      <div className="bg-white rounded-xl shadow-lg border border-slate-200 py-2">
                        <button
                          onClick={() => { onNavigateToPage(type.hash); setHoveredType(null); }}
                          className="w-full text-left px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          전체 보기
                        </button>
                        {type.subLinks.map((sub) => (
                          <button
                            key={sub.section}
                            onClick={() => {
                              onNavigateToPage(`${type.hash}-${sub.section}`);
                              setHoveredType(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                          >
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={cn('transition-colors hover:opacity-70', isScrolled ? 'text-slate-700' : 'text-white/90')}
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                onClick={() => onOpenAlertManager?.()}
                className={cn('relative transition-colors hover:opacity-70', isScrolled ? 'text-slate-700' : 'text-white/90')}
              >
                <Bell className="w-4 h-4" />
                {alertCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                    {alertCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => onOpenCompare?.()}
                className={cn('relative transition-colors hover:opacity-70', isScrolled ? 'text-slate-700' : 'text-white/90')}
              >
                <ShoppingBag className="w-4 h-4" />
                {(wishlistCount + compareCount) > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                    {wishlistCount + compareCount}
                  </span>
                )}
              </button>

              {/* Mobile Menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <button className={cn('transition-colors', isScrolled ? 'text-slate-700' : 'text-white/90')}>
                    <Menu className="w-5 h-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-80 bg-slate-900 border-slate-800">
                  <div className="flex flex-col h-full pt-12">
                    <nav className="flex flex-col gap-2">
                      <button
                        onClick={() => { onNavigateToPage('home'); setIsMobileMenuOpen(false); }}
                        className="text-xl font-semibold text-white/90 hover:text-white transition-colors text-left py-2"
                      >
                        🏠 홈
                      </button>
                      {productTypes.map((type) => (
                        <div key={type.hash}>
                          <button
                            onClick={() => { onNavigateToPage(type.hash); setIsMobileMenuOpen(false); }}
                            className={cn(
                              'text-xl font-semibold transition-colors text-left py-2 w-full',
                              currentPage === type.hash ? 'text-emerald-400' : 'text-white/90 hover:text-white'
                            )}
                          >
                            {type.icon} {type.name}
                          </button>
                          <div className="flex flex-wrap gap-2 ml-8 mb-3">
                            {type.subLinks.map((sub) => (
                              <button
                                key={sub.section}
                                onClick={() => { onNavigateToPage(`${type.hash}-${sub.section}`); setIsMobileMenuOpen(false); }}
                                className="text-sm text-white/60 hover:text-white/90 transition-colors"
                              >
                                {sub.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[60] bg-white dark:bg-slate-950 overflow-y-auto">
          <div className="max-w-[780px] mx-auto px-4 pt-20 pb-12">
            <div className="flex items-center justify-between mb-8">
              <span className="text-sm text-slate-500">검색</span>
              <button
                onClick={() => { setIsSearchOpen(false); clearResults(); }}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="노트북, 모니터, 데스크탑 검색..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="w-full h-14 text-2xl border-0 border-b-2 border-slate-200 rounded-none focus:ring-0 focus:border-slate-900 bg-transparent pr-10"
                  autoFocus
                />
                {isLoading && <Loader2 className="absolute right-2 top-4 w-5 h-5 animate-spin text-slate-400" />}
              </div>
            </form>

            <div className="mt-6">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">빠른 검색</p>
              <div className="flex flex-wrap gap-2">
                {['게이밍 노트북', '4K 모니터', '미니PC', '울트라북', 'RTX 4060', 'OLED 모니터', '맥북', 'Mac mini'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => { handleSearchInput(tag); setSearchQuery(tag); }}
                    className="px-3 py-1.5 bg-slate-100 rounded-full text-sm hover:bg-slate-200 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {localResults.length > 0 && (
              <div className="mt-8">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">💻 우리 사이트 결과 ({localResults.length}개)</p>
                <div className="space-y-2">
                  {localResults.slice(0, 5).map((laptop) => (
                    <button
                      key={laptop.id}
                      onClick={() => { onSearch(searchQuery); setIsSearchOpen(false); clearResults(); }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">💻</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{laptop.brand} {laptop.name}</p>
                        <p className="text-xs text-slate-500">{laptop.specs.cpu} · {laptop.specs.ram}GB · {laptop.specs.storage}GB</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-emerald-600">{laptop.prices.current.toLocaleString()}원</p>
                        {laptop.discount.percent > 0 && <p className="text-[10px] text-rose-500">-{laptop.discount.percent}%</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {externalResults.length > 0 && (
              <div className="mt-8">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">🛒 외부 쇼핑몰 결과</p>
                <div className="space-y-4">
                  {(() => {
                    const priorityOrder = ['coupang', 'naver'];
                    const sorted = [...externalResults].sort((a, b) => {
                      const aIdx = priorityOrder.indexOf(a.source);
                      const bIdx = priorityOrder.indexOf(b.source);
                      if (aIdx !== -1 && bIdx === -1) return -1;
                      if (aIdx === -1 && bIdx !== -1) return 1;
                      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                      return 0;
                    });
                    return sorted;
                  })().map((result) => {
                    const status = platformStatus[result.source];
                    const name = PLATFORM_NAMES[result.source] || result.source;
                    const isAffiliatePlatform = ['coupang', 'naver'].includes(result.source);

                    return (
                      <div key={result.source} className={cn('border rounded-lg overflow-hidden', isAffiliatePlatform ? 'border-blue-200' : 'border-slate-100')}>
                        <div className={cn('flex items-center justify-between px-3 py-2', isAffiliatePlatform ? 'bg-blue-50' : 'bg-slate-50')}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">{name}</span>
                            {isAffiliatePlatform && (
                              <Badge className="bg-blue-500/10 text-blue-600 text-[8px] px-1 py-0 h-3.5">
                                <Zap className="w-2.5 h-2.5 mr-0.5" />제휴
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px]">
                            {status === 'loading' && <span className="text-amber-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> 검색 중...</span>}
                            {status === 'success' && <span className="text-emerald-500">{result.products.length}개 결과</span>}
                            {status === 'error' && <span className="text-rose-500">오류 발생</span>}
                            {status === 'unavailable' && <span className="text-slate-400">API 키 필요</span>}
                          </span>
                        </div>

                        {result.products.length > 0 && (
                          <div className="divide-y divide-slate-50">
                            {result.products.slice(0, 3).map((product, idx) => (
                              <a
                                key={idx}
                                href={product.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                  trackAffiliateClick({
                                    productId: '',
                                    platform: result.source,
                                    source: 'navbar_search',
                                    url: product.link,
                                    productName: product.title,
                                  });
                                }}
                                className={cn('flex items-center gap-3 p-3 transition-colors', isAffiliatePlatform ? 'hover:bg-blue-50' : 'hover:bg-slate-50')}
                              >
                                {product.image ? (
                                  <img src={product.image} alt={product.title} className="w-10 h-10 object-cover rounded bg-slate-100" onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).className = 'w-10 h-10 bg-slate-100 rounded'; }} />
                                ) : (
                                  <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-lg">📦</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs truncate">{product.title}</p>
                                  <p className="text-[10px] text-slate-400">{product.mallName}</p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <p className={cn('text-xs font-bold', isAffiliatePlatform && 'text-blue-600')}>{product.price.toLocaleString()}원</p>
                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
