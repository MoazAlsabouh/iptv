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
          {/* البوستر العمودي مع التدرج الداكن */}
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

            {/* شارة رقم وموعد الحلقة (لجدول الحلقات) */}
            {item.episodeInfo ? (
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
              <Text style={styles.metaSources}>
                {item.type === 'tv' ? 'عرض الحلقات' : `${item.sources?.length || 0} سيرفرات`}
              </Text>
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
          data={items}
          keyExtractor={(item) => `${item.id}-${item.episodeInfo || ''}`}
          numColumns={4}
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
    height: 330,
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
    flex: 1,
  },
  posterContainer: {
    width: '100%',
    height: 235,
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
    flex: 1,
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
});
