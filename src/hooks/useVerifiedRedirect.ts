import { useCallback, useState } from 'react';

const DEFAULT_ERROR = '현재 가격 검증 실패, 잠시 후 재시도해주세요.';

export function useVerifiedRedirect() {
  const [redirectError, setRedirectError] = useState<string | null>(null);

  const clearRedirectError = useCallback(() => {
    setRedirectError(null);
  }, []);

  const openVerifiedLink = useCallback(async (href: string) => {
    const target = String(href || '').trim();
    if (!target) {
      setRedirectError(DEFAULT_ERROR);
      return false;
    }

    setRedirectError(null);
    const popup = window.open('', '_blank', 'noopener,noreferrer');

    if (!popup) {
      setRedirectError('브라우저 팝업 차단으로 링크를 열지 못했습니다.');
      return false;
    }

    if (!target.startsWith('/r/')) {
      popup.location.href = target;
      return true;
    }

    try {
      const response = await fetch(target, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location') || response.headers.get('Location');
        if (location) {
          popup.location.href = location;
          return true;
        }
      }

      // 일부 브라우저는 redirected/url만 제공
      if (response.ok && response.redirected && response.url) {
        popup.location.href = response.url;
        return true;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        popup.close();
        const data = await response.json().catch(() => null);
        setRedirectError(data?.error || DEFAULT_ERROR);
        return false;
      }

      // 브라우저가 manual redirect 메타데이터를 숨기는 경우 /r 자체를 열어 서버가 안내
      popup.location.href = target;
      return true;
    } catch {
      popup.close();
      setRedirectError(DEFAULT_ERROR);
      return false;
    }
  }, []);

  return {
    openVerifiedLink,
    redirectError,
    clearRedirectError,
  };
}
