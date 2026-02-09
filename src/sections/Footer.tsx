import { Laptop } from 'lucide-react';
import AffiliateDisclosure, { AffiliateDisclosureText } from '@/components/AffiliateDisclosure';

interface FooterProps {
  onNavigateToPage?: (page: string) => void;
}

export default function Footer({ onNavigateToPage }: FooterProps) {
  const footerLinks = {
    laptop: {
      title: '노트북',
      links: [
        { label: '게이밍', action: () => onNavigateToPage?.('laptop') },
        { label: '울트라북', action: () => onNavigateToPage?.('laptop') },
        { label: '비즈니스', action: () => onNavigateToPage?.('laptop') },
        { label: '크리에이터', action: () => onNavigateToPage?.('laptop') },
        { label: '가성비', action: () => onNavigateToPage?.('laptop') },
        { label: 'Apple', action: () => onNavigateToPage?.('laptop') },
      ],
    },
    monitor: {
      title: '모니터',
      links: [
        { label: '게이밍 모니터', action: () => onNavigateToPage?.('monitor') },
        { label: '전문가용', action: () => onNavigateToPage?.('monitor') },
        { label: '울트라와이드', action: () => onNavigateToPage?.('monitor') },
        { label: '가성비', action: () => onNavigateToPage?.('monitor') },
      ],
    },
    desktop: {
      title: '데스크탑',
      links: [
        { label: '게이밍PC', action: () => onNavigateToPage?.('desktop') },
        { label: '미니PC / Mac', action: () => onNavigateToPage?.('desktop') },
        { label: '올인원', action: () => onNavigateToPage?.('desktop') },
        { label: '사무용', action: () => onNavigateToPage?.('desktop') },
      ],
    },
    services: {
      title: '서비스',
      links: [
        { label: '가격 알림', action: () => onNavigateToPage?.('laptop') },
        { label: '가격 비교', action: () => onNavigateToPage?.('laptop') },
        { label: '가격 추이', action: () => onNavigateToPage?.('laptop') },
        { label: '찜 목록', action: () => onNavigateToPage?.('laptop') },
        { label: '제휴 문의', action: () => window.open('mailto:contact@lapprice.kr', '_blank') },
      ],
    },
  };

  return (
    <footer className="bg-slate-100 text-slate-600 text-xs">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key}>
              <h3 className="font-semibold text-slate-900 mb-3">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={link.action}
                      className="hover:text-slate-900 transition-colors text-left"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 pt-6 mb-6">
          <div className="bg-slate-50 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              <AffiliateDisclosureText />
            </div>
            <AffiliateDisclosure />
          </div>
        </div>

        <div className="border-t border-slate-300 pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4" />
              <span className="font-medium text-slate-900">LapPrice</span>
              <span className="text-slate-400">|</span>
              <span>Copyright &copy; 2026 LapPrice. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => alert('개인정보처리방침 페이지 준비 중입니다.')} className="hover:text-slate-900 transition-colors">개인정보처리방침</button>
              <button onClick={() => alert('이용약관 페이지 준비 중입니다.')} className="hover:text-slate-900 transition-colors">이용약관</button>
              <button onClick={() => alert('제휴 마케팅 고지 페이지 준비 중입니다.')} className="hover:text-slate-900 transition-colors">제휴 마케팅 고지</button>
              <button onClick={() => onNavigateToPage?.('home')} className="hover:text-slate-900 transition-colors">사이트맵</button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
