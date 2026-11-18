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
 * بنية تمثل تصنيف قنوات مجمعة مع عدد القنوات وعينة من الشعار
 */
export interface CategoryGroup {
  name: string;
  count: number;
  channels: MediaItem[];
  sampleLogo?: string;
}

/**
 * دالة مساعدة لتجميع القنوات حسب التصنيف (groupTitle) بكفاءة عالية
 *
 * @param channels قائمة القنوات المستخرجة
 * @returns مصفوفة من التصنيفات الفريدة مع تفاصيل القنوات التابعة لكل تصنيف
 */
export function groupChannelsByCategory(channels: MediaItem[]): CategoryGroup[] {
  if (!channels || channels.length === 0) {
    return [];
  }

  const map = new Map<string, MediaItem[]>();

  for (let i = 0; i < channels.length; i++) {
    const item = channels[i];
    const category = item.groupTitle ? item.groupTitle.trim() : 'General';
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
 * Hook مخصص لإدارة جلب وتحليل بيانات الوسائط وحفظها مؤقتاً بواسطة React Query.
 * يتصل مباشرة بالرابط (بدون بروكسي خارجي) لأن خادمنا السحابي يدعم CORS مباشرة.
 */
export function useMediaData() {
  const playlistUrl = useAppStore((state) => state.playlistUrl);
  const isChildMode = useAppStore((state) => state.isChildMode);

  const query = useQuery<MediaItem[], Error>({
    queryKey: ['playlistMedia', playlistUrl],
    queryFn: () => fetchAndParseM3U(playlistUrl, false), // اتصال مباشر بدون بروكسي لتفادي خطأ 522
    enabled: Boolean(playlistUrl && playlistUrl.trim().length > 0),
    staleTime: 1000 * 60 * 30, // 30 دقيقة
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
    channels: filteredChannels,
    totalChannels: filteredChannels.length,
    isChildMode,
  };
}
