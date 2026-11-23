import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { useAuth } from '../context/AuthContext';
import { fetchAndParseM3U } from '../utils/m3uParser';
import { MediaItem } from '../types/media';
import {
  DEFAULT_NETWORKS,
  ChannelNetwork,
  fetchNetworks,
  getStoredCustomNetworks,
  matchChannelToNetwork,
} from '../config/networks';

/**
 * الكلمات المحظورة في وضع الرقابة الأبوية (Child Mode)
 */
const RESTRICTED_KEYWORDS: string[] = ['action', 'horror', 'adult', 'news', '18+', 'xxx'];

/**
 * فحص ما إذا كان التصنيف يحتوي على محتوى مقيد للأطفال
 */
function isRestrictedCategory(categoryName: string): boolean {
  const lower = String(categoryName || '').toLowerCase();
  return RESTRICTED_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * بنية تمثل مجموعة قنوات مجمعة (حسب القسم أو الدولة) مع عدد القنوات وعينة من الشعار
 */
export interface CategoryGroup {
  name: string;
  count: number;
  channels: MediaItem[];
  sampleLogo?: string;
}

/**
 * دالة مساعدة لتجميع القنوات حسب التصنيف (groupTitle) بكفاءة عالية
 */
export function groupChannelsByCategory(channels: MediaItem[]): CategoryGroup[] {
  if (!channels || channels.length === 0) {
    return [];
  }

  const map = new Map<string, MediaItem[]>();

  for (let i = 0; i < channels.length; i++) {
    const item = channels[i];
    const category = item.groupTitle ? item.groupTitle.trim() : 'قنوات عامة ومنوعة';
    const existing = map.get(category);

    if (existing) {
      existing.push(item);
    } else {
      map.set(category, [item]);
    }
  }

  const categories: CategoryGroup[] = [];

  for (const [name, items] of map.entries()) {
    const sampleItem = items.find((c) => Boolean(c.logo && c.logo.trim().length > 0));

    categories.push({
      name,
      count: items.length,
      channels: items,
      sampleLogo: sampleItem ? sampleItem.logo : undefined,
    });
  }

  return categories;
}

/**
 * ترتيب الدول المفضل لعرضها بشكل منظم في واجهة التلفاز
 */
const PREFERRED_COUNTRY_ORDER: string[] = [
  'قنوات عربية دولية',
  'سوريا',
  'السعودية',
  'مصر',
  'الإمارات',
  'الأردن',
  'لبنان',
  'فلسطين',
  'العراق',
  'قطر',
  'الكويت',
  'المغرب',
  'الجزائر',
  'تونس',
  'عُمان',
  'البحرين',
  'ليبيا',
  'اليمن',
  'السودان',
  'موريتانيا',
  'الصومال',
  'جيبوتي',
  'جزر القمر',
];

/**
 * التحقق مما إذا كان العنصر محتوى مسجل/فيلم (VOD) وليس قناة بث تلفزيوني مباشر
 */
export function isVodItem(item: MediaItem): boolean {
  if (item.type === 'movie' || item.type === 'series') {
    return true;
  }
  const country = (item.country || '').trim();
  if (country === 'أفلام عالمية' || country.toLowerCase().includes('vod')) {
    return true;
  }
  const group = (item.groupTitle || '').trim();
  const lowerGroup = group.toLowerCase();
  if (
    group === 'أفلام رائجة' ||
    group === 'أفلام عالمية' ||
    lowerGroup === 'vod' ||
    lowerGroup.includes('vod')
  ) {
    return true;
  }
  const url = String(item.url || '').toLowerCase();
  // ملفات الفيديو المسجلة (mp4, mkv, webm, sample) التي لا تمثل بثاً حياً (.m3u8)
  if (
    (url.endsWith('.mp4') || url.endsWith('.mkv') || url.endsWith('.webm') || url.includes('/sample/')) &&
    !url.includes('.m3u8')
  ) {
    return true;
  }
  return false;
}

/**
 * دالة مساعدة لتجميع القنوات حسب سلاسل وشبكات القنوات (Networks)
 */
export function groupChannelsByNetwork(
  channels: MediaItem[],
  networkList: ChannelNetwork[]
): CategoryGroup[] {
  if (!channels || channels.length === 0) {
    return [];
  }

  const groups: CategoryGroup[] = [];

  for (const network of networkList) {
    if (network.isHidden || network.isDeleted) continue;

    const excludedSet = new Set((network.excludedChannelIds || []).map((id) => id.toLowerCase().trim()));
    const hiddenSet = new Set((network.hiddenChannelIds || []).map((id) => id.toLowerCase().trim()));

    const matched = channels.filter((ch) => {
      const chId = String(ch.id || '').toLowerCase().trim();
      const chName = String(ch.name || '').toLowerCase().trim();
      // استثناء القنوات المحذوفة أو المخفية محلياً من هذه السلسلة فقط
      if (excludedSet.has(chId) || excludedSet.has(chName)) return false;
      if (hiddenSet.has(chId) || hiddenSet.has(chName)) return false;
      return matchChannelToNetwork(ch, network);
    });

    if (matched.length > 0) {
      const sampleItem = matched.find((c) => Boolean(c.logo && c.logo.trim().length > 0));
      groups.push({
        name: network.name,
        count: matched.length,
        channels: matched,
        sampleLogo: sampleItem ? sampleItem.logo : undefined,
      });
    }
  }

  return groups;
}

/**
 * دالة مساعدة لتجميع القنوات حسب الدولة (tvg-country)
 */
export function groupChannelsByCountry(channels: MediaItem[]): CategoryGroup[] {
  if (!channels || channels.length === 0) {
    return [];
  }

  const map = new Map<string, MediaItem[]>();

  for (let i = 0; i < channels.length; i++) {
    const item = channels[i];
    const country = item.country ? item.country.trim() : 'قنوات عامة';
    const existing = map.get(country);

    if (existing) {
      existing.push(item);
    } else {
      map.set(country, [item]);
    }
  }

  const groups: CategoryGroup[] = [];

  for (const [name, items] of map.entries()) {
    const sampleItem = items.find((c) => Boolean(c.logo && c.logo.trim().length > 0));

    groups.push({
      name,
      count: items.length,
      channels: items,
      sampleLogo: sampleItem ? sampleItem.logo : undefined,
    });
  }

  // فرز المجموعات حسب الترتيب العربي المفضل
  groups.sort((a, b) => {
    const indexA = PREFERRED_COUNTRY_ORDER.indexOf(a.name);
    const indexB = PREFERRED_COUNTRY_ORDER.indexOf(b.name);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return b.count - a.count;
  });

  return groups;
}

/**
 * Hook مخصص لإدارة جلب وتحليل بيانات الوسائط وحفظها مؤقتاً بواسطة React Query.
 * يتصل مباشرة بالرابط (بدون بروكسي خارجي) لأن خادمنا السحابي يدعم CORS مباشرة.
 */
export function useMediaData() {
  const playlistUrl = useAppStore((state) => state.playlistUrl);
  const isChildMode = useAppStore((state) => state.isChildMode);
  const { token, isLoading: isAuthLoading } = useAuth();

  const isBackendUrl = !playlistUrl || (playlistUrl || '').includes('workers.dev') || (playlistUrl || '').includes('iptv-backend');
  const isQueryEnabled = Boolean(
    playlistUrl &&
    playlistUrl.trim().length > 0 &&
    !isAuthLoading &&
    (!isBackendUrl || Boolean(token))
  );

  const query = useQuery<MediaItem[], Error>({
    queryKey: ['playlistMedia', playlistUrl, token],
    queryFn: () => fetchAndParseM3U(playlistUrl, false, undefined, token),
    enabled: isQueryEnabled,
    staleTime: 1000 * 60 * 5, // 5 دقائق
    retry: (failureCount, error) => {
      // لا تعيد المحاولة في حال انتهاء الاشتراك أو عدم التفعيل
      if (error && error.message && typeof error.message === 'string' && error.message.includes('الاشتراك')) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // فصل عناصر البث التلفزيوني المباشر عن محتوى الأفلام والمسلسلات (VOD)
  const { liveChannels, vodItems } = useMemo(() => {
    if (!query.data) return { liveChannels: [], vodItems: [] };

    const live: MediaItem[] = [];
    const vod: MediaItem[] = [];

    for (const item of query.data) {
      if (isVodItem(item)) {
        vod.push({ ...item, type: item.type || 'movie' });
      } else {
        live.push({ ...item, type: 'live' });
      }
    }

    return { liveChannels: live, vodItems: vod };
  }, [query.data]);

  // تصفية قنوات البث المباشر للأطفال
  const filteredLiveChannels = useMemo(() => {
    if (!isChildMode) return liveChannels;
    return liveChannels.filter((item) => {
      const category = item.groupTitle ? item.groupTitle.trim() : 'General';
      return !isRestrictedCategory(category);
    });
  }, [liveChannels, isChildMode]);

  // تصفية محتوى VOD للأطفال
  const filteredVodItems = useMemo(() => {
    if (!isChildMode) return vodItems;
    return vodItems.filter((item) => {
      const category = item.groupTitle ? item.groupTitle.trim() : 'General';
      return !isRestrictedCategory(category);
    });
  }, [vodItems, isChildMode]);

  // تصنيفات قنوات التلفزيون فقط (استبعاد أي تصنيف خاص بـ VOD)
  const categories = useMemo(() => {
    const allCategories = groupChannelsByCategory(filteredLiveChannels);
    return allCategories.filter(
      (cat) => cat.name !== 'أفلام عالمية' && cat.name !== 'أفلام رائجة'
    );
  }, [filteredLiveChannels]);

  // دول قنوات التلفزيون فقط (استبعاد أفلام عالمية)
  const countries = useMemo(() => {
    const allCountries = groupChannelsByCountry(filteredLiveChannels);
    return allCountries.filter((c) => c.name !== 'أفلام عالمية');
  }, [filteredLiveChannels]);

  const [networkDefinitions, setNetworkDefinitions] = useState<ChannelNetwork[]>(DEFAULT_NETWORKS);

  useEffect(() => {
    let isMounted = true;
    fetchNetworks().then((loaded) => {
      if (isMounted && loaded && loaded.length > 0) {
        setNetworkDefinitions(loaded);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // تجميع قنوات التلفزيون حسب سلاسل وشبكات القنوات
  const networks = useMemo(() => {
    return groupChannelsByNetwork(filteredLiveChannels, networkDefinitions);
  }, [filteredLiveChannels, networkDefinitions]);

  return {
    ...query,
    playlistUrl,
    categories,
    countries,
    networks,
    channels: filteredLiveChannels,
    totalChannels: filteredLiveChannels.length,
    vodItems: filteredVodItems,
    movies: filteredVodItems,
    totalVod: filteredVodItems.length,
    isChildMode,
  };
}
