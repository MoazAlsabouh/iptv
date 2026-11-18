import { MediaItem, StreamSource } from '../types/media';

/**
 * الرابط الافتراضي للواجهة الخلفية (Cloudflare Worker) التي تدمج قنوات IPTV مع أفلام TMDB
 */
export const DEFAULT_BACKEND_M3U_URL = 'https://iptv-backend.moaznsm.workers.dev';

/**
 * دالة مساعدة سريعة لاستخراج خصائص الوسائط (مثل tvg-logo و group-title و tvg-country)
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

interface QualityExtractResult {
  baseName: string;
  qualityLabel: string;
}

/**
 * استخراج لاحقة الجودة وتوحيد اسم القناة الأساسي وإزالة الوسوم الإضافية
 * مثال: "Syria TV Ⓢ [1080p]" -> baseName: "Syria TV", qualityLabel: "1080P"
 */
export function extractQualityAndBaseName(fullName: string): QualityExtractResult {
  if (!fullName) return { baseName: '', qualityLabel: '' };

  let name = fullName.trim();
  let qualityLabel = '';

  // 1. مطابقة واستخراج أنماط الجودة مثل (1080p), [720p], (576p), (SD), (HD), (FHD), (4K)
  const qualityRegex = /[\(\[]\s*(\d{3,4}p|\d{3,4}i|4k|uhd|fhd|hd|sd)\s*[\)\]]/i;
  const match = name.match(qualityRegex);

  if (match) {
    qualityLabel = match[1].toUpperCase();
    name = name.replace(qualityRegex, '').trim();
  } else {
    // مطابقة الجودة في نهاية الاسم
    const endQualityRegex = /\b(1080p|720p|576p|480p|360p|4k|fhd|hd|sd)\b/i;
    const endMatch = name.match(endQualityRegex);
    if (endMatch) {
      qualityLabel = endMatch[1].toUpperCase();
      name = name.replace(endQualityRegex, '').trim();
    }
  }

  // 2. إزالة رموز مثل Ⓢ و Ⓖ
  name = name.replace(/[ⓈⒼ]/g, '');

  // 3. إزالة أي وسوم إضافية بين أقواس مربعة [...] أو دائرية (...)
  name = name.replace(/\[[^\]]*\]/g, '').replace(/\([^\)]*\)/g, '');

  // 4. تنظيف أي علامات ترقيم في البداية والنهاية والمسافات الزائدة
  name = name.replace(/^[\s\-\:\_\|\.\,]+/, '').replace(/[\s\-\:\_\|\.\,]+$/, '');
  name = name.replace(/\s+/g, ' ').trim();

  return {
    baseName: name || fullName.trim(),
    qualityLabel: qualityLabel || '',
  };
}

/**
 * دمج القنوات التي تمتلك نفس الاسم الأساسي في عنصر واحد متعدد المصادر (Multi-Source)
 */
export function mergeMultiSourceChannels(items: MediaItem[]): MediaItem[] {
  if (!items || items.length === 0) return [];

  const map = new Map<string, MediaItem>();
  const merged: MediaItem[] = [];

  for (const item of items) {
    const { baseName, qualityLabel } = extractQualityAndBaseName(item.name);
    // تجميع القناة بناءً على اسمها الموحد ودولتها
    const key = `${baseName.toLowerCase()}|${item.country || ''}`;

    const existing = map.get(key);

    if (existing) {
      if (!existing.sources) {
        const existingQuality = extractQualityAndBaseName(existing.name).qualityLabel;
        existing.sources = [
          { label: existingQuality || 'مصدر 1', url: existing.url },
        ];
      }

      const label = qualityLabel || `مصدر ${existing.sources.length + 1}`;
      // التحقق من عدم تكرار نفس الرابط بالضبط
      if (!existing.sources.some((s) => s.url === item.url)) {
        existing.sources.push({ label, url: item.url });
      }

      // إذا كان التصنيف الحالي أكثر دقة من التصنيف العام
      if (
        existing.groupTitle === 'قنوات عامة ومنوعة' &&
        item.groupTitle &&
        item.groupTitle !== 'قنوات عامة ومنوعة'
      ) {
        existing.groupTitle = item.groupTitle;
      }

      // إذا كان الشعار مفقوداً في العنصر السابق وتوفر في الحالي، نحدثه
      if (!existing.logo && item.logo) {
        existing.logo = item.logo;
      }
    } else {
      const singleSourceLabel = qualityLabel || 'مصدر 1';
      const newItem: MediaItem = {
        ...item,
        name: baseName,
        sources: [{ label: singleSourceLabel, url: item.url }],
      };
      map.set(key, newItem);
      merged.push(newItem);
    }
  }

  return merged;
}

