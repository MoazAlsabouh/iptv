import { MediaItem } from '../types/media';

/**
 * الرابط الافتراضي للواجهة الخلفية (Cloudflare Worker) التي تدمج قنوات IPTV مع أفلام TMDB
 */
export const DEFAULT_BACKEND_M3U_URL = 'https://iptv-backend.moaznsm.workers.dev';

/**
 * دالة مساعدة سريعة لاستخراج خصائص الوسائط (مثل tvg-logo و group-title)
 * تم استخدام indexOf و substring لتفادي عبء Regular Expressions على معالجات التلفاز الضعيفة.
 */
function extractAttribute(line: string, attrName: string): string {
  const keyDouble = `${attrName}="`;
  let startIdx = line.indexOf(keyDouble);
  let quoteChar = '"';

  if (startIdx === -1) {
    const keySingle = `${attrName}='`;
    startIdx = line.indexOf(keySingle);
    quoteChar = "'";
    if (startIdx === -1) {
      return '';
    }
    const valueStart = startIdx + keySingle.length;
    const endIdx = line.indexOf(quoteChar, valueStart);
    return endIdx !== -1 ? line.substring(valueStart, endIdx).trim() : '';
  }

  const valueStart = startIdx + keyDouble.length;
  const endIdx = line.indexOf(quoteChar, valueStart);
  return endIdx !== -1 ? line.substring(valueStart, endIdx).trim() : '';
}

/**
 * دالة مساعدة لاستخراج اسم القناة بعد الفاصلة في سطر EXTINF
 * يتم البحث عن الفاصلة بعد آخر علامة تنصيص لضمان عدم الخلط مع الفواصل الموجودة داخل التصنيفات.
 */
function extractChannelName(line: string): string {
  const lastQuoteIdx = line.lastIndexOf('"');
  let commaIdx = -1;

  if (lastQuoteIdx !== -1) {
    commaIdx = line.indexOf(',', lastQuoteIdx);
  } else {
    commaIdx = line.indexOf(',');
  }

  if (commaIdx !== -1 && commaIdx < line.length - 1) {
    return line.substring(commaIdx + 1).trim();
  }

  return 'Unknown Channel';
}

/**
 * محلل M3U فائق الأداء مصمم خصيصاً للقوائم الضخمة (عشرات الآلاف من القنوات) على أجهزة التلفاز.
 * يعتمد خوارزمية مسح خطية O(N) بدون أي مكتبات خارجية وبدون تعبيرات نمطية ثقيلة (Regex)
 * لتفادي استهلاك الذاكرة (OOM) وتجميد واجهة المستخدم (UI Freezing).
 *
 * @param content محتوى ملف M3U كنص خام
 * @returns مصفوفة من عناصر MediaItem الجاهزة للعرض
 */
export function parseM3U(content: string): MediaItem[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const lines = content.split('\n');
  const totalLines = lines.length;
  const items: MediaItem[] = [];

  let currentItem: Partial<MediaItem> | null = null;
  let counter = 1;

  for (let i = 0; i < totalLines; i++) {
    const line = lines[i].trim();

    if (line.length === 0) {
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      const logo = extractAttribute(line, 'tvg-logo');
      const groupTitle = extractAttribute(line, 'group-title') || 'General';
      const name = extractChannelName(line);

      currentItem = {
        id: String(counter++),
        name: name || 'Unknown Channel',
        groupTitle,
        logo,
      };
    } else if (!line.startsWith('#') && currentItem) {
      // السطر يمثل رابط البث المباشر (Stream URL)
      if (line.length > 5) {
        items.push({
          id: currentItem.id || String(counter++),
          name: currentItem.name || 'Unknown Channel',
          groupTitle: currentItem.groupTitle || 'General',
          logo: currentItem.logo || '',
          url: line,
        });
      }
      // تصفير العنصر المؤقت للتحضير للقناة التالية
      currentItem = null;
    }
  }

  return items;
}

/**
 * دالة غير متزامنة لجلب قائمة تشغيل M3U من رابط خارجي وتحليلها مباشرة.
 * تدعم تمرير الرابط عبر خادم وكيل (CORS Proxy) لمعالجة قيود المتصفح والشبكة عند طلب روابط مجانية.
 *
 * @param playlistUrl رابط قائمة التشغيل M3U
 * @param useProxy خيار تفعيل خادم الوسيط (CORS Proxy) لحل مشاكل الحظر
 * @param proxyPrefix رابط خدمة البروكسي المجانية (افتراضياً: api.allorigins.win)
 * @returns وعد (Promise) بمصفوفة MediaItem المحللة
 */
export async function fetchAndParseM3U(
  playlistUrl: string,
  useProxy: boolean = false,
  proxyPrefix: string = 'https://api.allorigins.win/raw?url='
): Promise<MediaItem[]> {
  try {
    if (!playlistUrl || playlistUrl.trim().length === 0) {
      throw new Error('رابط قائمة التشغيل غير صالح أو فارغ');
    }

    const cleanUrl = playlistUrl.trim();
    const finalUrl = useProxy
      ? `${proxyPrefix}${encodeURIComponent(cleanUrl)}`
      : cleanUrl;

    const response = await fetch(finalUrl);

    if (!response.ok) {
      throw new Error(`فشل جلب القائمة من المصدر. كود الاستجابة: ${response.status}`);
    }

    const content = await response.text();
    return parseM3U(content);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'خطأ غير متوقع أثناء معالجة القائمة';

    console.error('[m3uParser] Error fetching or parsing M3U:', errorMessage);
    throw new Error(`خطأ في معالجة قائمة M3U: ${errorMessage}`);
  }
}

/**
 * دالة مخصصة لجلب وتحليل قائمة التشغيل المدمجة تلقائياً من خادم Cloudflare Worker الخاص بالتطبيق
 * (الرابط: https://iptv-backend.moaznsm.workers.dev)
 *
 * @param useProxy خيار تفعيل البروكسي إذا لزم الأمر
 * @returns مصفوفة القنوات والأفلام المحللة
 */
export async function fetchBackendPlaylist(useProxy: boolean = false): Promise<MediaItem[]> {
  return fetchAndParseM3U(DEFAULT_BACKEND_M3U_URL, useProxy);
}
