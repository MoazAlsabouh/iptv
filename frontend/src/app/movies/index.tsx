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

export interface RailConfig {
  id: string;
  title: string;
  subtitle?: string;
  indicatorColor: string;
  type?: 'all' | 'movie' | 'tv';
  category: string;
  lang?: string;
  page?: number;
}

// 1. أقسام الواجهة الرئيسية («الكل») المتنوعة
const ALL_RAILS: RailConfig[] = [
  {
    id: 'all_trending',
    title: 'الأكثر مشاهدة والرائج',
    subtitle: 'أقوى وأشهر الأعمال التي يتابعها الجميع الآن',
    indicatorColor: '#F59E0B',
    type: 'all',
    category: 'trending',
  },
  {
    id: 'all_ar_movies',
    title: 'أفلام عربية مختارة',
    subtitle: 'أحدث الإنتاجات السينمائية العربية',
    indicatorColor: '#F43F5E',
    type: 'movie',
    category: 'arabic_movies',
  },
  {
    id: 'all_ar_series',
    title: 'مسلسلات عربية مميزة',
    subtitle: 'أقوى الأعمال الدرامية والمسلسلات الحصرية',
    indicatorColor: '#A855F7',
    type: 'tv',
    category: 'arabic_series',
  },
  {
    id: 'all_action',
    title: 'أكشن وإثارة',
    subtitle: 'أفلام الحركة والمغامرات الأكثر حماساً',
    indicatorColor: '#EF4444',
    type: 'movie',
    category: 'action',
  },
  {
    id: 'all_drama',
    title: 'دراما وقصص واقعية',
    subtitle: 'أعمال درامية آسرة ومشوقة',
    indicatorColor: '#3B82F6',
    type: 'all',
    category: 'drama',
  },
  {
    id: 'all_comedy',
    title: 'كوميديا وضحك',
    subtitle: 'أفلام ومسلسلات للضحك والمرح العائلي',
    indicatorColor: '#10B981',
    type: 'all',
    category: 'comedy',
  },
  {
    id: 'all_latest',
    title: 'أحدث الإضافات العالمية',
    subtitle: 'أحدث الأفلام والمسلسلات المضافة للمنصة',
    indicatorColor: '#0EA5E9',
    type: 'movie',
    category: 'trending',
    page: 2,
  },
];

// 2. سلايدات فرعية لقسم «أفلام عربية»
const AR_MOVIES_RAILS: RailConfig[] = [
  {
    id: 'ar_mov_trending',
    title: 'الأكثر مشاهدة في السينما العربية',
    subtitle: 'أفلام عربية تتصدر شباك التذاكر والمشاهدات',
    indicatorColor: '#F59E0B',
    type: 'movie',
    category: 'arabic_movies',
  },
  {
    id: 'ar_mov_comedy',
    title: 'كوميديا عربية',
    subtitle: 'أقوى وأطرف الأفلام الكوميدية العربية',
    indicatorColor: '#10B981',
    type: 'movie',
    category: 'comedy',
    lang: 'ar',
  },
  {
    id: 'ar_mov_drama',
    title: 'دراما واجتماعي عربي',
    subtitle: 'قصص درامية سينمائية عربية مؤثرة',
    indicatorColor: '#3B82F6',
    type: 'movie',
    category: 'drama',
    lang: 'ar',
  },
  {
    id: 'ar_mov_action',
    title: 'أكشن وتشويق عربي',
    subtitle: 'أفلام الإثارة والغموض والحركة العربية',
    indicatorColor: '#EF4444',
    type: 'movie',
    category: 'action',
    lang: 'ar',
  },
];

