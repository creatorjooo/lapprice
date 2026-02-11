import { useCallback, useState } from 'react';

const DEFAULT_ERROR = '현재 가격 확인에 실패했습니다. 잠시 후 다시 시도해주세요.';
const CLICK_SUB_ID = 'lapprice_click';
const convertCache = new Map<string, string>();
const convertPending = new Map<string, Promise<string>>();

function isCoupangUrl(url: string): boolean {
  return url.includes('coupang.com') || url.includes('link.coupang.com');
}

async function convertOnClick(url: string): Promise<string> {
  const target = String(url || '').trim();
  if (!target || !isCoupangUrl(target)) return target;

  const cacheKey = `${target}:${CLICK_SUB_ID}`;
  if (convertCache.has(cacheKey)) return convertCache.get(cacheKey) || target;
  if (convertPending.has(cacheKey)) return convertPending.get(cacheKey) || Promise.resolve(target);

  const promise = (async () => {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 2500);
      let response: Response;
      try {
        response = await fetch(
          `/api/affiliate/convert?url=${encodeURIComponent(target)}&subId=${encodeURIComponent(CLICK_SUB_ID)}`,
          { signal: controller.signal },
        );
      } finally {
        window.clearTimeout(timer);
      }

      if (!response.ok) return target;
      const data = await response.json();
      const affiliateUrl = typeof data?.affiliateUrl === 'string' ? data.affiliateUrl : target;
      convertCache.set(cacheKey, affiliateUrl);
      return affiliateUrl;
    } catch {
      return target;
    } finally {
      convertPending.delete(cacheKey);
    }
  })();

  convertPending.set(cacheKey, promise);
  return promise;
}

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
    const resolvedTarget = target.startsWith('/r/')
      ? target
      : await convertOnClick(target);

    window.location.assign(resolvedTarget);
    return true;
  }, []);

  return {
    openVerifiedLink,
    redirectError,
    clearRedirectError,
  };
}
