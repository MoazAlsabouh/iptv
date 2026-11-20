import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { ChannelLogo } from '../../components/ChannelLogo';
import { useAppStore } from '../../store/useAppStore';

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

export interface CategoryDef {
  id: string;
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  bgColor: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'all',
    title: 'الكل',
    icon: 'apps',
    iconColor: '#0EA5E9',
    bgColor: 'rgba(14, 165, 233, 0.15)',
  },
  {
    id: 'arabic_movies',
    title: 'أفلام عربية',
    icon: 'local-movies',
    iconColor: '#F43F5E',
    bgColor: 'rgba(244, 63, 94, 0.15)',
  },
  {
    id: 'arabic_series',
    title: 'مسلسلات عربية',
    icon: 'tv',
    iconColor: '#A855F7',
    bgColor: 'rgba(168, 85, 247, 0.15)',
  },
  {
    id: 'foreign_movies',
    title: 'أفلام أجنبية',
    icon: 'movie-filter',
    iconColor: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
  },
  {
    id: 'foreign_series',
    title: 'مسلسلات أجنبية',
    icon: 'live-tv',
    iconColor: '#38BDF8',
    bgColor: 'rgba(56, 189, 248, 0.15)',
  },
  {
    id: 'favorites',
    title: 'المفضلة ★',
    icon: 'star',
    iconColor: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
  },
];

interface VodCardProps {
  item: VodItem;
  onSelect: (item: VodItem) => void;
  isFav: boolean;
  onToggleFav: (item: VodItem) => void;
  width?: number;
  hasTVPreferredFocus?: boolean;
}

const VodCard: React.FC<VodCardProps> = ({
  item,
  onSelect,
  isFav,
  onToggleFav,
  width,
  hasTVPreferredFocus,
}) => {
  const [imageError, setImageError] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const isActive = isHovered || isFocused;

  return (
    <Pressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={() => onSelect(item)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      {...(Platform.OS === 'web'
        ? ({
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
          } as any)
        : {})}
      style={[
        styles.cardContainer,
        width ? { width } : styles.cardFixedRailWidth,
        Platform.OS === 'web'
          ? ({
              cursor: 'pointer',
              transition:
                'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.22s ease, border-color 0.22s ease',
            } as any)
          : undefined,
      ]}
    >
      {({ focused }: any) => {
        const effectiveActive = isActive || focused;
        return (
          <View style={styles.cardInner}>
            {/* إطار البوستر العمودي بنسبة قياسية 2:3 مع زوايا دائرية 14 */}
            <View
              style={[
                styles.posterBox,
                effectiveActive && styles.posterBoxFocused,
              ]}
            >
              {item.poster && !imageError ? (
                <Image
                  source={{ uri: item.poster }}
                  style={styles.posterImg}
                  resizeMode="cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <View style={styles.fallbackPoster}>
                  <ChannelLogo uri="" name={item.title} size={54} focused={effectiveActive} />
                </View>
              )}

              {/* تدرج داكن خفيف أسفل البوستر */}
              <View style={styles.posterBottomGradient} />

              {/* شارات الرأس العلوية: التقييم + زر المفضلة */}
              <View style={styles.posterTopBadges}>
                {/* التقييم */}
                <View style={styles.ratingBadge}>
                  <MaterialIcons name="star" size={13} color="#F59E0B" />
                  <Text style={styles.ratingBadgeText}>
                    {item.rating > 0 ? item.rating.toFixed(1) : 'جديد'}
                  </Text>
                </View>

                {/* زر المفضلة الأنيق بالزاوية */}
                <Pressable
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    onToggleFav(item);
                  }}
                  style={[
                    styles.favBtn,
                    isFav && styles.favBtnActive,
                  ]}
                  {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                >
                  <MaterialIcons
                    name={isFav ? 'favorite' : 'favorite-border'}
                    size={16}
                    color={isFav ? '#EF4444' : '#FFFFFF'}
                  />
                </Pressable>
              </View>

              {/* شارة أسفل البوستر: نوع العمل أو موعد قريباً */}
              <View style={styles.posterBottomBadges}>
                {item.isUnreleased ? (
                  <View style={styles.unreleasedBadge}>
                    <MaterialIcons name="alarm" size={11} color="#FFFFFF" />
                    <Text numberOfLines={1} style={styles.unreleasedBadgeText}>
                      قريباً
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.typeBadge,
                      item.type === 'tv' ? styles.typeBadgeTv : styles.typeBadgeMovie,
                    ]}
                  >
                    <Text style={styles.typeBadgeText}>
                      {item.type === 'tv' ? 'مسلسل' : 'فيلم'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* تفاصيل العمل النصية أسفل البوستر */}
            <View style={styles.metaBox}>
              <Text
                numberOfLines={1}
                style={[
                  styles.cardTitle,
                  effectiveActive && styles.cardTitleActive,
                ]}
              >
                {item.title}
              </Text>

              <View style={styles.subMetaRow}>
                {item.year ? <Text style={styles.metaYear}>{item.year}</Text> : null}
                <Text style={styles.metaHint}>
                  {item.type === 'tv' ? 'عرض الحلقات' : 'مشاهدة الآن'}
                </Text>
              </View>
            </View>
          </View>
        );
      }}
    </Pressable>
  );
};

