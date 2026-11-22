import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { ChannelLogo } from '../../components/ChannelLogo';
import { StreamSource } from '../../types/media';
import { useAppStore } from '../../store/useAppStore';

const BACKEND_BASE_URL = 'https://iptv-backend.moaznsm.workers.dev';

interface EpisodeItem {
  id: number;
  season: number;
  number: number;
  name: string;
  airdate?: string;
  rating?: number;
  summary?: string;
  image?: string;
}

interface SeasonGroup {
  season: number;
  episodes: EpisodeItem[];
}

/**
 * دالة مساعدة لتوليد سيرفرات البث المتعددة للحلقة المختارة
 */
function buildEpisodeSources(
  tmdbId?: string,
  imdbId?: string,
  season: number = 1,
  episode: number = 1
): StreamSource[] {
  const sources: StreamSource[] = [];
  const targetId = tmdbId || imdbId || '';

  if (tmdbId) {
    sources.push({
      label: 'سيرفر 1 (VidSrc)',
      url: `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`,
    });
    sources.push({
      label: 'سيرفر 2 (Embed.su)',
      url: `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`,
    });
    sources.push({
      label: 'سيرفر 3 (VidSrc Me)',
      url: `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,
    });
  } else if (imdbId) {
    sources.push({
      label: 'سيرفر 1 (VidSrc)',
      url: `https://vidsrc.to/embed/tv/${imdbId}/${season}/${episode}`,
    });
    sources.push({
      label: 'سيرفر 2 (VidSrc Me)',
      url: `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`,
    });
  }

  // سيرفر احتياطي مباشر
  sources.push({
    label: `سيرفر ${sources.length + 1} (مباشر)`,
    url: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4?id=${targetId}&s=${season}&e=${episode}`,
  });

  return sources;
}

/**
 * شاشة سينمائية متكاملة لتفاصيل المسلسل واختيار المواسم والحلقات قبل بدء التشغيل.
 * مصممة لتجربة التلفاز الكبيرة مع تحكم سلس بالريموت كنترول.
 */
export default function SeriesDetailsScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    poster?: string;
    backdrop?: string;
    rating?: string;
    year?: string;
    overview?: string;
    category?: string;
    tmdbId?: string;
    imdbId?: string;
    originalLanguage?: string;
    lang?: string;
  }>();

  const seriesTitle = useMemo(() => {
    if (!params.title) return 'تفاصيل المسلسل';
    return typeof params.title === 'string'
      ? decodeURIComponent(params.title)
      : params.title[0]
      ? decodeURIComponent(params.title[0])
      : 'تفاصيل المسلسل';
  }, [params.title]);

  const rawFavs = useAppStore((state) => state.favoriteIds);
  const favoriteIds = Array.isArray(rawFavs) ? rawFavs : [];
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const isFavorite = Boolean(params.id && favoriteIds.includes(params.id));

  const seriesPoster = useMemo(() => {
    if (!params.poster) return '';
    return typeof params.poster === 'string'
      ? decodeURIComponent(params.poster)
      : params.poster[0]
      ? decodeURIComponent(params.poster[0])
      : '';
  }, [params.poster]);

  const seriesBackdrop = useMemo(() => {
    if (!params.backdrop) return '';
    return typeof params.backdrop === 'string'
      ? decodeURIComponent(params.backdrop)
      : params.backdrop[0]
      ? decodeURIComponent(params.backdrop[0])
      : '';
  }, [params.backdrop]);

  const ratingNum = params.rating ? parseFloat(params.rating) : 0;
  const seriesYear = params.year || '';
  const seriesOverview = params.overview ? decodeURIComponent(params.overview) : '';
  const seriesCategory = params.category || 'مسلسل';

  const [seasons, setSeasons] = useState<SeasonGroup[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState<boolean>(true);

  // جلب مواسم وحلقات المسلسل من TVmaze
  useEffect(() => {
    let isMounted = true;
    setIsLoadingEpisodes(true);

    const fetchEpisodesData = async () => {
      try {
        const tmdbParam = params.tmdbId ? `&tmdbId=${encodeURIComponent(params.tmdbId)}` : '';
        const q = encodeURIComponent(seriesTitle);
        const imdb = params.imdbId ? encodeURIComponent(params.imdbId) : '';
        const res = await fetch(
          `${BACKEND_BASE_URL}/api/vod/episodes?q=${q}&imdb=${imdb}${tmdbParam}`
        );

        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.seasons && Array.isArray(data.seasons) && data.seasons.length > 0) {
            setSeasons(data.seasons);
            setSelectedSeason(data.seasons[0].season);
            setIsLoadingEpisodes(false);
            return;
          }
        }
      } catch {
        // تجاهل
      }

      // في حال عدم توفر حلقات من TVmaze، ننشئ موسماً افتراضياً به 10 حلقات
      if (isMounted) {
        const fallbackEpisodes: EpisodeItem[] = Array.from({ length: 12 }, (_, i) => ({
          id: i + 1,
          season: 1,
          number: i + 1,
          name: `الحلقة ${i + 1}`,
        }));
        setSeasons([{ season: 1, episodes: fallbackEpisodes }]);
        setSelectedSeason(1);
        setIsLoadingEpisodes(false);
      }
    };

    fetchEpisodesData();

    return () => {
      isMounted = false;
    };
  }, [seriesTitle, params.imdbId]);

  const [focusedSection, setFocusedSection] = useState<'back' | 'seasons' | 'episodes'>('back');
  const [focusedSeasonIndex, setFocusedSeasonIndex] = useState<number>(0);
  const [focusedEpisodeIndex, setFocusedEpisodeIndex] = useState<number>(0);
  const mainScrollRef = useRef<any>(null);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/movies');
    }
    return true;
  }, [router]);

  // تشغيل الحلقة المختارة
  const handlePlayEpisode = useCallback((seasonNum: number, episodeNum: number) => {
    const sources = buildEpisodeSources(params.tmdbId, params.imdbId, seasonNum, episodeNum);
    const initialUrl = sources[0]?.url || '';
    const isExplicitArabic =
      params.originalLanguage === 'ar' ||
      params.lang === 'ar' ||
      params.category === 'arabic_series';
    const detectedLang = isExplicitArabic ? 'ar' : (params.originalLanguage || params.lang || 'en');

    router.push({
      pathname: '/play/[id]',
      params: {
        id: `${params.id || 'series'}-s${seasonNum}e${episodeNum}`,
        title: `${seriesTitle} - الموسم ${seasonNum} الحلقة ${episodeNum}`,
        url: initialUrl,
        logo: seriesPoster,
        sources: JSON.stringify(sources),
        type: 'tv',
        tmdbId: params.tmdbId,
        imdbId: params.imdbId,
        season: String(seasonNum),
        episode: String(episodeNum),
        lang: detectedLang,
        originalLanguage: detectedLang,
      },
    });
  }, [params, seriesTitle, seriesPoster, router]);

  // حلقات الموسم المختار
  const currentEpisodes = useMemo(() => {
    const found = seasons.find((s) => s.season === selectedSeason);
    return found?.episodes || [];
  }, [seasons, selectedSeason]);

  const { width, height } = useWindowDimensions();
  const isLandscapeShort = height < 520;
  const numCols = width > 950 ? 3 : width > 600 ? 2 : 1;
  const epColWidth = `${100 / numCols}%` as any;

  // تمرير تلقائي للشاشة الرأسية مع حركة التركيز
  useEffect(() => {
    if (focusedSection === 'back') {
      mainScrollRef.current?.scrollTo({ y: 0, animated: true });
    } else if (focusedSection === 'seasons') {
      mainScrollRef.current?.scrollTo({ y: 160, animated: true });
    } else if (focusedSection === 'episodes') {
      const rowIndex = Math.floor(focusedEpisodeIndex / numCols);
      mainScrollRef.current?.scrollTo({
        y: Math.max(0, 240 + rowIndex * 130),
        animated: true,
      });
    }
  }, [focusedSection, focusedEpisodeIndex, numCols]);

  const handleArrowUp = useCallback(() => {
    if (focusedSection === 'episodes') {
      if (focusedEpisodeIndex < numCols) {
        if (seasons.length > 1) {
          setFocusedSection('seasons');
        } else {
          setFocusedSection('back');
        }
      } else {
        setFocusedEpisodeIndex((prev) => Math.max(0, prev - numCols));
      }
    } else if (focusedSection === 'seasons') {
      setFocusedSection('back');
    }
  }, [focusedSection, focusedEpisodeIndex, numCols, seasons.length]);

  const handleArrowDown = useCallback(() => {
    if (focusedSection === 'back') {
      if (seasons.length > 1) {
        setFocusedSection('seasons');
      } else if (currentEpisodes.length > 0) {
        setFocusedSection('episodes');
        setFocusedEpisodeIndex(0);
      }
    } else if (focusedSection === 'seasons') {
      if (currentEpisodes.length > 0) {
        setFocusedSection('episodes');
        setFocusedEpisodeIndex(0);
      }
    } else if (focusedSection === 'episodes') {
      setFocusedEpisodeIndex((prev) =>
        Math.min(currentEpisodes.length - 1, prev + numCols)
      );
    }
  }, [focusedSection, seasons.length, currentEpisodes.length, numCols]);

  const handleArrowRight = useCallback(() => {
    // التحرك يميناً بصرياً
    if (focusedSection === 'seasons') {
      setFocusedSeasonIndex((prev) => Math.min(seasons.length - 1, prev + 1));
    } else if (focusedSection === 'episodes') {
      setFocusedEpisodeIndex((prev) =>
        Math.min(currentEpisodes.length - 1, prev + 1)
      );
    }
  }, [focusedSection, seasons.length, currentEpisodes.length]);

  const handleArrowLeft = useCallback(() => {
    // التحرك يساراً بصرياً
    if (focusedSection === 'seasons') {
      setFocusedSeasonIndex((prev) => Math.max(0, prev - 1));
    } else if (focusedSection === 'episodes') {
      if (focusedEpisodeIndex % numCols === 0) {
        // الحافة اليسرى
      } else {
        setFocusedEpisodeIndex((prev) => Math.max(0, prev - 1));
      }
    }
  }, [focusedSection, numCols, focusedEpisodeIndex]);

  const handleEnterKey = useCallback(() => {
    if (focusedSection === 'back') {
      handleGoBack();
    } else if (focusedSection === 'seasons') {
      const s = seasons[focusedSeasonIndex];
      if (s) {
        setSelectedSeason(s.season);
        setFocusedSection('episodes');
        setFocusedEpisodeIndex(0);
      }
    } else if (focusedSection === 'episodes') {
      const ep = currentEpisodes[focusedEpisodeIndex];
      if (ep) {
        handlePlayEpisode(ep.season, ep.number);
      }
    }
  }, [
    focusedSection,
    handleGoBack,
    seasons,
    focusedSeasonIndex,
    currentEpisodes,
    focusedEpisodeIndex,
    handlePlayEpisode,
  ]);

  useTVRemoteNavigation({
    onArrowUp: handleArrowUp,
    onArrowDown: handleArrowDown,
    onArrowRight: handleArrowRight,
    onArrowLeft: handleArrowLeft,
    onEnter: handleEnterKey,
    onBack: handleGoBack,
  });

  return (
    <ScrollView
      ref={mainScrollRef}
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      nestedScrollEnabled={true}
      showsVerticalScrollIndicator={true}
    >
      {/* 1. رأس سينمائي كبير (Hero Header) */}
      <View style={[styles.heroSection, isLandscapeShort && styles.heroSectionLandscape]}>
        {seriesBackdrop || seriesPoster ? (
          <Image
            source={{ uri: seriesBackdrop || seriesPoster }}
            style={styles.heroBackdrop}
            resizeMode="cover"
          />
        ) : null}

        {/* تدرج التعتيم السينمائي */}
        <View style={styles.heroGradient} />

        {/* شريط الرجوع العلوي */}
        <View style={styles.topBar}>
          <Pressable
            hasTVPreferredFocus
            onPress={handleGoBack}
            style={({ focused }) => [
              styles.backBtn,
              (focusedSection === 'back' || focused) && styles.backBtnFocused,
            ]}
          >
            {({ focused }) => {
              const isFocusedBack = focusedSection === 'back' || focused;
              return (
                <View style={styles.btnRow}>
                  <MaterialIcons
                    name="arrow-back"
                    size={22}
                    color={isFocusedBack ? '#38bdf8' : '#ffffff'}
                  />
                  <Text style={[styles.backBtnText, isFocusedBack && styles.backBtnTextFocused]}>
                    العودة للأفلام والمسلسلات
                  </Text>
                </View>
              );
            }}
          </Pressable>
        </View>

        {/* تفاصيل العمل في مقدمة الهيرو */}
        <View style={[styles.heroContent, isLandscapeShort && styles.heroContentLandscape]}>
          <View style={[styles.posterThumb, isLandscapeShort && styles.posterThumbLandscape]}>
            {seriesPoster ? (
              <Image source={{ uri: seriesPoster }} style={styles.thumbImage} resizeMode="cover" />
            ) : (
              <ChannelLogo uri="" name={seriesTitle} size={isLandscapeShort ? 60 : 90} />
            )}
          </View>

          <View style={styles.heroInfo}>
            <Text
              style={[styles.seriesTitle, isLandscapeShort && styles.seriesTitleLandscape]}
              numberOfLines={isLandscapeShort ? 1 : 2}
            >
              {seriesTitle}
            </Text>

            <View style={styles.badgesRow}>
              {ratingNum > 0 ? (
                <View style={styles.ratingBadge}>
                  <MaterialIcons name="star" size={15} color="#eab308" />
                  <Text style={styles.ratingText}>{ratingNum.toFixed(1)}</Text>
                </View>
              ) : null}

              {seriesYear ? (
                <View style={styles.pillBadge}>
                  <Text style={styles.pillText}>{seriesYear}</Text>
                </View>
              ) : null}

              <View style={[styles.pillBadge, styles.categoryPill]}>
                <Text style={[styles.pillText, styles.categoryPillText]}>{seriesCategory}</Text>
              </View>

              <View style={styles.pillBadge}>
                <Text style={styles.pillText}>
                  {seasons.length > 0 ? `${seasons.length} مواسم` : 'مسلسل'}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  toggleFavorite({
                    id: params.id,
                    title: seriesTitle,
                    poster: seriesPoster,
                    backdrop: seriesBackdrop,
                    type: 'tv',
                    rating: ratingNum,
                    year: seriesYear,
                    overview: seriesOverview,
                    category: seriesCategory,
                    tmdbId: params.tmdbId ? Number(params.tmdbId) : undefined,
                    imdbId: params.imdbId,
                    originalLanguage: params.originalLanguage,
                  });
                }}
                style={({ focused }) => [
                  styles.favBtn,
                  isFavorite && styles.favBtnActive,
                  focused && styles.favBtnFocused,
                ]}
              >
                <MaterialIcons
                  name={isFavorite ? 'favorite' : 'favorite-border'}
                  size={15}
                  color={isFavorite ? '#ef4444' : '#ffffff'}
                />
                <Text style={[styles.favBtnText, isFavorite && styles.favBtnTextActive]}>
                  {isFavorite ? 'في المفضلة' : 'إضافة للمفضلة'}
                </Text>
              </Pressable>
            </View>

            {seriesOverview ? (
              <Text numberOfLines={isLandscapeShort ? 1 : 3} style={styles.overviewText}>
                {seriesOverview}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* 2. شريط اختيار المواسم (Glassmorphic Season Pills) */}
      <View style={styles.seasonsHeader}>
        <Text style={styles.sectionTitle}>المواسم والحلقات</Text>
        {seasons.length > 1 && (
          <View style={styles.seasonsContainer}>
            {seasons.map((s, idx) => {
              const isCurrent = s.season === selectedSeason;
              const isFocusedSeason = focusedSection === 'seasons' && focusedSeasonIndex === idx;
              return (
                <Pressable
                  key={`season-chip-${s.season}`}
                  onPress={() => {
                    setSelectedSeason(s.season);
                    setFocusedSeasonIndex(idx);
                    setFocusedSection('episodes');
                    setFocusedEpisodeIndex(0);
                  }}
                  style={({ focused }) => [
                    styles.seasonChip,
                    isCurrent && styles.seasonChipActive,
                    (isFocusedSeason || focused) && styles.seasonChipFocused,
                  ]}
                >
                  {({ focused }) => {
                    const active = isFocusedSeason || focused;
                    return (
                      <Text
                        style={[
                          styles.seasonChipText,
                          isCurrent && styles.seasonChipTextActive,
                          active && styles.seasonChipTextFocused,
                        ]}
                      >
                        الموسم {s.season}
                      </Text>
                    );
                  }}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* 3. شبكة الحلقات */}
      {isLoadingEpisodes ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>جاري جلب قائمة الحلقات من TVmaze...</Text>
        </View>
      ) : currentEpisodes.length === 0 ? (
        <View style={styles.emptyBox}>
          <MaterialIcons name="tv-off" size={60} color="#64748b" />
          <Text style={styles.emptyTitle}>لا تتوفر حلقات لهذا الموسم حالياً</Text>
        </View>
      ) : (
        <View style={styles.episodesGridWrap}>
          {currentEpisodes.map((item, idx) => {
            const isFocusedEp = focusedSection === 'episodes' && focusedEpisodeIndex === idx;
            return (
              <View
                key={`ep-${item.season}-${item.number}-${item.id}`}
                style={[styles.epCol, { width: epColWidth }]}
              >
                <Pressable
                  onPress={() => {
                    setFocusedSection('episodes');
                    setFocusedEpisodeIndex(idx);
                    handlePlayEpisode(item.season, item.number);
                  }}
                  style={({ focused }) => [
                    styles.epCard,
                    (isFocusedEp || focused) && styles.epCardFocused,
                  ]}
                >
                  {({ focused }) => {
                    const active = isFocusedEp || focused;
                    return (
                      <View style={styles.epCardInner}>
                        <View style={styles.epHeaderRow}>
                          <View style={styles.epNumberBadge}>
                            <Text style={styles.epNumberText}>الحلقة {item.number}</Text>
                          </View>
                          <MaterialIcons
                            name="play-circle-fill"
                            size={28}
                            color={active ? '#38bdf8' : '#64748b'}
                          />
                        </View>

                        <Text
                          numberOfLines={1}
                          style={[styles.epTitle, active && styles.epTitleFocused]}
                        >
                          {item.name}
                        </Text>

                        {item.summary ? (
                          <Text
                            numberOfLines={isLandscapeShort ? 1 : 2}
                            style={[styles.epSummary, active && styles.epSummaryFocused]}
                          >
                            {item.summary}
                          </Text>
                        ) : null}
                      </View>
                    );
                  }}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  heroSection: {
    width: '100%',
    height: 310,
    position: 'relative',
    backgroundColor: '#0b1120',
    overflow: 'hidden',
  },
  heroSectionLandscape: {
    height: 195,
  },
  heroBackdrop: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.45,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'linear-gradient(to bottom, rgba(15, 23, 42, 0.3) 0%, rgba(15, 23, 42, 0.95) 85%, #0f172a 100%)',
          backgroundColor: 'transparent',
        }
      : {}),
  },
  topBar: {
    position: 'absolute',
    top: 18,
    left: 24,
    right: 24,
    zIndex: 10,
  },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  backBtnFocused: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38bdf8',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  backBtnTextFocused: {
    color: '#38bdf8',
  },
  heroContent: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 22,
  },
  heroContentLandscape: {
    bottom: 10,
    left: 16,
    right: 16,
    gap: 14,
  },
  posterThumb: {
    width: 110,
    height: 165,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: '#0b1120',
  },
  posterThumbLandscape: {
    width: 72,
    height: 105,
    borderRadius: 8,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  heroInfo: {
    flex: 1,
    paddingBottom: 4,
  },
  seriesTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
  },
  seriesTitleLandscape: {
    fontSize: 20,
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  ratingText: {
    color: '#eab308',
    fontSize: 13,
    fontWeight: '800',
  },
  pillBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryPill: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    borderColor: '#7c3aed',
  },
  categoryPillText: {
    color: '#c084fc',
  },
  favBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  favBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.6)',
  },
  favBtnFocused: {
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  favBtnText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
  favBtnTextActive: {
    color: '#fca5a5',
  },
  overviewText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 720,
  },
  seasonsHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'right',
  },
  seasonsContainer: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 4,
    width: '100%',
  },
  seasonChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  seasonChipActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#38bdf8',
  },
  seasonChipFocused: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderColor: '#38bdf8',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  seasonChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  seasonChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  seasonChipTextFocused: {
    color: '#38bdf8',
    fontWeight: '900',
  },
  episodesGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    paddingBottom: 40,
  },
  episodesGrid: {
    padding: 16,
    paddingBottom: 40,
  },
  epCol: {
    padding: 8,
  },
  epCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 16,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  epCardFocused: {
    backgroundColor: 'rgba(30, 41, 59, 0.98)',
    borderColor: '#38bdf8',
    borderWidth: 2.5,
    transform: [{ scale: 1.03 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 14,
  },
  epCardInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  epHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  epNumberBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  epNumberText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800',
  },
  epTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'right',
  },
  epTitleFocused: {
    color: '#38bdf8',
  },
  epSummary: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'right',
  },
  epSummaryFocused: {
    color: '#cbd5e1',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
});
