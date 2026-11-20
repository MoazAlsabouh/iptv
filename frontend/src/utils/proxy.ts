import { Platform } from 'react-native';

/**
 * مساعدات نظام HLS Stream Proxy
 * يقوم بتوجيه روابط البث التي تفرض حماية 403 على المتصفحات (مثل قنوات MBC و EdgeNext)
 * أو روابط HTTP المباشرة (Mixed Content) عبر الخادم السحابي مع إعادة كتابة قوائم M3U8 تلقائياً.
 */

export const BACKEND_PROXY_URL = 'https://iptv-backend.moaznsm.workers.dev/api/proxy';

/**
 * التحقق مما إذا كان الرابط يجب توجيهه تلقائياً عبر البروكسي
 * 1. على بيئة الويب التي تعمل بـ HTTPS: أي رابط يبدأ بـ http:// يتعرض لحظر Mixed Content من المتصفح.
 * 2. النطاقات المعروفة برفض طلبات المتصفح وفرض 403 (مثل سيرفرات MBC و EdgeNext).
 * 3. روابط IP المباشرة عند تشغيلها عبر الويب.
 */
export function shouldAutoProxy(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.trim().toLowerCase();

  // على بيئة الويب العاملة ببروتوكول HTTPS، المتصفح يحظر أي طلب غير مشفر http:// تلقائياً كـ Mixed Content
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location?.protocol === 'https:' &&
    lower.startsWith('http://')
  ) {
    return true;
  }

  // عناوين IP المباشرة بروتوكول http غير آمن على الويب
  if (Platform.OS === 'web' && lower.startsWith('http://') && /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(lower)) {
    return true;
  }

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
