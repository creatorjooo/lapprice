/**
 * 어필리에이트 클릭 트래킹 유틸리티
 * navigator.sendBeacon을 사용하여 사용자 경험에 영향 없이 비동기 트래킹
 */

interface ClickTrackData {
  productId?: string;
  platform: string;
  source: 'productcard' | 'navbar_search' | 'cta_button' | 'compare' | 'other';
  url: string;
  productName?: string;
}

/**
 * 어필리에이트 링크 클릭을 트래킹
 * sendBeacon은 페이지 이동/종료 시에도 안정적으로 전송
 */
export function trackAffiliateClick(data: ClickTrackData): void {
  try {
    const payload = JSON.stringify(data);

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/track/click', blob);
    } else {
      // sendBeacon 미지원 브라우저용 폴백
      fetch('/api/track/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // 트래킹 실패 무시
      });
    }
  } catch {
    // 트래킹 실패해도 사용자 경험에 영향 없음
  }
}

/**
 * 스토어 이름으로 플랫폼 키 반환
 */
export function getPlatformKey(storeName: string): string {
  const map: Record<string, string> = {
    '쿠팡': 'coupang',
    'G마켓': 'gmarket',
    '옥션': 'auction',
    '11번가': '11st',
    '네이버': 'naver',
    '네이버쇼핑': 'naver',
    '다나와': 'danawa',
    '에누리': 'ennuri',
    'SSG닷컴': 'ssg',
    'SSG': 'ssg',
    '롯데ON': 'lotteon',
    '인터파크': 'interpark',
  };
  return map[storeName] || storeName.toLowerCase();
}

/**
 * 어필리에이트 수익이 발생하는 플랫폼인지 확인
 */
export function isAffiliatePlatform(storeName: string): boolean {
  const affiliatePlatforms = ['쿠팡', '네이버', '네이버쇼핑'];
  return affiliatePlatforms.includes(storeName);
}