// 3. سلايدات فرعية لقسم «مسلسلات عربية»
const AR_SERIES_RAILS: RailConfig[] = [
  {
    id: 'ar_ser_trending',
    title: 'أشهر المسلسلات العربية',
    subtitle: 'المسلسلات الأكثر متابعة وتفاعلاً في الوطن العربي',
    indicatorColor: '#A855F7',
    type: 'tv',
    category: 'arabic_series',
  },
  {
    id: 'ar_ser_drama',
    title: 'دراما عربية مميزة',
    subtitle: 'أقوى الأعمال الدرامية والاجتماعية',
    indicatorColor: '#3B82F6',
    type: 'tv',
    category: 'drama',
    lang: 'ar',
  },
  {
    id: 'ar_ser_comedy',
    title: 'كوميديا ومسلسلات خفيفة',
    subtitle: 'مسلسلات كوميدية عائلية ممتعة',
    indicatorColor: '#10B981',
    type: 'tv',
    category: 'comedy',
    lang: 'ar',
  },
  {
    id: 'ar_ser_action',
    title: 'تشويق وجريمة وإثارة',
    subtitle: 'مسلسلات الغموض والأكشن العربية',
    indicatorColor: '#EF4444',
    type: 'tv',
    category: 'action',
    lang: 'ar',
  },
];

// 4. سلايدات فرعية لقسم «أفلام أجنبية»
const FOREIGN_MOVIES_RAILS: RailConfig[] = [
  {
    id: 'for_mov_trending',
    title: 'أشهر الأفلام العالمية',
    subtitle: 'الأفلام العالمية الأكثر رواجاً وشهرة',
    indicatorColor: '#F59E0B',
    type: 'movie',
    category: 'trending',
  },
  {
    id: 'for_mov_action',
    title: 'أكشن ومغامرات',
    subtitle: 'أقوى أفلام الحركة والخوارق والمغامرة',
    indicatorColor: '#EF4444',
    type: 'movie',
    category: 'action',
  },
  {
    id: 'for_mov_scifi',
    title: 'خيال علمي وفانتازيا',
    subtitle: 'عوالم مستقبلية وخيالية مذهلة',
    indicatorColor: '#8B5CF6',
    type: 'movie',
    category: 'scifi',
  },
  {
    id: 'for_mov_horror',
    title: 'رعب وإثارة وغموض',
    subtitle: 'أقوى أفلام الرعب والتشويق العالي',
    indicatorColor: '#F43F5E',
    type: 'movie',
    category: 'horror',
  },
  {
    id: 'for_mov_comedy',
    title: 'كوميديا عالمية',
    subtitle: 'أفضل الأفلام الكوميدية العالمية',
    indicatorColor: '#10B981',
    type: 'movie',
    category: 'comedy',
  },
];

// 5. سلايدات فرعية لقسم «مسلسلات أجنبية»
const FOREIGN_SERIES_RAILS: RailConfig[] = [
  {
    id: 'for_ser_trending',
    title: 'أفضل المسلسلات العالمية',
    subtitle: 'مسلسلات عالمية حازت على أعلى المشاهدات والجوائز',
    indicatorColor: '#38BDF8',
    type: 'tv',
    category: 'trending',
  },
  {
    id: 'for_ser_drama',
    title: 'دراما عالمية ملحمية',
    subtitle: 'قصص درامية مؤثرة وعميقة',
    indicatorColor: '#3B82F6',
    type: 'tv',
    category: 'drama',
  },
  {
    id: 'for_ser_scifi',
    title: 'خيال علمي وفانتازيا',
    subtitle: 'مسلسلات الخيال العلمي والفضاء والغموض',
    indicatorColor: '#8B5CF6',
    type: 'tv',
    category: 'scifi',
  },
  {
    id: 'for_ser_anime',
    title: 'أنمي ورسوم متحركة',
    subtitle: 'أفضل مسلسلات الأنمي والرسوم المتحركة العالمية',
    indicatorColor: '#F59E0B',
    type: 'tv',
    category: 'animation',
  },
];

// كاش محلي للذاكرة لتسريع التنقل بين السلايدات دون إعادة التحميل
const railMemoryCache = new Map<string, VodItem[]>();

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
            {/* إطار البوستر بنسبة 2:3 مع حواف دائرية 14 وحالة التركيز المتوهجة */}
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

              {/* شارات الرأس: التقييم + زر المفضلة */}
              <View style={styles.posterTopBadges}>
                <View style={styles.ratingBadge}>
                  <MaterialIcons name="star" size={13} color="#F59E0B" />
                  <Text style={styles.ratingBadgeText}>
                    {item.rating > 0 ? item.rating.toFixed(1) : 'جديد'}
                  </Text>
                </View>

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

              {/* شارة نوع العمل أو موعد قريباً */}
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

