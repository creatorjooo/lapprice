import { useState, useEffect } from 'react';
import { Zap, TrendingDown } from 'lucide-react';

interface MobileCTABarProps {
  currentPage: string;
  onNavigateToPage: (page: string) => void;
}

export default function MobileCTABar({ currentPage, onNavigateToPage: _onNavigateToPage }: MobileCTABarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // 300px 이상 스크롤 시 표시
      setIsVisible(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 홈 또는 관리자 페이지에서는 표시하지 않음
  if (currentPage === 'home' || currentPage === 'admin') return null;

  const labels: Record<string, string> = {
    laptop: '노트북',
    monitor: '모니터',
    desktop: '데스크탑',
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-30 md:hidden transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 safe-area-inset-bottom">
        <button
          onClick={() => {
            // 핫딜 섹션으로 스크롤
            const hotDealSection = document.getElementById('hot-deals');
            if (hotDealSection) {
              hotDealSection.scrollIntoView({ behavior: 'smooth' });
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className="flex items-center justify-center gap-2 w-full text-white"
        >
          <Zap className="w-4 h-4" />
          <span className="font-semibold text-sm">
            오늘의 {labels[currentPage] || ''} 최저가 보기
          </span>
          <TrendingDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
