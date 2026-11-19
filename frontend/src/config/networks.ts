import { Platform } from 'react-native';
import { MediaItem } from '../types/media';

/**
 * بنية تمثل سلسلة أو باقة قنوات تلفزيونية (Network / Chain)
 */
export interface ChannelNetwork {
  id: string;
  name: string;
  keywords: string[];
  description?: string;
  icon?: string;
  isCustom?: boolean;
}

/**
 * الباقات والسلاسل الافتراضية المعرفة مسبقاً في النظام
 */
export const DEFAULT_NETWORKS: ChannelNetwork[] = [
  {
    id: 'mbc',
    name: 'باقة MBC',
    keywords: ['mbc', 'ام بي سي', 'إم بي سي', 'شاهد'],
    description: 'قنوات مركز تلفزيون الشرق الأوسط (MBC 1, 2, 3, 4, Action, Drama, Masr...)',
    icon: 'tv',
  },
  {
    id: 'rotana',
    name: 'باقة روتانا',
    keywords: ['rotana', 'روتانا', 'رسالة', 'lbc sat'],
    description: 'قنوات شبكة روتانا الفضائية (سينما، دراما، كلاسيك، كليب، خليجية، كوميدي)',
    icon: 'movie',
  },
  {
    id: 'bein',
    name: 'شبكة beIN',
    keywords: ['bein', 'be in', 'بي ان', 'بي إن'],
    description: 'قنوات beIN الإخبارية والرياضية المفتوحة والترفيهية',
    icon: 'sports',
  },
  {
    id: 'aljazeera',
    name: 'شبكة الجزيرة',
    keywords: ['al jazeera', 'aljazeera', 'الجزيرة'],
    description: 'قنوات الجزيرة الإخبارية، مباشر، الوثائقية، والإنجليزية',
    icon: 'language',
  },
  {
    id: 'alarabiya',
    name: 'شبكة العربية والحدث',
    keywords: ['alarabiya', 'al arabiya', 'العربية', 'الحدث'],
    description: 'قنوات العربية والحدث الإخبارية والتحليلية',
    icon: 'feed',
  },
  {
    id: 'abudhabi',
    name: 'باقة أبوظبي',
    keywords: ['abu dhabi', 'abudhabi', 'أبوظبي', 'ابوظبي', 'ad sports', 'ad tv'],
    description: 'قنوات أبوظبي الأولى، الإمارات، وقنوات أبوظبي الرياضية',
    icon: 'live-tv',
  },
  {
    id: 'dubai',
    name: 'باقة دبي',
    keywords: ['dubai', 'دبي', 'sama dubai', 'سما دبي'],
    description: 'مؤسسة دبي للإعلام (دبي، سما دبي، دبي زمان، دبي الرياضية)',
    icon: 'live-tv',
  },
  {
    id: 'ssc',
    name: 'قنوات SSC الرياضية',
    keywords: ['ssc', 'شركة الرياضة السعودية'],
    description: 'قنوات الرياضة السعودية SSC المفتوحة',
    icon: 'sports-soccer',
  },
  {
    id: 'osn',
    name: 'قنوات OSN',
    keywords: ['osn', 'اوربت', 'شوتايم'],
    description: 'شبكة قنوات OSN للسينما والترفيه',
    icon: 'video-library',
  },
  {
    id: 'kids',
    name: 'باقة قنوات الأطفال',
    keywords: [
      'spacetoon',
      'space toon',
      'سبيستون',
      'سبيس تون',
      'طيور الجنة',
      'toyor',
      'كرتون',
      'cartoon',
      'ماجد',
      'majid',
      'براعم',
      'baraem',
      'jeem',
      'جيم',
      'كوجي',
      'cn arabic',
    ],
    description: 'أفضل قنوات الكرتون والرسوم المتحركة للأطفال والناشئة',
    icon: 'child-care',
  },
  {
    id: 'islamic',
    name: 'باقة القنوات الإسلامية والقرآن',
    keywords: [
      'قرآن',
      'quran',
      'سنة',
      'sunnah',
      'مكة',
      'makkah',
      'مدينة',
      'madinah',
      'المجد',
      'almajd',
      'اقرأ',
      'iqraa',
      'رسالة',
    ],
    description: 'قنوات القرآن الكريم المباشر من الحرمين الشريفين والبرامج الدينية',
    icon: 'menu-book',
  },
  {
    id: 'news',
    name: 'باقة الأخبار الدولية',
    keywords: [
      'bbc arabic',
      'فرانس 24',
      'france 24',
      'سكاي نيوز',
      'sky news arabia',
      'روسيا اليوم',
      'rt arabic',
      'الحرة',
      'alhurra',
      'dw arabic',
      'trt عربي',
      'تلفزيون العربي',
      'alaraby',
    ],
    description: 'أبرز القنوات الإخبارية الدولية الناطقة بالعربية',
    icon: 'public',
  },
];

export const CUSTOM_NETWORKS_STORAGE_KEY = 'custom_channel_networks_v1';

/**
 * فحص ما إذا كانت القناة تطابق سلسلة أو باقة معينة
 */
export function matchChannelToNetwork(
  channel: MediaItem,
  network: ChannelNetwork
): boolean {
  const name = (channel.name || '').toLowerCase();
  const group = (channel.groupTitle || '').toLowerCase();

  return network.keywords.some((kw) => {
    const k = kw.trim().toLowerCase();
    if (!k) return false;
    return name.includes(k) || group.includes(k);
  });
}

let memoryCustomNetworks: ChannelNetwork[] = [];

/**
 * حفظ الباقات المخصصة في التخزين المحلي
 */
export async function saveCustomNetworks(
  networks: ChannelNetwork[]
): Promise<void> {
  try {
    memoryCustomNetworks = networks;
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      window.localStorage
    ) {
      window.localStorage.setItem(
        CUSTOM_NETWORKS_STORAGE_KEY,
        JSON.stringify(networks)
      );
    }
  } catch (err) {
    console.warn('[Networks] Failed to save custom networks:', err);
  }
}

/**
 * قراءة الباقات المخصصة من التخزين المحلي
 */
export async function getStoredCustomNetworks(): Promise<ChannelNetwork[]> {
  try {
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      window.localStorage
    ) {
      const data = window.localStorage.getItem(CUSTOM_NETWORKS_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as ChannelNetwork[];
    }
    return memoryCustomNetworks;
  } catch (err) {
    console.warn('[Networks] Failed to read custom networks:', err);
    return [];
  }
}
