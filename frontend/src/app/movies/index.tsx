import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { ChannelLogo } from '../../components/ChannelLogo';

const BACKEND_BASE_URL = 'https://iptv-backend.moaznsm.workers.dev';

export interface VodSource {
  label: string;
  url: string;
}

export interface VodItem {
  id: string;
  tmdbId?: number;
  imdbId?: string;
  title: string;
  type: 'movie' | 'tv';
  poster: string;
  backdrop?: string;
  rating: number;
  year: string;
  overview: string;
  category: string;
  episodeInfo?: string;
  releaseDate?: string;
  isUnreleased?: boolean;
  originalLanguage?: string;
  sources: VodSource[];
}

type MainTabType = 'all' | 'movie' | 'tv';

interface SubCategory {
  id: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const SUB_CATEGORIES: SubCategory[] = [
  { id: 'trending', title: 'الرائج', icon: 'whatshot' },
  { id: 'tv_schedule', title: 'جدول الحلقات اليوم', icon: 'schedule' },
  { id: 'arabic_movies', title: 'أفلام عربية', icon: 'local-movies' },
  { id: 'arabic_series', title: 'مسلسلات عربية', icon: 'tv' },
  { id: 'action', title: 'أكشن', icon: 'flash-on' },
  { id: 'drama', title: 'دراما', icon: 'theater-comedy' },
  { id: 'comedy', title: 'كوميديا', icon: 'sentiment-very-satisfied' },
  { id: 'horror', title: 'رعب', icon: 'warning' },
  { id: 'scifi', title: 'خيال علمي', icon: 'rocket' },
  { id: 'animation', title: 'أنمي', icon: 'animation' },
];

interface VodCardProps {
  item: VodItem;
  onSelect: (item: VodItem) => void;
  index: number;
}

const VodCard: React.FC<VodCardProps> = ({ item, onSelect, index }) => {
  const [imageError, setImageError] = useState<boolean>(false);

  return (
    <Pressable
      hasTVPreferredFocus={index === 0}
      onPress={() => onSelect(item)}
      style={({ focused }) => [styles.card, focused && styles.cardFocused]}
    >
      {({ focused }) => (
        <View style={styles.cardInner}>
          {/* البوستر العمودي بنسبة قياسية 2:3 تمنع القص تماماً */}
          <View style={styles.posterContainer}>
            {item.poster && !imageError ? (
              <Image
                source={{ uri: item.poster }}
                style={styles.posterImage}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <View style={styles.fallbackPoster}>
                <ChannelLogo uri="" name={item.title} size={64} focused={focused} />
              </View>
            )}

            {/* تدرج لوني داكن خفيف من الأسفل لإبراز التفاصيل */}
            <View style={styles.posterGradientOverlay} />

            {/* شارات الرأس (التقييم ونوع العمل) */}
            <View style={styles.topBadgesRow}>
              <View style={[styles.typeBadge, item.type === 'tv' && styles.typeBadgeTv]}>
                <Text style={styles.typeBadgeText}>
                  {item.type === 'tv' ? 'مسلسل' : 'فيلم'}
                </Text>
              </View>

              {item.rating > 0 ? (
                <View style={styles.ratingBadge}>
                  <MaterialIcons name="star" size={13} color="#eab308" />
                  <Text style={styles.ratingBadgeText}>{item.rating}</Text>
                </View>
              ) : null}
            </View>

            {/* شارة العمل الذي لم يصدر بعد، أو شارة الحلقة المجدولة */}
            {item.isUnreleased ? (
              <View style={styles.unreleasedBadge}>
                <MaterialIcons name="alarm" size={12} color="#ffffff" />
                <Text numberOfLines={1} style={styles.unreleasedBadgeText}>
                  قريباً • غير متاح بعد
                </Text>
              </View>
            ) : item.episodeInfo ? (
              <View style={styles.episodeBadge}>
                <Text numberOfLines={1} style={styles.episodeBadgeText}>
                  {item.episodeInfo}
                </Text>
              </View>
            ) : null}
          </View>

          {/* تفاصيل العمل أسفل البوستر */}
          <View style={styles.metaContainer}>
            <Text
              numberOfLines={2}
              style={[styles.itemTitle, focused && styles.itemTitleFocused]}
            >
              {item.title}
            </Text>

            <View style={styles.subMetaRow}>
              {item.year ? <Text style={styles.metaYear}>{item.year}</Text> : null}
              {item.isUnreleased ? (
                <View style={styles.unreleasedDateRow}>
                  <MaterialIcons name="event" size={13} color="#f97316" />
                  <Text numberOfLines={1} style={styles.metaUnreleasedDate}>
                    {item.releaseDate ? `الإصدار: ${item.releaseDate}` : 'قريباً'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.metaSources}>
                  {item.type === 'tv' ? 'عرض الحلقات' : `${item.sources?.length || 0} سيرفرات`}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
};

/**
 * شاشة استعراض الأفلام والمسلسلات VOD الموسعة عبر TMDB + TVmaze.
 * تدعم شريط البحث اللحظي، شريط تصنيفات Glassmorphic، والتوجيه الذكي للمسلسلات.
 */
export default function MoviesScreen(): React.JSX.Element {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // ضبط عدد الأعمدة بمرونة ليصبح 5 على الشاشات العريضة/التلفاز و 6 على الشاشات الكبيرة
  const numColumns = useMemo(() => {
    if (width >= 1600) return 6;
    if (width >= 1050) return 5;
    if (width >= 750) return 4;
    if (width >= 480) return 3;
    return 2;
  }, [width]);

  const [mainTab, setMainTab] = useState<MainTabType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('trending');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');

  const [items, setItems] = useState<VodItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);

  // حالة النافذة التنبيهية للأعمال التي لم تصدر بعد
  const [unreleasedNotice, setUnreleasedNotice] = useState<{
    visible: boolean;
    title: string;
    releaseDate?: string;
  } | null>(null);

  // Debounce للبحث 500ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // إعادة ضبط الصفحة إلى 1 عند تغيير التبويب أو التصنيف أو نص البحث
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [mainTab, selectedCategory, debouncedQuery]);

  // جلب البيانات من الخادم السحابي
  const fetchCatalogData = useCallback(async () => {
    const isFirstPage = page === 1;
    if (isFirstPage) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setIsError(false);

    try {
      let endpoint = '';
      if (debouncedQuery.length > 0) {
        endpoint = `${BACKEND_BASE_URL}/api/vod/search?q=${encodeURIComponent(debouncedQuery)}&page=${page}`;
      } else {
        endpoint = `${BACKEND_BASE_URL}/api/vod/catalog?type=${mainTab}&category=${selectedCategory}&page=${page}`;
      }

      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`خطأ في جلب البيانات: ${res.status}`);
      }

      const data = await res.json();
      const newResults: VodItem[] = data.results || [];

      setTotalPages(data.totalPages || 1);
      setItems((prev) => (isFirstPage ? newResults : [...prev, ...newResults]));
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [debouncedQuery, mainTab, selectedCategory, page]);

  useEffect(() => {
    fetchCatalogData();
  }, [fetchCatalogData]);

  const handleGoBack = () => {
    if (unreleasedNotice?.visible) {
      setUnreleasedNotice(null);
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  useTVRemoteNavigation({
    onBack: handleGoBack,
  });

  const handleSelect = (item: VodItem) => {
    // التحقق أولاً إن كان العمل لم يصدر بعد
    if (item.isUnreleased) {
      setUnreleasedNotice({
        visible: true,
        title: item.title,
        releaseDate: item.releaseDate,
      });
      return;
    }

    const detectedLang =
      item.originalLanguage || (item.category?.includes('عربي') ? 'ar' : 'en');

    if (item.type === 'tv') {
      // توجيه المسلسل لشاشة تفاصيل واختيار الحلقات
      router.push({
        pathname: '/movies/series',
        params: {
          id: item.id,
          title: item.title,
          poster: item.poster,
          backdrop: item.backdrop || '',
          rating: String(item.rating || 0),
          year: item.year || '',
          overview: item.overview || '',
          category: item.category || 'مسلسل',
          tmdbId: item.tmdbId ? String(item.tmdbId) : undefined,
          imdbId: item.imdbId,
          originalLanguage: detectedLang,
        },
      });
    } else {
      // تشغيل الفيلم مباشرة
      const initialUrl = item.sources && item.sources.length > 0 ? item.sources[0].url : '';
      router.push({
        pathname: '/play/[id]',
        params: {
          id: item.id,
          title: item.title,
          url: initialUrl,
          logo: item.poster,
          sources: JSON.stringify(item.sources),
          type: item.type,
          tmdbId: item.tmdbId ? String(item.tmdbId) : undefined,
          imdbId: item.imdbId,
          lang: detectedLang,
        },
      });
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && page < totalPages) {
      setPage((prev) => prev + 1);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. الشريط العلوي: العنوان وعناصر التحكم */}
      <View style={styles.topHeader}>
        <View style={styles.titleArea}>
          <Text style={styles.pageTitle}>الأفلام والمسلسلات</Text>
          <Text style={styles.pageSubtitle}>
            كتالوج الترفيه العربي والعالمي الشامل
          </Text>
        </View>

        {/* أدوات الرأس: Segmented Control + مربع البحث */}
        <View style={styles.headerControls}>
          {/* Segmented Control للنوع (الكل • أفلام • مسلسلات) */}
          {debouncedQuery.length === 0 && (
            <View style={styles.segmentedControl}>
              <Pressable
                onPress={() => setMainTab('all')}
                style={({ focused }) => [
                  styles.segmentBtn,
                  mainTab === 'all' && styles.segmentBtnActive,
                  focused && styles.segmentBtnFocused,
                ]}
              >
                {({ focused }) => (
                  <Text
                    style={[
                      styles.segmentText,
                      mainTab === 'all' && styles.segmentTextActive,
                      focused && styles.focusedTextDark,
                    ]}
                  >
                    الكل
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setMainTab('movie')}
                style={({ focused }) => [
                  styles.segmentBtn,
                  mainTab === 'movie' && styles.segmentBtnActive,
                  focused && styles.segmentBtnFocused,
                ]}
              >
                {({ focused }) => (
                  <Text
                    style={[
                      styles.segmentText,
                      mainTab === 'movie' && styles.segmentTextActive,
                      focused && styles.focusedTextDark,
                    ]}
                  >
                    أفلام
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setMainTab('tv')}
                style={({ focused }) => [
                  styles.segmentBtn,
                  mainTab === 'tv' && styles.segmentBtnActive,
                  focused && styles.segmentBtnFocused,
                ]}
              >
                {({ focused }) => (
                  <Text
                    style={[
                      styles.segmentText,
                      mainTab === 'tv' && styles.segmentTextActive,
                      focused && styles.focusedTextDark,
                    ]}
                  >
                    مسلسلات
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {/* حقل البحث الذكي */}
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color="#94a3b8" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="ابحث عن أي عمل ترفيهي..."
              placeholderTextColor="#64748b"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                <MaterialIcons name="close" size={18} color="#94a3b8" />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* 2. شريط التصنيفات العصري بنمط Glassmorphic */}
      {debouncedQuery.length === 0 && (
        <View style={styles.categoriesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {SUB_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={({ focused }) => [
                    styles.glassChip,
                    isActive && styles.glassChipActive,
                    focused && styles.glassChipFocused,
                  ]}
                >
                  {({ focused }) => (
                    <View style={styles.glassChipContent}>
                      <MaterialIcons
                        name={cat.icon}
                        size={16}
                        color={focused ? '#000000' : isActive ? '#ffffff' : '#38bdf8'}
                      />
                      <Text
                        style={[
                          styles.glassChipText,
                          isActive && styles.glassChipTextActive,
                          focused && styles.focusedTextDark,
                        ]}
                      >
                        {cat.title}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 3. شبكة المحتوى أو حالات التحميل/الخطأ */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>جاري استعراض الكتالوج السينمائي...</Text>
        </View>
      ) : isError ? (
        <View style={styles.centerBox}>
          <MaterialIcons name="error-outline" size={60} color="#ef4444" />
          <Text style={styles.errorTitle}>تعذر الاتصال بالخادم</Text>
          <Text style={styles.errorSub}>يرجى التحقق من اتصال الإنترنت ثم إعادة المحاولة</Text>
          <Pressable
            hasTVPreferredFocus
            onPress={() => fetchCatalogData()}
            style={({ focused }) => [styles.retryBtn, focused && styles.glassChipFocused]}
          >
            <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centerBox}>
          <MaterialIcons name="local-movies" size={64} color="#475569" />
          <Text style={styles.emptyTitle}>
            {debouncedQuery.length > 0
              ? `لم يتم العثور على نتائج للبحث عن "${debouncedQuery}"`
              : 'لا يتوفر محتوى حالياً في هذا القسم'}
          </Text>
          <Text style={styles.emptySub}>
            {debouncedQuery.length > 0
              ? 'تأكد من كتابة الاسم بشكل صحيح أو جرب كلمات أخرى'
              : 'سيتم إضافة المزيد من الأعمال الترفيهية قريباً'}
          </Text>
        </View>
      ) : (
        <FlatList<VodItem>
          key={`vod-grid-${numColumns}`}
          data={items}
          keyExtractor={(item) => `${item.id}-${item.episodeInfo || ''}`}
          numColumns={numColumns}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={styles.gridCol}>
              <VodCard item={item} onSelect={handleSelect} index={index} />
            </View>
          )}
          ListFooterComponent={
            page < totalPages ? (
              <View style={styles.footerLoader}>
                <Pressable
                  onPress={handleLoadMore}
                  disabled={isLoadingMore}
                  style={({ focused }) => [
                    styles.loadMoreBtn,
                    focused && styles.loadMoreBtnFocused,
                  ]}
                >
                  {isLoadingMore ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={styles.btnRow}>
                      <MaterialIcons name="expand-more" size={22} color="#ffffff" />
                      <Text style={styles.loadMoreText}>تحميل المزيد من الأعمال</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={styles.footerEnd}>
                <Text style={styles.footerEndText}>تم عرض جميع النتائج المتاحة</Text>
              </View>
            )
          }
        />
      )}

      {/* 4. نافذة تنبيه فاخرة للأعمال التي لم تصدر بعد */}
      {unreleasedNotice?.visible && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconCircle}>
              <MaterialIcons name="schedule" size={36} color="#f97316" />
            </View>

            <Text style={styles.modalTitle}>هذا العمل لم يصدر بعد</Text>

            <Text style={styles.modalItemName} numberOfLines={2}>
              {unreleasedNotice.title}
            </Text>

            <View style={styles.modalDateBadge}>
              <MaterialIcons name="event" size={16} color="#f97316" />
              <Text style={styles.modalDateText}>
                تاريخ الإصدار المتوقع: {unreleasedNotice.releaseDate || 'قريباً'}
              </Text>
            </View>

            <Text style={styles.modalDesc}>
              هذا العمل لا يزال قيد الإنتاج أو في صالات العرض السينمائي ولم يتم طرحه على منصات البث الرقمي بعد. سيتم توفيره فور صدوره رسمياً.
            </Text>

            <Pressable
              hasTVPreferredFocus
              onPress={() => setUnreleasedNotice(null)}
              style={({ focused }) => [
                styles.modalCloseBtn,
                focused && styles.modalCloseBtnFocused,
              ]}
            >
              {({ focused }) => (
                <Text
                  style={[
                    styles.modalCloseBtnText,
                    focused && styles.focusedTextDark,
                  ]}
                >
                  حسناً، فهمت
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 16,
  },
  titleArea: {
    minWidth: 220,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 4,
  },
  segmentBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  segmentBtnActive: {
    backgroundColor: '#0284c7',
  },
  segmentBtnFocused: {
    backgroundColor: '#ffffff',
    transform: [{ scale: 1.05 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  segmentText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    width: 260,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
    textAlign: 'right',
  },
  clearBtn: {
    padding: 2,
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoriesScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  glassChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  glassChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  glassChipFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  glassChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  glassChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  glassChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  focusedTextDark: {
    color: '#000000',
    fontWeight: '900',
  },
  gridContent: {
    paddingBottom: 40,
  },
  gridCol: {
    flex: 1,
    padding: 8,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  cardFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.05 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 14,
  },
  cardInner: {
    width: '100%',
  },
  posterContainer: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: '#0b1120',
    position: 'relative',
    overflow: 'hidden',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  fallbackPoster: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  posterGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.4) 60%, transparent 100%)',
        }
      : {
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
        }),
  },
  topBadgesRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  typeBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeTv: {
    backgroundColor: 'rgba(124, 58, 237, 0.85)',
  },
  typeBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  ratingBadgeText: {
    color: '#eab308',
    fontSize: 11,
    fontWeight: '800',
  },
  unreleasedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(234, 88, 12, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  unreleasedBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  episodeBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(5, 150, 105, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 2,
  },
  episodeBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  metaContainer: {
    padding: 10,
    justifyContent: 'space-between',
    minHeight: 68,
  },
  itemTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'right',
  },
  itemTitleFocused: {
    color: '#000000',
    fontWeight: '900',
  },
  subMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  metaYear: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  metaSources: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  unreleasedDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaUnreleasedDate: {
    color: '#f97316',
    fontSize: 11,
    fontWeight: '800',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 16,
  },
  errorSub: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySub: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  footerLoader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadMoreBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  loadMoreBtnFocused: {
    backgroundColor: '#ffffff',
    transform: [{ scale: 1.05 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  loadMoreText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerEnd: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerEndText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(249, 115, 22, 0.4)',
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  modalDateText: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '800',
  },
  modalDesc: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalCloseBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 12,
  },
  modalCloseBtnFocused: {
    backgroundColor: '#ffffff',
    transform: [{ scale: 1.05 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  modalCloseBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
