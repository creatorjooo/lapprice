import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackText?: string;
}

export default function ProductImage({ src, alt, className, fallbackText }: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 로컬 경로(/)로 시작하면서 http가 아닌 경우 → 바로 fallback
  const isLocalPath = src && src.startsWith('/') && !src.startsWith('//');
  const showFallback = hasError || !src || isLocalPath;

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
        src={src}
        alt={alt}
        className={cn(className, isLoading && 'hidden')}
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        onError={() => { setHasError(true); setIsLoading(false); }}
      />
    </>
  );
}
