import { useState } from 'react';
import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * 공정위 필수 어필리에이트 고지 컴포넌트
 * - 쿠팡 파트너스 및 네이버 쇼핑커넥트 제휴 고지
 * - 클릭 시 상세 설명 모달 표시
 */
export default function AffiliateDisclosure() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 인라인 고지 문구 */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <Info className="w-3 h-3" />
        <span>제휴 마케팅 고지</span>
      </button>

      {/* 상세 설명 모달 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">제휴 마케팅 고지</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              본 사이트는 쿠팡 파트너스 및 네이버 쇼핑커넥트 활동의 일환으로,
              이에 따른 일정액의 수수료를 제공받습니다.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-slate-900 dark:text-white">어떻게 작동하나요?</p>
              <ul className="text-xs space-y-1 text-slate-500 dark:text-slate-400 list-disc pl-4">
                <li>본 사이트의 상품 링크를 통해 구매하시면, 사이트 운영자에게 소정의 수수료가 지급됩니다.</li>
                <li>이 수수료는 고객님이 지불하는 금액에 추가되지 않습니다.</li>
                <li>상품 가격은 동일하며, 어필리에이트 여부와 관계없이 항상 최저가 정보를 제공합니다.</li>
              </ul>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
              <p className="text-xs text-blue-600 dark:text-blue-400">
                "제휴" 표시가 있는 상품 링크가 어필리에이트 링크입니다.
                제휴 링크를 통한 구매는 본 사이트의 운영 및 콘텐츠 개선에 도움이 됩니다.
              </p>
            </div>
            <p className="text-[10px] text-slate-400">
              공정거래위원회 추천·보증 등에 관한 표시·광고 심사지침에 따른 고지
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * 푸터용 고지 텍스트 (간략 버전)
 */
export function AffiliateDisclosureText() {
  return (
    <p className="text-[10px] text-slate-400 leading-relaxed">
      이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      <br />
      본 사이트는 제휴 마케팅을 통해 운영되며, 상품 가격에 추가 비용이 발생하지 않습니다.
    </p>
  );
}
