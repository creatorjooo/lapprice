import { useCallback, useState } from 'react';

const DEFAULT_ERROR = '현재 가격 확인에 실패했습니다. 잠시 후 다시 시도해주세요.';

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
    window.location.assign(target);
    return true;
  }, []);

  return {
    openVerifiedLink,
    redirectError,
    clearRedirectError,
  };
}