/**
 * محلل M3U فائق الأداء مصمم خصيصاً للقوائم الضخمة (عشرات الآلاف من القنوات) على أجهزة التلفاز.
 * يعتمد خوارزمية مسح خطية O(N) مع دمج القنوات متعددة المصادر.
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
      const country = extractAttribute(line, 'tvg-country');
      const name = extractChannelName(line);

      currentItem = {
        id: String(counter++),
        name: name || 'Unknown Channel',
        groupTitle,
        country: country || undefined,
        logo,
      };
    } else if (!line.startsWith('#') && currentItem) {
      // السطر يمثل رابط البث المباشر (Stream URL)
      if (line.length > 5) {
        const country = currentItem.country || '';
        const groupTitle = currentItem.groupTitle || 'General';
        const lowerUrl = line.toLowerCase();
        const isVod =
          country === 'أفلام عالمية' ||
          groupTitle === 'أفلام رائجة' ||
          groupTitle === 'أفلام عالمية' ||
          ((lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.mkv') || lowerUrl.includes('/sample/')) &&
            !lowerUrl.includes('.m3u8'));

        items.push({
          id: currentItem.id || String(counter++),
          name: currentItem.name || 'Unknown Channel',
          groupTitle,
          country: currentItem.country,
          logo: currentItem.logo || '',
          url: line,
          type: isVod ? 'movie' : 'live',
        });
      }
      // تصفير العنصر المؤقت للتحضير للقناة التالية
      currentItem = null;
    }
  }

  return mergeMultiSourceChannels(items);
}

/**
 * دالة غير متزامنة لجلب قائمة تشغيل M3U من رابط خارجي وتحليلها مباشرة.
 * تدعم الاتصال المباشر (Direct Fetch) افتراضياً لأن خادمنا يدعم CORS مباشرة.
 *
 * @param playlistUrl رابط قائمة التشغيل M3U
 * @param useProxy خيار تفعيل خادم الوسيط (CORS Proxy) - افتراضياً false
 * @param proxyPrefix رابط خدمة البروكسي عند الرغبة في استخدامه
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
    // روابط خادمنا السحابي (workers.dev) تدعم CORS مباشرة ولا يجوز تغليفها بالبروكسي
    const isDirectServer = cleanUrl.includes('workers.dev') || cleanUrl.includes('iptv-backend');
    const finalUrl = (useProxy && !isDirectServer)
      ? `${proxyPrefix}${encodeURIComponent(cleanUrl)}`
      : cleanUrl;

    const response = await fetch(finalUrl, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('فشل الاتصال بالخادم، يرجى إعادة المحاولة');
    }

    const content = await response.text();
    return parseM3U(content);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'خطأ غير متوقع أثناء معالجة القنوات';

    console.error('[m3uParser] Error fetching or parsing playlist:', errorMessage);
    throw new Error(errorMessage.startsWith('فشل') ? errorMessage : 'تعذر تحميل القنوات، يرجى التحقق من اتصال الإنترنت');
  }
}

/**
 * دالة مخصصة لجلب وتحليل قائمة التشغيل المدمجة تلقائياً وبشكل مباشر من خادم Cloudflare Worker
 * (الرابط: https://iptv-backend.moaznsm.workers.dev)
 *
 * @param useProxy خيار تفعيل البروكسي (افتراضياً: false)
 * @returns مصفوفة القنوات والأفلام المحللة
 */
export async function fetchBackendPlaylist(useProxy: boolean = false): Promise<MediaItem[]> {
  return fetchAndParseM3U(DEFAULT_BACKEND_M3U_URL, useProxy);
}