export default function MoviesScreen(): React.JSX.Element {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // حساب الأعمدة ديناميكياً للشبكة
  const numColumns = useMemo(() => {
    if (width >= 1600) return 6;
    if (width >= 1150) return 5;
    if (width >= 800) return 4;
    if (width >= 520) return 3;
    return 2;
  }, [width]);

  // حساب عرض البطاقة في وضع الشبكة
  const gridCardWidth = useMemo(() => {
    const horizontalPadding = 48;
    const gapTotal = (numColumns - 1) * 16;
    const availableWidth = Math.max(300, width - horizontalPadding);
    return Math.floor((availableWidth - gapTotal) / numColumns);
  }, [width, numColumns]);

  // التصنيف المختار
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // البحث
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const searchInputRef = useRef<TextInput>(null);

  // المفضلة من المتجر العام
  const { favoriteIds, vodFavorites, toggleFavorite } = useAppStore();

  // بيانات الصفوف الأفقية (Rails)
  const [railTrending, setRailTrending] = useState<VodItem[]>([]);
  const [railArabic, setRailArabic] = useState<VodItem[]>([]);
  const [railLatest, setRailLatest] = useState<VodItem[]>([]);
  const [isRailsLoading, setIsRailsLoading] = useState<boolean>(true);
  const [isRailsError, setIsRailsError] = useState<boolean>(false);

  // بيانات وضع الشبكة (Grid View)
  const [gridItems, setGridItems] = useState<VodItem[]>([]);
  const [gridPage, setGridPage] = useState<number>(1);
  const [gridTotalPages, setGridTotalPages] = useState<number>(1);
  const [isGridLoading, setIsGridLoading] = useState<boolean>(false);
  const [isGridLoadingMore, setIsGridLoadingMore] = useState<boolean>(false);
  const [isGridError, setIsGridError] = useState<boolean>(false);

  // نافذة تنبيه الأعمال التي لم تصدر بعد
  const [unreleasedNotice, setUnreleasedNotice] = useState<{
    visible: boolean;
    title: string;
    releaseDate?: string;
  } | null>(null);

  // تأخير إرسال استعلام البحث 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // جلب بيانات الصفوف الأفقية الرئيسية عند البدء
  const fetchRailsData = useCallback(async () => {
    setIsRailsLoading(true);
    setIsRailsError(false);
    try {
      const [trendRes, arMovieRes, arSeriesRes, latestRes] = await Promise.allSettled([
        fetch(`${BACKEND_BASE_URL}/api/vod/catalog?type=all&category=trending&page=1`),
        fetch(`${BACKEND_BASE_URL}/api/vod/catalog?type=all&category=arabic_movies&page=1`),
        fetch(`${BACKEND_BASE_URL}/api/vod/catalog?type=all&category=arabic_series&page=1`),
        fetch(`${BACKEND_BASE_URL}/api/vod/catalog?type=movie&category=trending&page=2`),
      ]);

      if (trendRes.status === 'fulfilled' && trendRes.value.ok) {
        const data = await trendRes.value.json();
        setRailTrending(data.results || []);
      }

      // دمج الأفلام والمسلسلات العربية لصف عربي غني ومتنوع
      const arMovies: VodItem[] =
        arMovieRes.status === 'fulfilled' && arMovieRes.value.ok
          ? (await arMovieRes.value.json()).results || []
          : [];
      const arSeries: VodItem[] =
        arSeriesRes.status === 'fulfilled' && arSeriesRes.value.ok
          ? (await arSeriesRes.value.json()).results || []
          : [];

      const combinedArabic: VodItem[] = [];
      const maxLen = Math.max(arMovies.length, arSeries.length);
      for (let i = 0; i < maxLen; i++) {
        if (arMovies[i]) combinedArabic.push(arMovies[i]);
        if (arSeries[i]) combinedArabic.push(arSeries[i]);
      }
      setRailArabic(combinedArabic);

      if (latestRes.status === 'fulfilled' && latestRes.value.ok) {
        const data = await latestRes.value.json();
        setRailLatest(data.results || []);
      }
    } catch {
      setIsRailsError(true);
    } finally {
      setIsRailsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRailsData();
  }, [fetchRailsData]);

  // جلب بيانات الشبكة عند اختيار تصنيف معين أو إدخال بحث
  const fetchGridData = useCallback(
    async (pageToLoad: number, append: boolean = false) => {
      if (selectedCategory === 'all' && debouncedQuery.length === 0) {
        return;
      }

      if (selectedCategory === 'favorites' && debouncedQuery.length === 0) {
        setIsGridLoading(false);
        setIsGridLoadingMore(false);
        return;
      }

      if (append) {
        setIsGridLoadingMore(true);
      } else {
        setIsGridLoading(true);
      }
      setIsGridError(false);

      try {
        let endpoint = '';
        if (debouncedQuery.length > 0) {
          endpoint = `${BACKEND_BASE_URL}/api/vod/search?q=${encodeURIComponent(
            debouncedQuery
          )}&page=${pageToLoad}`;
        } else if (selectedCategory === 'arabic_movies') {
          endpoint = `${BACKEND_BASE_URL}/api/vod/catalog?type=all&category=arabic_movies&page=${pageToLoad}`;
        } else if (selectedCategory === 'arabic_series') {
          endpoint = `${BACKEND_BASE_URL}/api/vod/catalog?type=all&category=arabic_series&page=${pageToLoad}`;
        } else if (selectedCategory === 'foreign_movies') {
          endpoint = `${BACKEND_BASE_URL}/api/vod/catalog?type=movie&category=trending&page=${pageToLoad}`;
        } else if (selectedCategory === 'foreign_series') {
          endpoint = `${BACKEND_BASE_URL}/api/vod/catalog?type=tv&category=trending&page=${pageToLoad}`;
        }

        if (!endpoint) return;

        const res = await fetch(endpoint, {
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          throw new Error('فشل جلب قائمة المحتوى');
        }

        const data = await res.json();
        const results: VodItem[] = data.results || [];
        setGridTotalPages(data.totalPages || 1);
        setGridItems((prev) => (append ? [...prev, ...results] : results));
      } catch {
        setIsGridError(true);
      } finally {
        setIsGridLoading(false);
        setIsGridLoadingMore(false);
      }
    },
    [selectedCategory, debouncedQuery]
  );

  // إعادة ضبط وتحميل عند تغيير التصنيف أو البحث
  useEffect(() => {
    setGridPage(1);
    if (selectedCategory !== 'all' || debouncedQuery.length > 0) {
      fetchGridData(1, false);
    }
  }, [selectedCategory, debouncedQuery, fetchGridData]);

  // العناصر المعروضة في وضع الشبكة (مع دعم الفلترة السريعة للمفضلة)
  const displayedGridItems: VodItem[] = useMemo(() => {
    if (selectedCategory === 'favorites' && debouncedQuery.length === 0) {
      return (vodFavorites || []) as VodItem[];
    }
    return gridItems;
  }, [selectedCategory, debouncedQuery, vodFavorites, gridItems]);

  const handleLoadMoreGrid = () => {
    if (!isGridLoadingMore && gridPage < gridTotalPages) {
      const nextPage = gridPage + 1;
      setGridPage(nextPage);
      fetchGridData(nextPage, true);
    }
  };

  // التنقل والريموت
  const handleGoBack = () => {
    if (unreleasedNotice?.visible) {
      setUnreleasedNotice(null);
      return;
    }
    if (isSearchOpen && searchQuery.length > 0) {
      setSearchQuery('');
      setIsSearchOpen(false);
      return;
    }
    if (selectedCategory !== 'all') {
      setSelectedCategory('all');
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  useTVRemoteNavigation({
    onBack: handleGoBack,
  });

  // فتح الفيلم أو المسلسل
  const handleSelect = (item: VodItem) => {
    if (item.isUnreleased) {
      setUnreleasedNotice({
        visible: true,
        title: item.title,
        releaseDate: item.releaseDate,
      });
      return;
    }

    const isExplicitArabic =
      item.originalLanguage === 'ar' ||
      item.category === 'arabic_movies' ||
      item.category === 'arabic_series';
    const detectedLang = isExplicitArabic ? 'ar' : item.originalLanguage || 'en';

    if (item.type === 'tv') {
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
          lang: detectedLang,
        },
      });
    } else {
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
          originalLanguage: detectedLang,
        },
      });
    }
  };

  // تبديل حالة المفضلة
  const handleToggleFav = (item: VodItem) => {
    toggleFavorite(item);
  };

  // هل نحن في وضع الصفوف الأفقية الافتراضي؟
  const isRailsView = selectedCategory === 'all' && debouncedQuery.length === 0;

  return (
    <View style={styles.container}>
      {/* 1. الشريط العلوي البسيط (Minimal Top Bar) */}
      <View style={styles.topBar}>
        {/* عنوان وقسم السينما */}
        <View style={styles.titleArea}>
          <View style={styles.titleIconBadge}>
            <MaterialIcons name="local-movies" size={22} color="#0EA5E9" />
          </View>
          <View>
            <Text style={styles.pageTitle}>الأفلام والمسلسلات</Text>
            <Text style={styles.pageSubtitle}>تلفازي سينما • كتالوج الترفيه الذكي</Text>
          </View>
        </View>

        {/* أدوات البحث والمفضلة الدائرية في الرأس */}
        <View style={styles.headerActions}>
          {/* مربع البحث الموسع أو الزر الدائري */}
          {isSearchOpen ? (
            <View style={styles.searchExpandedBox}>
              <MaterialIcons name="search" size={20} color="#0EA5E9" />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="ابحث عن فيلم أو مسلسل..."
                placeholderTextColor="#64748B"
                style={styles.searchInput}
                autoFocus
                returnKeyType="search"
              />
              <Pressable
                onPress={() => {
                  if (searchQuery.length > 0) {
                    setSearchQuery('');
                  } else {
                    setIsSearchOpen(false);
                  }
                }}
                style={styles.searchCloseBtn}
                {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
              >
                <MaterialIcons name="close" size={18} color="#94A3B8" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }}
              style={({ focused }: any) => [
                styles.iconCircleBtn,
                focused && styles.iconCircleBtnFocused,
              ]}
              {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
            >
              <MaterialIcons name="search" size={20} color="#FFFFFF" />
            </Pressable>
          )}

          {/* زر سريع للمفضلة */}
          <Pressable
            onPress={() => {
              setSelectedCategory((prev) => (prev === 'favorites' ? 'all' : 'favorites'));
            }}
            style={({ focused }: any) => [
              styles.iconCircleBtn,
              selectedCategory === 'favorites' && styles.iconCircleBtnGoldActive,
              focused && styles.iconCircleBtnFocused,
            ]}
            {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
          >
            <MaterialIcons
              name="star"
              size={20}
              color={selectedCategory === 'favorites' ? '#F59E0B' : '#FFFFFF'}
            />
          </Pressable>

          {/* زر إعادة التحميل */}
          <Pressable
            onPress={() => {
              if (isRailsView) {
                fetchRailsData();
              } else {
                fetchGridData(1, false);
              }
            }}
            style={({ focused }: any) => [
              styles.iconCircleBtn,
              focused && styles.iconCircleBtnFocused,
            ]}
            {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
          >
            <MaterialIcons name="refresh" size={20} color="#94A3B8" />
          </Pressable>
        </View>
      </View>

      {/* المحتوى الرئيسي القابل للتمرير */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ==================================================== */}
        {/* وضع الصفوف الأفقية الافتراضي (Horizontal Poster Rails) */}
        {/* ==================================================== */}
        {isRailsView ? (
          <>
            {isRailsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0EA5E9" />
                <Text style={styles.loadingText}>جاري تجهيز الكتالوج السينمائي...</Text>
              </View>
            ) : isRailsError ? (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={48} color="#EF4444" />
                <Text style={styles.errorTitle}>تعذر تحميل الأفلام والمسلسلات</Text>
                <Pressable
                  onPress={fetchRailsData}
                  style={styles.retryBtn}
                  {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                >
                  <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* 1. صف البوسترات الأول: المقترحة والأكثر مشاهدة */}
                {railTrending.length > 0 && (
                  <View style={styles.railSection}>
                    <View style={styles.railHeader}>
                      <View style={styles.railHeaderRight}>
                        <View style={[styles.railIndicator, { backgroundColor: '#F59E0B' }]} />
                        <View>
                          <Text style={styles.railTitle}>المقترحة والأكثر مشاهدة</Text>
                          <Text style={styles.railSubtitle}>
                            أقوى وأشهر الأعمال التي يتابعها الجميع الآن
                          </Text>
                        </View>
                      </View>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.railScrollContent}
                    >
                      {railTrending.map((item, idx) => (
                        <VodCard
                          key={`trend-${item.id}-${idx}`}
                          item={item}
                          onSelect={handleSelect}
                          isFav={favoriteIds.includes(item.id)}
                          onToggleFav={handleToggleFav}
                          hasTVPreferredFocus={idx === 0}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* 2. صف بطاقات التصنيفات الأفقية (Categories Cards Row) */}
                <View style={styles.categoriesSection}>
                  <View style={styles.categoriesSectionHeader}>
                    <View style={[styles.railIndicator, { backgroundColor: '#0EA5E9' }]} />
                    <Text style={styles.categoriesSectionTitle}>تصفح حسب التصنيف</Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoriesScrollContent}
                  >
                    {CATEGORIES.map((cat) => {
                      const isCatActive = selectedCategory === cat.id;
                      const isFavCat = cat.id === 'favorites';

                      return (
                        <Pressable
                          key={`cat-${cat.id}`}
                          onPress={() => setSelectedCategory(cat.id)}
                          style={({ focused }: any) => [
                            styles.categoryCard,
                            isCatActive &&
                              (isFavCat
                                ? styles.categoryCardFavActive
                                : styles.categoryCardActive),
                            focused && styles.categoryCardFocused,
                            Platform.OS === 'web'
                              ? ({
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                } as any)
                              : undefined,
                          ]}
                        >
                          <View
                            style={[
                              styles.categoryIconBox,
                              { backgroundColor: cat.bgColor },
                            ]}
                          >
                            <MaterialIcons
                              name={cat.icon}
                              size={20}
                              color={cat.iconColor}
                            />
                          </View>
                          <Text
                            style={[
                              styles.categoryTitle,
                              isCatActive &&
                                (isFavCat
                                  ? styles.categoryTitleFavActive
                                  : styles.categoryTitleActive),
                            ]}
                          >
                            {cat.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* 3. صف البوسترات الثاني: أفلام ومسلسلات عربية */}
                {railArabic.length > 0 && (
                  <View style={styles.railSection}>
                    <View style={styles.railHeader}>
                      <View style={styles.railHeaderRight}>
                        <View style={[styles.railIndicator, { backgroundColor: '#F43F5E' }]} />
                        <View>
                          <Text style={styles.railTitle}>أفلام ومسلسلات عربية</Text>
                          <Text style={styles.railSubtitle}>
                            أحدث وأفضل الإنتاجات والدراما السينمائية العربية
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => setSelectedCategory('arabic_movies')}
                        style={styles.viewAllBtn}
                        {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                      >
                        <Text style={styles.viewAllBtnText}>عرض المزيد</Text>
                        <MaterialIcons name="chevron-left" size={18} color="#0EA5E9" />
                      </Pressable>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.railScrollContent}
                    >
                      {railArabic.map((item, idx) => (
                        <VodCard
                          key={`arabic-${item.id}-${idx}`}
                          item={item}
                          onSelect={handleSelect}
                          isFav={favoriteIds.includes(item.id)}
                          onToggleFav={handleToggleFav}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* 4. صف البوسترات الثالث: أحدث الإضافات العالمية */}
                {railLatest.length > 0 && (
                  <View style={styles.railSection}>
                    <View style={styles.railHeader}>
                      <View style={styles.railHeaderRight}>
                        <View style={[styles.railIndicator, { backgroundColor: '#10B981' }]} />
                        <View>
                          <Text style={styles.railTitle}>أحدث الإضافات العالمية</Text>
                          <Text style={styles.railSubtitle}>
                            أحدث الأفلام والمسلسلات المختارة بعناية فائقة
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => setSelectedCategory('foreign_movies')}
                        style={styles.viewAllBtn}
                        {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                      >
                        <Text style={styles.viewAllBtnText}>عرض المزيد</Text>
                        <MaterialIcons name="chevron-left" size={18} color="#0EA5E9" />
                      </Pressable>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.railScrollContent}
                    >
                      {railLatest.map((item, idx) => (
                        <VodCard
                          key={`latest-${item.id}-${idx}`}
                          item={item}
                          onSelect={handleSelect}
                          isFav={favoriteIds.includes(item.id)}
                          onToggleFav={handleToggleFav}
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          /* ==================================================== */
          /* وضع الشبكة (Grid View) عند البحث أو اختيار تصنيف     */
          /* ==================================================== */
          <View style={styles.gridSection}>
            {/* شريط التصنيفات في أعلى الشبكة لسهولة التنقل والعودة */}
            <View style={styles.categoriesBarInGrid}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesScrollContent}
              >
                {CATEGORIES.map((cat) => {
                  const isCatActive = selectedCategory === cat.id;
                  const isFavCat = cat.id === 'favorites';

                  return (
                    <Pressable
                      key={`cat-grid-${cat.id}`}
                      onPress={() => {
                        setSearchQuery('');
                        setSelectedCategory(cat.id);
                      }}
                      style={({ focused }: any) => [
                        styles.categoryCard,
                        isCatActive &&
                          (isFavCat
                            ? styles.categoryCardFavActive
                            : styles.categoryCardActive),
                        focused && styles.categoryCardFocused,
                        Platform.OS === 'web'
                          ? ({
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            } as any)
                          : undefined,
                      ]}
                    >
                      <View
                        style={[
                          styles.categoryIconBox,
                          { backgroundColor: cat.bgColor },
                        ]}
                      >
                        <MaterialIcons
                          name={cat.icon}
                          size={18}
                          color={cat.iconColor}
                        />
                      </View>
                      <Text
                        style={[
                          styles.categoryTitle,
                          isCatActive &&
                            (isFavCat
                              ? styles.categoryTitleFavActive
                              : styles.categoryTitleActive),
                        ]}
                      >
                        {cat.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* رأس قسم الشبكة */}
            <View style={styles.gridHeaderRow}>
              <View style={styles.gridHeaderRight}>
                <Text style={styles.gridTitle}>
                  {debouncedQuery.length > 0
                    ? `نتائج البحث: "${debouncedQuery}"`
                    : CATEGORIES.find((c) => c.id === selectedCategory)?.title || 'الأعمال المتاحة'}
                </Text>
                <Text style={styles.gridCount}>
                  ({displayedGridItems.length} عمل متاح)
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                style={styles.backToRailsBtn}
                {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
              >
                <MaterialIcons name="arrow-forward" size={16} color="#0EA5E9" />
                <Text style={styles.backToRailsText}>العودة للرئيسية</Text>
              </Pressable>
            </View>

            {/* محتوى الشبكة */}
            {isGridLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0EA5E9" />
                <Text style={styles.loadingText}>جاري تحميل الأعمال...</Text>
              </View>
            ) : isGridError ? (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={48} color="#EF4444" />
                <Text style={styles.errorTitle}>حدث خطأ أثناء جلب البيانات</Text>
                <Pressable
                  onPress={() => fetchGridData(gridPage, false)}
                  style={styles.retryBtn}
                  {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                >
                  <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
                </Pressable>
              </View>
            ) : displayedGridItems.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons
                  name={selectedCategory === 'favorites' ? 'star-border' : 'movie'}
                  size={56}
                  color="#64748B"
                />
                <Text style={styles.emptyTitle}>
                  {selectedCategory === 'favorites'
                    ? 'قائمة المفضلة فارغة'
                    : 'لم يتم العثور على أي عمل مطابق'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {selectedCategory === 'favorites'
                    ? 'يمكنك إضافة الأفلام والمسلسلات المفضلة بالضغط على أيقونة القلب في أي بوستر'
                    : 'جرّب كتابة كلمات بحث أخرى أو اختر تصنيفاً مختلفاً من الأعلى'}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.gridContainer}>
                  {displayedGridItems.map((item, idx) => (
                    <VodCard
                      key={`grid-${item.id}-${idx}`}
                      item={item}
                      onSelect={handleSelect}
                      isFav={favoriteIds.includes(item.id)}
                      onToggleFav={handleToggleFav}
                      width={gridCardWidth}
                      hasTVPreferredFocus={idx === 0}
                    />
                  ))}
                </View>

                {/* زر تحميل المزيد */}
                {selectedCategory !== 'favorites' &&
                  debouncedQuery.length === 0 &&
                  gridPage < gridTotalPages && (
                    <View style={styles.loadMoreContainer}>
                      <Pressable
                        onPress={handleLoadMoreGrid}
                        disabled={isGridLoadingMore}
                        style={({ focused }: any) => [
                          styles.loadMoreBtn,
                          focused && styles.loadMoreBtnFocused,
                        ]}
                        {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                      >
                        {isGridLoadingMore ? (
                          <ActivityIndicator size="small" color="#0EA5E9" />
                        ) : (
                          <>
                            <Text style={styles.loadMoreBtnText}>تحميل المزيد</Text>
                            <MaterialIcons name="expand-more" size={20} color="#0EA5E9" />
                          </>
                        )}
                      </Pressable>
                    </View>
                  )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* نافذة تنبيهية للعمل الذي لم يصدر بعد */}
      {unreleasedNotice?.visible && (
        <Modal
          visible={unreleasedNotice.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setUnreleasedNotice(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalDialog}>
              <View style={styles.modalIconBox}>
                <MaterialIcons name="alarm" size={32} color="#F59E0B" />
              </View>

              <Text style={styles.modalTitle}>العمل قيد الإصدار قريباً</Text>
              <Text style={styles.modalContentName}>{unreleasedNotice.title}</Text>
              <Text style={styles.modalNoticeDesc}>
                {unreleasedNotice.releaseDate
                  ? `هذا العمل لم يتوفر للبث بعد على المنصات الرقمية. موعد الإصدار الرسمي هو ${unreleasedNotice.releaseDate}.`
                  : 'هذا العمل لم يصدر بعد رسمياً في دور العرض أو على المنصات الرقمية.'}
              </Text>

              <Pressable
                onPress={() => setUnreleasedNotice(null)}
                style={({ focused }: any) => [
                  styles.modalCloseBtn,
                  focused && styles.modalCloseBtnFocused,
                ]}
                {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
              >
                <Text style={styles.modalCloseBtnText}>حسناً، فهمت</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // الحاوية الكلية - الخلفية السينمائية الداكنة #0B1120
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },

  // الشريط العلوي البسيط (Minimal Top Bar)
  topBar: {
    height: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(11, 17, 32, 0.96)',
    zIndex: 20,
  },
  titleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  titleIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#131C31',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'right',
  },
  pageSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'right',
    marginTop: 2,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#131C31',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleBtnFocused: {
    borderColor: '#0EA5E9',
    backgroundColor: '#1E293B',
    transform: [{ scale: 1.08 }],
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 16px rgba(14, 165, 233, 0.45)',
        } as any)
      : {}),
  },
  iconCircleBtnGoldActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },

  // مربع البحث عند التوسيع
  searchExpandedBox: {
    height: 42,
    width: 280,
    borderRadius: 21,
    backgroundColor: '#131C31',
    borderWidth: 1.5,
    borderColor: '#0EA5E9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 18px rgba(14, 165, 233, 0.35)',
        } as any)
      : {}),
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'right',
    paddingVertical: 0,
  },
  searchCloseBtn: {
    padding: 4,
  },

  // منطقة التمرير
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // ===================================
  // صفوف البوسترات الأفقية (Rails)
  // ===================================
  railSection: {
    marginBottom: 32,
    marginTop: 18,
  },
  railHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  railHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  railIndicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  railTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
  },
  railSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.2)',
  },
  viewAllBtnText: {
    color: '#0EA5E9',
    fontSize: 12,
    fontWeight: '600',
  },
  railScrollContent: {
    paddingHorizontal: 24,
    gap: 16,
    paddingVertical: 12,
  },

  // ===================================
  // صف بطاقات التصنيفات (Categories Cards)
  // ===================================
  categoriesSection: {
    marginBottom: 32,
    marginTop: 8,
  },
  categoriesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  categoriesSectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'right',
  },
  categoriesScrollContent: {
    paddingHorizontal: 24,
    gap: 12,
    paddingVertical: 6,
  },
  categoryCard: {
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#131C31',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryCardActive: {
    borderColor: '#0EA5E9',
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 18px rgba(14, 165, 233, 0.35)',
        } as any)
      : {}),
  },
  categoryCardFavActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 18px rgba(245, 158, 11, 0.35)',
        } as any)
      : {}),
  },
  categoryCardFocused: {
    transform: [{ scale: 1.05 }],
    borderColor: '#0EA5E9',
  },
  categoryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTitleActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryTitleFavActive: {
    color: '#F59E0B',
    fontWeight: '700',
  },

  // ===================================
  // بطاقة البوستر (VodCard)
  // ===================================
  cardContainer: {
    position: 'relative',
  },
  cardFixedRailWidth: {
    width: 175,
  },
  cardInner: {
    width: '100%',
  },
  // إطار البوستر 2:3 مع حواف دائرية 14 وحالة التركيز والتوهج
  posterBox: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#131C31',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  posterBoxFocused: {
    borderColor: '#0EA5E9',
    transform: [{ scale: 1.07 }],
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 24px rgba(14, 165, 233, 0.45)',
        } as any)
      : {
          elevation: 10,
        }),
  },
  posterImg: {
    width: '100%',
    height: '100%',
  },
  fallbackPoster: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  posterBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(11, 17, 32, 0.85)',
  },
  posterTopBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(11, 17, 32, 0.85)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  ratingBadgeText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  favBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(11, 17, 32, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderColor: '#EF4444',
  },

  posterBottomBadges: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeMovie: {
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.4)',
  },
  typeBadgeTv: {
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  unreleasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.85)',
  },
  unreleasedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },

  // التفاصيل النصية أسفل البوستر
  metaBox: {
    marginTop: 8,
    paddingHorizontal: 2,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  cardTitleActive: {
    color: '#38BDF8',
  },
  subMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
  },
  metaYear: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  metaHint: {
    color: '#94A3B8',
    fontSize: 11,
  },

  // ===================================
  // وضع الشبكة (Grid View)
  // ===================================
  gridSection: {
    paddingTop: 16,
  },
  categoriesBarInGrid: {
    marginBottom: 20,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  gridHeaderRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  gridTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'right',
  },
  gridCount: {
    color: '#94A3B8',
    fontSize: 13,
  },
  backToRailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.25)',
  },
  backToRailsText: {
    color: '#0EA5E9',
    fontSize: 12,
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 16,
  },
  loadMoreContainer: {
    alignItems: 'center',
    marginTop: 36,
    marginBottom: 20,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#131C31',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.4)',
  },
  loadMoreBtnFocused: {
    borderColor: '#0EA5E9',
    transform: [{ scale: 1.05 }],
  },
  loadMoreBtnText: {
    color: '#0EA5E9',
    fontSize: 14,
    fontWeight: '600',
  },

  // حالات التحميل والخطأ والفارغة
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 16,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 14,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#131C31',
    borderWidth: 1,
    borderColor: '#0EA5E9',
    marginTop: 8,
  },
  retryBtnText: {
    color: '#0EA5E9',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 20,
  },

  // النافذة التنبيهية للأعمال غير المصرح بإصدارها بعد
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#131C31',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#0EA5E9',
    padding: 24,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 32px rgba(14, 165, 233, 0.4)',
        } as any)
      : {}),
  },
  modalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalContentName: {
    color: '#0EA5E9',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalNoticeDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalCloseBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0EA5E9',
  },
  modalCloseBtnFocused: {
    transform: [{ scale: 1.05 }],
  },
  modalCloseBtnText: {
    color: '#0B1120',
    fontSize: 14,
    fontWeight: '700',
  },
});
