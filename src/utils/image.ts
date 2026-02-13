const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const PROXY_HOSTS = [
  'shopping-phinf.pstatic.net',
  'shop-phinf.pstatic.net',
  'coupangcdn.com',
  'image.11st.co.kr',
  'i.011st.com',
  'gmarket.co.kr',
  'auction.co.kr',
  'danawa.com',
  'enuri.com',
  'ssgcdn.com',
  'lotteon.com',
  'interpark.com',
];

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function isProxyCandidate(src?: string): boolean {
  const value = String(src || '').trim();
  if (!value || !isHttpUrl(value)) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return PROXY_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export function toImageProxySrc(src?: string): string {
  const value = String(src || '').trim();
  if (!value || !isHttpUrl(value)) return value;
  const base = API_BASE || '';
  return `${base}/api/image-proxy?url=${encodeURIComponent(value)}`;
}

export function toImageSrc(src?: string): string {
  const value = String(src || '').trim();
  if (!value) return '';
  if (isProxyCandidate(value)) return toImageProxySrc(value);
  return value;
}
