import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { fetchAndParseM3U } from '../utils/m3uParser';
import { MediaItem } from '../types/media';

/**
 * الكلمات المحظورة في وضع الرقابة الأبوية (Child Mode)
 */
const RESTRICTED_KEYWORDS: string[] = ['action', 'horror', 'adult', 'news', '18+', 'xxx'];

/**
 * فحص ما إذا كان التصنيف يحتوي على محتوى مقيد للأطفال
 */
function isRestrictedCategory(categoryName: string): boolean {
  const lower = categoryName.toLowerCase();
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
  'أفلام عالمية',
];

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

  const query = useQuery<MediaItem[], Error>({
    queryKey: ['playlistMedia', playlistUrl],
    queryFn: () => fetchAndParseM3U(playlistUrl, false),
    enabled: Boolean(playlistUrl && playlistUrl.trim().length > 0),
    staleTime: 1000 * 60 * 5, // 5 دقائق
    retry: 2,
  });

  // تصفية وتجميع القنوات حسب التصنيفات مع تطبيق معايير الرقابة الأبوية
  const categories = useMemo(() => {
    if (!query.data) {
      return [];
    }
    const allCategories = groupChannelsByCategory(query.data);

    if (isChildMode) {
      return allCategories.filter((cat) => !isRestrictedCategory(cat.name));
    }

    return allCategories;
  }, [query.data, isChildMode]);

  // تصفية وتجميع القنوات حسب الدول
  const countries = useMemo(() => {
    if (!query.data) {
      return [];
    }
    return groupChannelsByCountry(query.data);
  }, [query.data]);

  // تصفية القنوات الفردية لضمان عدم ظهورها في شاشات الاستعراض المباشر عند تفعيل وضع الطفل
  const filteredChannels = useMemo(() => {
    if (!query.data) return [];
    if (!isChildMode) return query.data;

    return query.data.filter((item) => {
      const category = item.groupTitle ? item.groupTitle.trim() : 'General';
      return !isRestrictedCategory(category);
    });
  }, [query.data, isChildMode]);

  return {
    ...query,
    playlistUrl,
    categories,
    countries,
    channels: filteredChannels,
    totalChannels: filteredChannels.length,
    isChildMode,
  };
}
