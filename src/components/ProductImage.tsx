import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { isProxyCandidate, toImageProxySrc } from '@/utils/image';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackText?: string;
}

export default function ProductImage({ src, alt, className, fallbackText }: ProductImageProps) {
  const normalizedSrc = useMemo(() => String(src || '').trim(), [src]);
  const canProxy = useMemo(() => isProxyCandidate(normalizedSrc), [normalizedSrc]);
  const proxySrc = useMemo(() => (canProxy ? toImageProxySrc(normalizedSrc) : ''), [canProxy, normalizedSrc]);

  const [imgSrc, setImgSrc] = useState(normalizedSrc);
  const [usedProxy, setUsedProxy] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setImgSrc(normalizedSrc);
    setUsedProxy(false);
    setHasError(false);
    setIsLoading(true);
  }, [normalizedSrc]);

  // 로컬 경로/placeholder는 즉시 fallback
  const isLocalPath = normalizedSrc.startsWith('/') && !normalizedSrc.startsWith('//');
  const isPlaceholder = normalizedSrc.toLowerCase().includes('placehold.co') || normalizedSrc.toLowerCase().includes('placeholder');
  const showFallback = hasError || !normalizedSrc || isLocalPath || isPlaceholder;

  if (showFallback) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400", className)}>
        <div className="text-center px-2">
          <div className="text-3xl mb-1">📦</div>
          <p className="text-xs font-medium truncate max-w-[120px]">{fallbackText || alt}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className={cn("flex items-center justify-center bg-slate-100 animate-pulse", className)}>
          <div className="text-2xl">⏳</div>
        </div>
      )}
      <img
        src={imgSrc}
        alt={alt}
        className={cn(className, isLoading && 'hidden')}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          if (!usedProxy && canProxy && proxySrc && imgSrc !== proxySrc) {
            setUsedProxy(true);
            setIsLoading(true);
            setImgSrc(proxySrc);
            return;
          }
          setHasError(true);
          setIsLoading(false);
        }}
      />
    </>
  );
}
