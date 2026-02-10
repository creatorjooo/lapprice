import { useState, useEffect, useRef } from 'react';

interface AffiliateLink {
  originalUrl: string;
  affiliateUrl: string;
  shortenUrl: string;
}

interface AffiliateLinkCache {
  [url: string]: string;
}

// 모듈 레벨 캐시 (컴포넌트 리렌더 간 유지)
const globalCache: AffiliateLinkCache = {};
const pendingRequests = new Map<string, Promise<string>>();

/**
 * 쿠팡 URL인지 확인
 */
function isCoupangUrl(url: string): boolean {
  return url.includes('coupang.com');
}

/**
 * 단일 URL 어필리에이트 변환 유틸리티 (캐시 + 디바운스)
 */
async function convertSingleUrl(url: string, subId: string): Promise<string> {
  if (!isCoupangUrl(url)) return url;

  // 캐시 확인
  const cacheKey = `${url}:${subId}`;
  if (globalCache[cacheKey]) return globalCache[cacheKey];

  // 진행 중인 동일 요청 재사용
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const promise = fetch(`/api/affiliate/convert?url=${encodeURIComponent(url)}&subId=${encodeURIComponent(subId)}`)
    .then((res) => res.json())
    .then((data: AffiliateLink) => {
      globalCache[cacheKey] = data.affiliateUrl;
      pendingRequests.delete(cacheKey);
      return data.affiliateUrl;
    })
    .catch(() => {
      pendingRequests.delete(cacheKey);
      return url;
    });

  pendingRequests.set(cacheKey, promise);
  return promise;
}

/**
 * 배치 URL 어필리에이트 변환
 */
async function convertBatchUrls(urls: string[], subId: string): Promise<string[]> {
  const coupangUrls: string[] = [];
  const coupangIndices: number[] = [];

  // 쿠팡 URL만 필터링
  urls.forEach((url, i) => {
    if (isCoupangUrl(url)) {
      const cacheKey = `${url}:${subId}`;
      if (!globalCache[cacheKey]) {
        coupangUrls.push(url);
        coupangIndices.push(i);
      }
    }
  });

  // 변환 필요한 쿠팡 URL이 있으면 배치 호출
  if (coupangUrls.length > 0) {
    try {
      const response = await fetch('/api/affiliate/deeplink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: coupangUrls, subId }),
      });
      const data = await response.json();
      const links: AffiliateLink[] = data.links || [];

      links.forEach((link) => {
        const cacheKey = `${link.originalUrl}:${subId}`;
        globalCache[cacheKey] = link.affiliateUrl;
      });
    } catch {
      // 실패 시 원본 URL 유지
    }
  }

  // 결과 매핑
  return urls.map((url) => {
    if (isCoupangUrl(url)) {
      const cacheKey = `${url}:${subId}`;
      return globalCache[cacheKey] || url;
    }
    return url;
  });
}

/**
 * 어필리에이트 링크 변환 훅
 * ProductCard, Navbar 등에서 사용
 */
export function useAffiliateLink(url: string, subId: string = 'lapprice') {
  const [affiliateUrl, setAffiliateUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!url || !isCoupangUrl(url)) {
      setAffiliateUrl(url);
      return;
    }

    // 캐시 확인
    const cacheKey = `${url}:${subId}`;
    if (globalCache[cacheKey]) {
      setAffiliateUrl(globalCache[cacheKey]);
      return;
    }

    setIsLoading(true);
    convertSingleUrl(url, subId).then((result) => {
      setAffiliateUrl(result);
      setIsLoading(false);
    });
  }, [url, subId]);

  return { affiliateUrl, isLoading, isAffiliate: affiliateUrl !== url };
}

/**
 * 배치 어필리에이트 링크 변환 훅
 * 여러 스토어 URL을 한 번에 변환할 때 사용
 */
export function useAffiliateBatch(urls: string[], subId: string = 'lapprice') {
  const [affiliateUrls, setAffiliateUrls] = useState<string[]>(urls);
  const [isLoading, setIsLoading] = useState(false);
  const prevUrlsRef = useRef<string>('');

  useEffect(() => {
    const urlsKey = urls.join('|');
    if (urlsKey === prevUrlsRef.current) return;
    prevUrlsRef.current = urlsKey;

    const coupangUrls = urls.filter(isCoupangUrl);
    if (coupangUrls.length === 0) {
      setAffiliateUrls(urls);
      return;
    }

    // 모든 캐시에 있는지 확인
    const allCached = coupangUrls.every((u) => globalCache[`${u}:${subId}`]);
    if (allCached) {
      setAffiliateUrls(urls.map((u) => isCoupangUrl(u) ? (globalCache[`${u}:${subId}`] || u) : u));
      return;
    }

    setIsLoading(true);
    convertBatchUrls(urls, subId).then((results) => {
      setAffiliateUrls(results);
      setIsLoading(false);
    });
  }, [urls, subId]);

  return { affiliateUrls, isLoading };
}

export { isCoupangUrl };
