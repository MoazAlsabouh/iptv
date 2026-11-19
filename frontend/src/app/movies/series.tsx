import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { ChannelLogo } from '../../components/ChannelLogo';
import { StreamSource } from '../../types/media';

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
  }>();

  const seriesTitle = useMemo(() => {
    if (!params.title) return 'تفاصيل المسلسل';
    return typeof params.title === 'string'
      ? decodeURIComponent(params.title)
      : params.title[0]
      ? decodeURIComponent(params.title[0])
      : 'تفاصيل المسلسل';
  }, [params.title]);

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

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/movies');
    }
  };

  useTVRemoteNavigation({
    onBack: handleGoBack,
  });

  // تشغيل الحلقة المختارة
  const handlePlayEpisode = (seasonNum: number, episodeNum: number) => {
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
  };

  // حلقات الموسم المختار
  const currentEpisodes = useMemo(() => {
    const found = seasons.find((s) => s.season === selectedSeason);
    return found?.episodes || [];
  }, [seasons, selectedSeason]);

  return (
    <View style={styles.container}>
      {/* 1. رأس سينمائي كبير (Hero Header) */}
      <View style={styles.heroSection}>
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
            style={({ focused }) => [styles.backBtn, focused && styles.backBtnFocused]}
          >
            {({ focused }) => (
              <View style={styles.btnRow}>
                <MaterialIcons
                  name="arrow-back"
                  size={22}
                  color={focused ? '#000000' : '#ffffff'}
                />
                <Text style={[styles.backBtnText, focused && styles.backBtnTextFocused]}>
                  العودة للأفلام والمسلسلات
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* تفاصيل العمل في مقدمة الهيرو */}
        <View style={styles.heroContent}>
          <View style={styles.posterThumb}>
            {seriesPoster ? (
              <Image source={{ uri: seriesPoster }} style={styles.thumbImage} resizeMode="cover" />
            ) : (
              <ChannelLogo uri="" name={seriesTitle} size={90} />
            )}
          </View>

          <View style={styles.heroInfo}>
            <Text style={styles.seriesTitle}>{seriesTitle}</Text>

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
            </View>

            {seriesOverview ? (
              <Text numberOfLines={3} style={styles.overviewText}>
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.seasonsScroll}
          >
            {seasons.map((s) => {
              const isCurrent = s.season === selectedSeason;
              return (
                <Pressable
                  key={`season-chip-${s.season}`}
                  onPress={() => setSelectedSeason(s.season)}
                  style={({ focused }) => [
                    styles.seasonChip,
                    isCurrent && styles.seasonChipActive,
                    focused && styles.seasonChipFocused,
                  ]}
                >
                  {({ focused }) => (
                    <Text
                      style={[
                        styles.seasonChipText,
                        isCurrent && styles.seasonChipTextActive,
                        focused && styles.seasonChipTextFocused,
                      ]}
                    >
                      الموسم {s.season}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
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
        <FlatList<EpisodeItem>
          data={currentEpisodes}
          keyExtractor={(item) => `ep-${item.season}-${item.number}-${item.id}`}
          numColumns={3}
          contentContainerStyle={styles.episodesGrid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.epCol}>
              <Pressable
                onPress={() => handlePlayEpisode(item.season, item.number)}
                style={({ focused }) => [styles.epCard, focused && styles.epCardFocused]}
              >
                {({ focused }) => (
                  <View style={styles.epCardInner}>
                    <View style={styles.epHeaderRow}>
                      <View style={styles.epNumberBadge}>
                        <Text style={styles.epNumberText}>الحلقة {item.number}</Text>
                      </View>
                      <MaterialIcons
                        name="play-circle-fill"
                        size={28}
                        color={focused ? '#0284c7' : '#38bdf8'}
                      />
                    </View>

                    <Text
                      numberOfLines={1}
                      style={[styles.epTitle, focused && styles.epTitleFocused]}
                    >
                      {item.name}
                    </Text>

                    {item.summary ? (
                      <Text
                        numberOfLines={2}
                        style={[styles.epSummary, focused && styles.epSummaryFocused]}
                      >
                        {item.summary}
                      </Text>
                    ) : null}
                  </View>
                )}
              </Pressable>
            </View>
          )}
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
  heroSection: {
    width: '100%',
    height: 310,
    position: 'relative',
    backgroundColor: '#0b1120',
    overflow: 'hidden',
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
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
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
    color: '#000000',
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
  posterThumb: {
    width: 110,
    height: 165,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: '#0b1120',
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
  overviewText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 720,
  },
  seasonsHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  seasonsScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
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
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  seasonChipFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.08 }],
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
    color: '#000000',
    fontWeight: '900',
  },
  episodesGrid: {
    padding: 16,
    paddingBottom: 40,
  },
  epCol: {
    flex: 1,
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
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.04 }],
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
    color: '#000000',
  },
  epSummary: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'right',
  },
  epSummaryFocused: {
    color: '#334155',
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
