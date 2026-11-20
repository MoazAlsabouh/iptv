/**
 * مساعدات نظام HLS Stream Proxy
 * يقوم بتوجيه روابط البث التي تفرض حماية 403 على المتصفحات (مثل قنوات MBC و EdgeNext)
 * عبر الخادم السحابي مع إعادة كتابة قوائم M3U8 والمقاطع تلقائياً.
 */

export const BACKEND_PROXY_URL = 'https://iptv-backend.moaznsm.workers.dev/api/proxy';

/**
 * التحقق مما إذا كان الرابط ينتمي لنطاقات معروفة برفض طلبات المتصفح (مثل 403 Forbidden)
 */
export function shouldAutoProxy(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('edgenextcdn.net') ||
    lower.includes('shd-gcp-live') ||
    lower.includes('shahid.mbc.net') ||
    lower.includes('/eds/mbc') ||
    lower.includes('mbc')
  );
}

/**
 * تحويل رابط البث ليمر عبر بروكسي الخادم السحابي
 */
export function getProxyStreamUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith(BACKEND_PROXY_URL)) {
    return url;
  }
  return `${BACKEND_PROXY_URL}?url=${encodeURIComponent(url)}`;
}