/**
 * مكوّن السلايدر الأفقي السلس (Smooth Horizontal Slider)
 * مزوّد بأزرار تنقل جانبية أنيقة وتمرير انسيابي وسحب باللمس والريموت
 */
interface PosterSliderProps {
  config: RailConfig;
  onSelect: (item: VodItem) => void;
  favoriteIds: string[];
  onToggleFav: (item: VodItem) => void;
  hasTVPreferredFocus?: boolean;
}

const PosterSlider: React.FC<PosterSliderProps> = ({
  config,
  onSelect,
  favoriteIds,
  onToggleFav,
  hasTVPreferredFocus,
}) => {
  const [items, setItems] = useState<VodItem[]>(() => railMemoryCache.get(config.id) || []);
  const [isLoading, setIsLoading] = useState<boolean>(!railMemoryCache.has(config.id));
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let isMounted = true;
    if (railMemoryCache.has(config.id)) {
      setItems(railMemoryCache.get(config.id) || []);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const fetchRail = async () => {
      try {
        const langParam = config.lang ? `&lang=${config.lang}` : '';
        const pageParam = config.page ? `&page=${config.page}` : '&page=1';
        const url = `${BACKEND_BASE_URL}/api/vod/catalog?type=${config.type || 'all'}&category=${config.category}${pageParam}${langParam}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const data = await res.json();
          const list = data.results || [];
          railMemoryCache.set(config.id, list);
          if (isMounted) {
            setItems(list);
          }
        }
      } catch {
        // تجاهل
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRail();
    return () => {
      isMounted = false;
    };
  }, [config.id, config.category, config.type, config.lang, config.page]);

  // التمرير الجانبي السلس عبر أزرار الأسهم
  const scrollRail = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const node = (scrollRef.current as any).getScrollableNode?.() || scrollRef.current;
    const amount = direction === 'left' ? -580 : 580;

    if (node && typeof node.scrollBy === 'function') {
      node.scrollBy({ left: amount, behavior: 'smooth' });
    } else if (typeof (scrollRef.current as any).scrollTo === 'function') {
      (scrollRef.current as any).scrollTo({ x: amount, animated: true });
    }
  };

  if (!isLoading && items.length === 0) {
    return null;
  }

  return (
    <View
      style={styles.railSection}
      {...(Platform.OS === 'web'
        ? ({
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
          } as any)
        : {})}
    >
      {/* رأس السلايدر */}
      <View style={styles.railHeader}>
        <View style={styles.railHeaderRight}>
          <View style={[styles.railIndicator, { backgroundColor: config.indicatorColor }]} />
          <View>
            <Text style={styles.railTitle}>{config.title}</Text>
            {config.subtitle ? (
              <Text style={styles.railSubtitle}>{config.subtitle}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* منطقة السلايدر مع أزرار التنقل الجانبية */}
      <View style={styles.sliderWrapper}>
        {/* زر التمرير لليمين */}
        <Pressable
          onPress={() => scrollRail('right')}
          style={({ focused }: any) => [
            styles.sliderNavBtn,
            styles.sliderNavBtnRight,
            isHovered && styles.sliderNavBtnVisible,
            focused && styles.sliderNavBtnFocused,
          ]}
          {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
        >
          <MaterialIcons name="chevron-right" size={30} color="#FFFFFF" />
        </Pressable>

        {/* زر التمرير لليسار */}
        <Pressable
          onPress={() => scrollRail('left')}
          style={({ focused }: any) => [
            styles.sliderNavBtn,
            styles.sliderNavBtnLeft,
            isHovered && styles.sliderNavBtnVisible,
            focused && styles.sliderNavBtnFocused,
          ]}
          {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
        >
          <MaterialIcons name="chevron-left" size={30} color="#FFFFFF" />
        </Pressable>

        {isLoading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.railScrollContent}
          >
            {[...Array(6)].map((_, i) => (
              <View key={`skel-${config.id}-${i}`} style={styles.cardSkeleton} />
            ))}
          </ScrollView>
        ) : (
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.railScrollContent}
            style={Platform.OS === 'web' ? ({ scrollBehavior: 'smooth' } as any) : undefined}
          >
            {items.map((item, idx) => (
              <VodCard
                key={`item-${config.id}-${item.id}-${idx}`}
                item={item}
                onSelect={onSelect}
                isFav={Boolean(item?.id && Array.isArray(favoriteIds) && favoriteIds.includes(item.id))}
                onToggleFav={onToggleFav}
                hasTVPreferredFocus={hasTVPreferredFocus && idx === 0}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

export default function MoviesScreen(): React.JSX.Element {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // حساب الأعمدة ديناميكياً للشبكة في نتائج البحث والمفضلة
  const numColumns = useMemo(() => {
    if (width >= 1600) return 6;
    if (width >= 1150) return 5;
    if (width >= 800) return 4;
    if (width >= 520) return 3;
    return 2;
  }, [width]);

  const gridCardWidth = useMemo(() => {
    const horizontalPadding = 48;
    const gapTotal = (numColumns - 1) * 16;
    const availableWidth = Math.max(300, width - horizontalPadding);
    return Math.floor((availableWidth - gapTotal) / numColumns);
  }, [width, numColumns]);

  // التصنيف المختار (الافتراضي: 'all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // البحث
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const searchInputRef = useRef<TextInput>(null);

  // المفضلة
  const { favoriteIds, vodFavorites, toggleFavorite } = useAppStore();

  // بيانات وضع الشبكة (للبحث فقط)
  const [searchResults, setSearchResults] = useState<VodItem[]>([]);
  const [searchPage, setSearchPage] = useState<number>(1);
  const [searchTotalPages, setSearchTotalPages] = useState<number>(1);
  const [isSearchLoading, setIsSearchLoading] = useState<boolean>(false);
  const [isSearchLoadingMore, setIsSearchLoadingMore] = useState<boolean>(false);

  // نافذة تنبيهية للعمل الذي لم يصدر بعد
  const [unreleasedNotice, setUnreleasedNotice] = useState<{
    visible: boolean;
    title: string;
    releaseDate?: string;
  } | null>(null);

  // مفتاح لتحديث السلايدات عند النقر على زر التحديث
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Debounce للبحث
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // جلب نتائج البحث عند الكتابة
  const fetchSearchData = useCallback(async (page: number, append: boolean = false) => {
    if (debouncedQuery.length === 0) return;
    if (append) {
      setIsSearchLoadingMore(true);
    } else {
      setIsSearchLoading(true);
    }

    try {
      const endpoint = `${BACKEND_BASE_URL}/api/vod/search?q=${encodeURIComponent(
        debouncedQuery
      )}&page=${page}`;
      const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const results: VodItem[] = data.results || [];
        setSearchTotalPages(data.totalPages || 1);
        setSearchResults((prev) => (append ? [...prev, ...results] : results));
      }
    } catch {
      // تجاهل
    } finally {
      setIsSearchLoading(false);
      setIsSearchLoadingMore(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    if (debouncedQuery.length > 0) {
      setSearchPage(1);
      fetchSearchData(1, false);
    } else {
      setSearchResults([]);
    }
  }, [debouncedQuery, fetchSearchData]);

  const handleLoadMoreSearch = () => {
    if (!isSearchLoadingMore && searchPage < searchTotalPages) {
      const nextPage = searchPage + 1;
      setSearchPage(nextPage);
      fetchSearchData(nextPage, true);
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

  const handleToggleFav = (item: VodItem) => {
    toggleFavorite(item);
  };

  // تحديد قائمة السلايدات المعروضة حسب التصنيف المختار
  const currentRails = useMemo<RailConfig[]>(() => {
    switch (selectedCategory) {
      case 'arabic_movies':
        return AR_MOVIES_RAILS;
      case 'arabic_series':
        return AR_SERIES_RAILS;
      case 'foreign_movies':
        return FOREIGN_MOVIES_RAILS;
      case 'foreign_series':
        return FOREIGN_SERIES_RAILS;
      case 'all':
      default:
        return ALL_RAILS;
    }
  }, [selectedCategory]);

  // هل نحن في وضع البحث أو المفضلة (الشبكة)؟
  const isSearchMode = debouncedQuery.length > 0;
  const isFavoritesMode = selectedCategory === 'favorites' && !isSearchMode;

  return (
    <View style={styles.container}>
      {/* 1. الشريط العلوي البسيط (Minimal Top Bar) */}
      <View style={styles.topBar}>
        <View style={styles.titleArea}>
          <View style={styles.titleIconBadge}>
            <MaterialIcons name="local-movies" size={22} color="#0EA5E9" />
          </View>
          <View>
            <Text style={styles.pageTitle}>الأفلام والمسلسلات</Text>
            <Text style={styles.pageSubtitle}>تلفازي سينما • كتالوج الترفيه الذكي</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
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

          {/* زر التحديث وإعادة التحميل */}
          <Pressable
            onPress={() => {
              railMemoryCache.clear();
              setRefreshKey((prev) => prev + 1);
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

      {/* 2. شريط «تصفح حسب التصنيف» في أعلى الصفحة مباشرة تحت الشريط العلوي */}
      <View style={styles.topCategoriesRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topCategoriesScrollContent}
        >
          {CATEGORIES.map((cat) => {
            const isCatActive = selectedCategory === cat.id && !isSearchMode;
            const isFavCat = cat.id === 'favorites';

            return (
              <Pressable
                key={`top-cat-${cat.id}`}
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

      {/* 3. منطقة المحتوى القابلة للتمرير */}
      <ScrollView
        key={`content-scroll-${refreshKey}-${selectedCategory}`}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* أ) وضع نتائج البحث (عرض شبكي نظيف) */}
        {isSearchMode ? (
          <View style={styles.gridSection}>
            <View style={styles.gridHeaderRow}>
              <View style={styles.gridHeaderRight}>
                <Text style={styles.gridTitle}>نتائج البحث عن: "{debouncedQuery}"</Text>
                <Text style={styles.gridCount}>({searchResults.length} عمل)</Text>
              </View>
              <Pressable
                onPress={() => setSearchQuery('')}
                style={styles.clearSearchBtn}
                {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
              >
                <MaterialIcons name="close" size={16} color="#0EA5E9" />
                <Text style={styles.clearSearchBtnText}>إلغاء البحث</Text>
              </Pressable>
            </View>

            {isSearchLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0EA5E9" />
                <Text style={styles.loadingText}>جاري البحث في قاعدة الأفلام والمسلسلات...</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="search-off" size={56} color="#64748B" />
                <Text style={styles.emptyTitle}>لم يتم العثور على أي نتائج</Text>
                <Text style={styles.emptySubtitle}>
                  جرّب البحث بكلمات مختلفة أو تحقق من صحة اسم الفيلم أو المسلسل.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.gridContainer}>
                  {searchResults.map((item, idx) => (
                    <VodCard
                      key={`search-${item.id}-${idx}`}
                      item={item}
                      onSelect={handleSelect}
                      isFav={Boolean(item?.id && Array.isArray(favoriteIds) && favoriteIds.includes(item.id))}
                      onToggleFav={handleToggleFav}
                      width={gridCardWidth}
                      hasTVPreferredFocus={idx === 0}
                    />
                  ))}
                </View>

                {searchPage < searchTotalPages && (
                  <View style={styles.loadMoreContainer}>
                    <Pressable
                      onPress={handleLoadMoreSearch}
                      disabled={isSearchLoadingMore}
                      style={({ focused }: any) => [
                        styles.loadMoreBtn,
                        focused && styles.loadMoreBtnFocused,
                      ]}
                      {...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {})}
                    >
                      {isSearchLoadingMore ? (
                        <ActivityIndicator size="small" color="#0EA5E9" />
                      ) : (
                        <>
                          <Text style={styles.loadMoreBtnText}>تحميل المزيد من النتائج</Text>
                          <MaterialIcons name="expand-more" size={20} color="#0EA5E9" />
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </View>
        ) : isFavoritesMode ? (
          /* ب) وضع المفضلة (عرض شبكي نظيف) */
          <View style={styles.gridSection}>
            <View style={styles.gridHeaderRow}>
              <View style={styles.gridHeaderRight}>
                <MaterialIcons name="star" size={24} color="#F59E0B" />
                <Text style={styles.gridTitle}>قائمة المفضلة</Text>
                <Text style={styles.gridCount}>({(vodFavorites || []).length} عمل محفوظ)</Text>
              </View>
            </View>

            {(vodFavorites || []).length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="star-border" size={60} color="#F59E0B" />
                <Text style={styles.emptyTitle}>قائمة المفضلة فارغة حالياً</Text>
                <Text style={styles.emptySubtitle}>
                  يمكنك حفظ أي فيلم أو مسلسل بالضغط على أيقونة القلب على البوستر للوصول السريع إليه هنا.
                </Text>
              </View>
            ) : (
              <View style={styles.gridContainer}>
                {(vodFavorites || []).map((item: any, idx: number) => (
                  <VodCard
                    key={`fav-${item.id}-${idx}`}
                    item={item}
                    onSelect={handleSelect}
                    isFav={true}
                    onToggleFav={handleToggleFav}
                    width={gridCardWidth}
                    hasTVPreferredFocus={idx === 0}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          /* ج) وضع السلايدات الأفقية السلسة لكافة الأقسام والتصنيفات الفرعية */
          <View style={styles.railsContainer}>
            {currentRails.map((rail, index) => (
              <PosterSlider
                key={`rail-${rail.id}-${refreshKey}`}
                config={rail}
                onSelect={handleSelect}
                favoriteIds={favoriteIds}
                onToggleFav={handleToggleFav}
                hasTVPreferredFocus={index === 0}
              />
            ))}
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
                  ? `هذا العمل لم يتوفر للبث بعد على المنصات الرقمية. موعد الإصدار الرسمي المتوقع هو ${unreleasedNotice.releaseDate}.`
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

  // شريط «تصفح حسب التصنيف» في أعلى الصفحة مباشرة
  topCategoriesRow: {
    backgroundColor: '#0B1120',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 12,
    zIndex: 10,
  },
  topCategoriesScrollContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  categoryCard: {
    height: 52,
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
    backgroundColor: 'rgba(14, 165, 233, 0.14)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 18px rgba(14, 165, 233, 0.35)',
        } as any)
      : {}),
  },
  categoryCardFavActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
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
    width: 34,
    height: 34,
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

  // التمرير العام
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  railsContainer: {
    paddingTop: 10,
  },

  // مكوّن السلايدر الأفقي السلس
  railSection: {
    marginBottom: 32,
    position: 'relative',
  },
  railHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 14,
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
  sliderWrapper: {
    position: 'relative',
  },
  railScrollContent: {
    paddingHorizontal: 24,
    gap: 16,
    paddingVertical: 12,
  },

  // أزرار التنقل الجانبية للسلايدر
  sliderNavBtn: {
    position: 'absolute',
    top: '46%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
    opacity: 0,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.65)',
          transition: 'all 0.22s ease-in-out',
        } as any)
      : {}),
  },
  sliderNavBtnVisible: {
    opacity: 1,
  },
  sliderNavBtnFocused: {
    opacity: 1,
    borderColor: '#0EA5E9',
    backgroundColor: 'rgba(14, 165, 233, 0.3)',
    transform: [{ scale: 1.1 }],
  },
  sliderNavBtnRight: {
    right: 12,
  },
  sliderNavBtnLeft: {
    left: 12,
  },

  // بطاقة البوستر
  cardContainer: {
    position: 'relative',
  },
  cardFixedRailWidth: {
    width: 175,
  },
  cardInner: {
    width: '100%',
  },
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

  cardSkeleton: {
    width: 175,
    aspectRatio: 2 / 3,
    borderRadius: 14,
    backgroundColor: '#131C31',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },

  // وضع الشبكة (Grid View) للبحث والمفضلة
  gridSection: {
    paddingTop: 16,
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
    alignItems: 'center',
    gap: 10,
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
  clearSearchBtn: {
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
  clearSearchBtnText: {
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
