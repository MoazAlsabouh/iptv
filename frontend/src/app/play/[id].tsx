import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeKeepAwake } from '../../hooks/useSafeKeepAwake';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useMediaData } from '../../hooks/useMediaData';
import { TVPlayer, HlsLevelOption } from '../../components/player/TVPlayer';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { ChannelLogo } from '../../components/ChannelLogo';
import { StreamSource } from '../../types/media';
import { useAuth } from '../../context/AuthContext';
import { shouldAutoProxy, getProxyStreamUrl } from '../../utils/proxy';

/**
 * شاشة مشغل الفيديو بتصميم ملء الشاشة الداكن والتحكم الكامل بالريموت كنترول.
 * تدعم التبديل السلس بين مصادر البث وجودات HLS.
 */
export function PlayerScreen(): React.JSX.Element {
  useSafeKeepAwake();

  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    url: string;
    title?: string;
    logo?: string;
    sources?: string;
    type?: string;
    tmdbId?: string;
    imdbId?: string;
    season?: string;
    episode?: string;
    lang?: string;
  }>();

  const { favoriteIds, toggleFavorite } = useAppStore();
  const { channels } = useMediaData();
  const { token } = useAuth();

  const channelId = useMemo(() => {
    if (!params.id) return '';
    return typeof params.id === 'string' ? params.id : params.id[0] || '';
  }, [params.id]);

  const isFavorite = useMemo(() => {
    return Boolean(channelId && favoriteIds.includes(channelId));
  }, [channelId, favoriteIds]);

  const rawStreamUrl = useMemo(() => {
    if (!params.url) return '';
    return typeof params.url === 'string'
      ? decodeURIComponent(params.url)
      : params.url[0]
      ? decodeURIComponent(params.url[0])
      : '';
  }, [params.url]);

  const channelTitle = useMemo(() => {
    if (!params.title) return '';
    return typeof params.title === 'string'
      ? decodeURIComponent(params.title)
      : params.title[0]
      ? decodeURIComponent(params.title[0])
      : '';
  }, [params.title]);

  const channelLogo = useMemo(() => {
    if (!params.logo) return '';
    return typeof params.logo === 'string'
      ? decodeURIComponent(params.logo)
      : params.logo[0]
      ? decodeURIComponent(params.logo[0])
      : '';
  }, [params.logo]);

  // دعم مواسم وحلقات المسلسلات
  const isTvSeries = useMemo(() => {
    return (
      params.type === 'tv' ||
      channelId.includes('-tv-') ||
      channelId.startsWith('tvm-')
    );
  }, [params.type, channelId]);

  // التحقق مما إذا كان المحتوى VOD (فيلم أو مسلسل)
  const isVod = useMemo(() => {
    return (
      params.type === 'movie' ||
      params.type === 'tv' ||
      Boolean(params.tmdbId || params.imdbId) ||
      channelId.startsWith('tmdb-') ||
      channelId.startsWith('tvm-')
    );
  }, [params.type, params.tmdbId, params.imdbId, channelId]);

  const initialSeason = params.season ? parseInt(params.season, 10) || 1 : 1;
  const initialEpisode = params.episode ? parseInt(params.episode, 10) || 1 : 1;

  const [seasons, setSeasons] = useState<{ season: number; episodes: any[] }[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(initialSeason);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(initialEpisode);
  const [showEpisodesModal, setShowEpisodesModal] = useState<boolean>(false);
  const [customSources, setCustomSources] = useState<StreamSource[] | null>(null);
  const [vodSources, setVodSources] = useState<StreamSource[] | null>(null);
  const [isLoadingSources, setIsLoadingSources] = useState<boolean>(false);

  useEffect(() => {
    if (!isTvSeries) return;

    let isMounted = true;
    const fetchEpisodes = async () => {
      try {
        const tmdbParam = params.tmdbId ? `&tmdbId=${encodeURIComponent(params.tmdbId)}` : '';
        const q = channelTitle ? encodeURIComponent(channelTitle) : '';
        const imdb = params.imdbId ? encodeURIComponent(params.imdbId) : '';
        const res = await fetch(
          `https://iptv-backend.moaznsm.workers.dev/api/vod/episodes?q=${q}&imdb=${imdb}${tmdbParam}`
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.seasons && Array.isArray(data.seasons) && data.seasons.length > 0) {
            setSeasons(data.seasons);
          }
        }
      } catch {
        // تجاهل
      }
    };

    fetchEpisodes();

    return () => {
      isMounted = false;
    };
  }, [isTvSeries, channelTitle, params.imdbId]);

  // جلب السيرفرات الهجينة من خادم /api/vod/sources للأفلام والمسلسلات تلقائياً
  useEffect(() => {
    if (!isVod) return;

    let isMounted = true;
    setIsLoadingSources(true);

    const fetchHybridSources = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (params.tmdbId) queryParams.set('tmdbId', params.tmdbId);
        if (params.imdbId) queryParams.set('imdbId', params.imdbId);

        // تنظيف العنوان لإزالة أي زوائد مواسم وحلقات قد تكون ملحقة بالعنوان
        let cleanTitle = channelTitle || '';
        cleanTitle = cleanTitle
          .replace(/\s*-\s*الموسم\s*\d+\s*الحلقة\s*\d+/g, '')
          .replace(/\s*-\s*الحلقة\s*\d+/g, '')
          .trim();
        if (cleanTitle) queryParams.set('title', cleanTitle);

        queryParams.set('type', isTvSeries ? 'tv' : 'movie');
        const effectiveLang = (params.lang || params.originalLanguage || 'en').toLowerCase();
        queryParams.set('lang', effectiveLang);
        queryParams.set('season', String(selectedSeason));
        queryParams.set('episode', String(selectedEpisode));

        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(
          `https://iptv-backend.moaznsm.workers.dev/api/vod/sources?${queryParams.toString()}`,
          { headers }
        );

        if (res.status === 401) {
          if (isMounted) {
            setIsLoadingSources(false);
            setPlaybackError('يرجى تفعيل كود اشتراك صالح للمشاهدة');
          }
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
              setVodSources(data.sources);
              setActiveSourceIndex(0);
              setIsBuffering(true);
              setPlaybackError(null);
              setRetryKey((prev) => prev + 1);
              setIsLoadingSources(false);
              return;
            } else {
              setVodSources([]);
              if (!rawStreamUrl) {
                setPlaybackError('عذراً، هذا العمل غير متوفر للمشاهدة حالياً');
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Player] Failed to load hybrid VOD sources:', err);
      }
      if (isMounted) {
        setIsLoadingSources(false);
      }
    };

    fetchHybridSources();

    return () => {
      isMounted = false;
    };
  }, [
    isVod,
    params.tmdbId,
    params.imdbId,
    channelTitle,
    isTvSeries,
    params.lang,
    params.originalLanguage,
    token,
    selectedSeason,
    selectedEpisode,
    params.type,
    channelId,
  ]);

  // مصادر البث المتعددة للقناة أو العمل
  const channelSources: StreamSource[] = useMemo(() => {
    if (vodSources && vodSources.length > 0) {
      return vodSources;
    }
    if (customSources && customSources.length > 0) {
      return customSources;
    }
    if (params.sources) {
      try {
        const raw = typeof params.sources === 'string' ? params.sources : params.sources[0];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // تجاهل
      }
    }
    const found = channels.find((c) => c.id === channelId);
    return found?.sources || [];
  }, [vodSources, customSources, params.sources, channels, channelId]);

  const [activeSourceIndex, setActiveSourceIndex] = useState<number>(0);
  const [hlsLevels, setHlsLevels] = useState<HlsLevelOption[]>([]);
  const [selectedHlsLevel, setSelectedHlsLevel] = useState<number>(-1);
  const [showQualityModal, setShowQualityModal] = useState<boolean>(false);
  const [isFetchingYouTube, setIsFetchingYouTube] = useState<boolean>(false);

  // اختيار حلقة معينة للمسلسلات
  const handleSelectEpisode = (seasonNum: number, episodeNum: number) => {
    setSelectedSeason(seasonNum);
    setSelectedEpisode(episodeNum);
    setShowEpisodesModal(false);
    setIsBuffering(true);
    setPlaybackError(null);
  };

  // إعادة تعيين مؤشر المصدر عند تغيير القناة
  useEffect(() => {
    setActiveSourceIndex(0);
    setPlaybackError(null);
    setIsBuffering(true);
  }, [channelId]);

  // رابط البث الفعلي بناءً على المصدر المختار
  const currentStreamUrl = useMemo(() => {
    let url = rawStreamUrl;
    if (channelSources.length > 0 && channelSources[activeSourceIndex]) {
      url = channelSources[activeSourceIndex].url;
    }
    // إذا كان الرابط ينتمي لنطاقات تفرض حظر 403 على المتصفحات، نوجهه مباشرة للبروكسي
    if (Platform.OS === 'web' && shouldAutoProxy(url)) {
      return getProxyStreamUrl(url);
    }
    return url;
  }, [channelSources, activeSourceIndex, rawStreamUrl]);

  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);

  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
  }, []);

  useEffect(() => {
    if (!showOverlay || showQualityModal || showEpisodesModal) return;

    const timer = setTimeout(() => {
      setShowOverlay(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [showOverlay, showQualityModal, showEpisodesModal]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  useTVRemoteNavigation({
    onBack: () => {
      if (showEpisodesModal) {
        setShowEpisodesModal(false);
      } else if (showQualityModal) {
        setShowQualityModal(false);
      } else {
        handleGoBack();
      }
    },
    onAnyKey: resetOverlayTimer,
  });

  const [switchToast, setSwitchToast] = useState<string | null>(null);

  // التبديل التلقائي للمصدر البديل عند حدوث خطأ
  const handlePlayerError = useCallback(
    (errorMsg: string) => {
      if (channelSources.length > 1 && activeSourceIndex + 1 < channelSources.length) {
        // يوجد مصدر تالٍ: ننتقل إليه تلقائياً مع إشعار صغير ومؤشر تحميل
        setSwitchToast('المصدر غير متاح، جاري الانتقال للمصدر التالي...');
        setTimeout(() => {
          setSwitchToast(null);
        }, 3500);

        setIsBuffering(true);
        setPlaybackError(null);
        setActiveSourceIndex((prev) => prev + 1);
      } else {
        // تم استنفاد جميع المصادر المتاحة أو لا توجد مصادر بديلة
        setIsBuffering(false);
        setSwitchToast(null);
        setPlaybackError('عذراً، هذا العمل غير متوفر للمشاهدة حالياً');
      }
    },
    [channelSources, activeSourceIndex]
  );

  const handleRetry = () => {
    setActiveSourceIndex(0);
    setPlaybackError(null);
    setIsBuffering(true);
    setRetryKey((prev) => prev + 1);
    resetOverlayTimer();
  };

  // التحقق مما إذا كان المصدر الحالي يعمل عبر يوتيوب
  const isYouTubeActive = useMemo(() => {
    if (!currentStreamUrl) return false;
    const lower = currentStreamUrl.toLowerCase();
    const activeSource = channelSources[activeSourceIndex];
    const labelLower = activeSource?.label?.toLowerCase() || '';
    return (
      lower.includes('youtube.com') ||
      lower.includes('youtu.be') ||
      labelLower.includes('يوتيوب') ||
      labelLower.includes('youtube')
    );
  }, [currentStreamUrl, channelSources, activeSourceIndex]);

  // التبديل السريع والبحث في يوتيوب عند تعطل السيرفر
  const handleSwitchToYouTube = useCallback(async () => {
    if (isFetchingYouTube) return;

    // 1. إذا كان يوتيوب موجوداً بالفعل ضمن قائمة السيرفرات الحالية، ننتقل إليه مباشرة
    const ytIndex = channelSources.findIndex(
      (s) =>
        s.label.includes('يوتيوب') ||
        s.label.toLowerCase().includes('youtube') ||
        s.url.includes('youtube.com') ||
        s.url.includes('youtu.be')
    );

    if (ytIndex >= 0 && ytIndex !== activeSourceIndex) {
      setSwitchToast('جاري التبديل إلى مشغل يوتيوب...');
      setTimeout(() => setSwitchToast(null), 3000);
      setActiveSourceIndex(ytIndex);
      setIsBuffering(true);
      setPlaybackError(null);
      setRetryKey((prev) => prev + 1);
      return;
    }

    // 2. إذا لم يكن يوتيوب ضمن القائمة، نطلبه صراحة من الخادم عبر force_youtube=1
    setIsFetchingYouTube(true);
    setSwitchToast('جاري البحث عن بديل في يوتيوب...');

    try {
      const queryParams = new URLSearchParams();
      if (params.tmdbId) queryParams.set('tmdbId', params.tmdbId);
      if (params.imdbId) queryParams.set('imdbId', params.imdbId);

      let cleanTitle = channelTitle || '';
      cleanTitle = cleanTitle
        .replace(/\s*-\s*الموسم\s*\d+\s*الحلقة\s*\d+/g, '')
        .replace(/\s*-\s*الحلقة\s*\d+/g, '')
        .trim();
      if (cleanTitle) queryParams.set('title', cleanTitle);

      queryParams.set('type', isTvSeries ? 'tv' : 'movie');
      const effectiveLang = (params.lang || params.originalLanguage || 'en').toLowerCase();
      queryParams.set('lang', effectiveLang);
      queryParams.set('season', String(selectedSeason));
      queryParams.set('episode', String(selectedEpisode));
      queryParams.set('force_youtube', '1');

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(
        `https://iptv-backend.moaznsm.workers.dev/api/vod/sources?${queryParams.toString()}`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
          setVodSources(data.sources);
          setActiveSourceIndex(0);
          setIsBuffering(true);
          setPlaybackError(null);
          setRetryKey((prev) => prev + 1);
          setSwitchToast('تم التبديل لمصدر يوتيوب بنجاح!');
          setTimeout(() => setSwitchToast(null), 3500);
          setIsFetchingYouTube(false);
          return;
        }
      }
      setSwitchToast('عذراً، لم يتم العثور على بديل في يوتيوب لهذا العمل');
      setTimeout(() => setSwitchToast(null), 3500);
    } catch (err) {
      console.warn('[Player] Failed to force YouTube fallback:', err);
      setSwitchToast('فشل الاتصال، يرجى إعادة المحاولة');
      setTimeout(() => setSwitchToast(null), 3000);
    } finally {
      setIsFetchingYouTube(false);
    }
  }, [
    isFetchingYouTube,
    channelSources,
    activeSourceIndex,
    params.tmdbId,
    params.imdbId,
    channelTitle,
    isTvSeries,
    params.lang,
    params.originalLanguage,
    selectedSeason,
    selectedEpisode,
    token,
  ]);

  const hasMultiQuality = channelSources.length > 1 || hlsLevels.length > 1;

  return (
    <View style={styles.rootContainer}>
      {/* 1. مشغل الفيديو HLS */}
      {currentStreamUrl && !playbackError ? (
        <TVPlayer
          key={`tv-player-${retryKey}-${activeSourceIndex}`}
          streamUrl={currentStreamUrl}
          selectedLevel={selectedHlsLevel}
          onLevelsLoaded={(levels) => setHlsLevels(levels)}
          style={StyleSheet.absoluteFillObject}
          onBuffering={(buffering) => setIsBuffering(buffering)}
          onError={handlePlayerError}
        />
      ) : !currentStreamUrl ? (
        <View style={styles.noUrlBox}>
          <MaterialIcons name="link-off" size={64} color="#ef4444" />
          <Text style={styles.noUrlText}>رابط تشغيل القناة غير متوفر</Text>
        </View>
      ) : null}

      {/* مؤشر جلب السيرفرات الهجينة الذكية */}
      {isLoadingSources && (
        <View style={styles.loadingSourcesOverlay}>
          <ActivityIndicator size="small" color="#38bdf8" />
          <Text style={styles.loadingSourcesText}>
            جاري جلب أفضل سيرفرات المشاهدة...
          </Text>
        </View>
      )}

      {/* 2. طبقة حساسة للنقر لاستعادة الواجهة عند اختفائها */}
      {!showOverlay && !playbackError && !showQualityModal && (
        <Pressable
          hasTVPreferredFocus
          onPress={resetOverlayTimer}
          style={StyleSheet.absoluteFillObject}
        >
          <View style={StyleSheet.absoluteFillObject} />
        </Pressable>
      )}

      {/* 3. عناصر التحكم العائمة العلوية */}
      {showOverlay && !playbackError && (
        <View style={styles.overlayBar}>
          <View style={styles.controlsRow}>
            {/* زر الخروج */}
            <Pressable
              hasTVPreferredFocus={!showQualityModal}
              onPress={handleGoBack}
              style={({ focused }) => [
                styles.overlayBtn,
                focused && styles.overlayBtnFocused,
              ]}
            >
              {({ focused }) => (
                <View style={styles.btnRow}>
                  <MaterialIcons
                    name="arrow-back"
                    size={22}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text style={[styles.overlayBtnText, focused && styles.overlayBtnTextFocused]}>
                    خروج
                  </Text>
                </View>
              )}
            </Pressable>

            {/* عنوان وشعار القناة أو العمل */}
            {channelTitle ? (
              <View style={styles.titleBadge}>
                <ChannelLogo
                  uri={channelLogo}
                  name={channelTitle}
                  size={26}
                  style={styles.playerChannelLogo}
                />
                <Text numberOfLines={1} style={styles.titleBadgeText}>
                  {channelTitle}
                  {isTvSeries && seasons.length > 0
                    ? ` (الموسم ${selectedSeason} • حلقة ${selectedEpisode})`
                    : ''}
                </Text>
              </View>
            ) : null}

            {/* زر اختيار المواسم والحلقات للمسلسلات */}
            {isTvSeries && seasons.length > 0 ? (
              <Pressable
                onPress={() => {
                  setShowEpisodesModal(true);
                  resetOverlayTimer();
                }}
                style={({ focused }) => [
                  styles.episodesBtn,
                  focused && styles.overlayBtnFocused,
                ]}
              >
                {({ focused }) => (
                  <View style={styles.btnRow}>
                    <MaterialIcons
                      name="video-library"
                      size={20}
                      color={focused ? '#000000' : '#c084fc'}
                    />
                    <Text
                      style={[
                        styles.episodesBtnText,
                        focused && styles.overlayBtnTextFocused,
                      ]}
                    >
                      الحلقات (S{selectedSeason}E{selectedEpisode})
                    </Text>
                  </View>
                )}
              </Pressable>
            ) : null}

            {/* زر البديل السريع للبحث في يوتيوب عند تعطل السيرفر */}
            {isVod && !isYouTubeActive ? (
              <Pressable
                onPress={() => {
                  handleSwitchToYouTube();
                  resetOverlayTimer();
                }}
                disabled={isFetchingYouTube}
                style={({ focused }) => [
                  styles.youtubeFallbackBtn,
                  focused && styles.overlayBtnFocused,
                  isFetchingYouTube && { opacity: 0.7 },
                ]}
              >
                {({ focused }) => (
                  <View style={styles.btnRow}>
                    {isFetchingYouTube ? (
                      <ActivityIndicator size="small" color="#f87171" />
                    ) : (
                      <MaterialIcons
                        name="smart-display"
                        size={18}
                        color={focused ? '#000000' : '#f87171'}
                      />
                    )}
                    <Text
                      style={[
                        styles.youtubeFallbackBtnText,
                        focused && styles.overlayBtnTextFocused,
                      ]}
                    >
                      {isFetchingYouTube ? 'جاري البحث...' : 'السيرفر لا يعمل؟ بحث في يوتيوب'}
                    </Text>
                  </View>
                )}
              </Pressable>
            ) : null}

            {/* زر الجودة والمصادر / السيرفرات */}
            {hasMultiQuality ? (
              <Pressable
                onPress={() => {
                  setShowQualityModal(true);
                  resetOverlayTimer();
                }}
                style={({ focused }) => [
                  styles.qualityBtn,
                  focused && styles.overlayBtnFocused,
                ]}
              >
                {({ focused }) => (
                  <View style={styles.btnRow}>
                    <MaterialIcons
                      name="tune"
                      size={20}
                      color={focused ? '#000000' : '#38bdf8'}
                    />
                    <Text style={[styles.qualityBtnText, focused && styles.overlayBtnTextFocused]}>
                      السيرفرات / الجودة
                    </Text>
                  </View>
                )}
              </Pressable>
            ) : null}

            {/* زر المفضلة */}
            {channelId ? (
              <Pressable
                onPress={() => {
                  toggleFavorite({
                    id: channelId,
                    title: channelTitle,
                    name: channelTitle,
                    logo: channelLogo,
                    poster: channelLogo,
                    url: rawStreamUrl,
                    type: isVod ? (isTvSeries ? 'tv' : 'movie') : 'channel',
                    tmdbId: params.tmdbId ? Number(params.tmdbId) : undefined,
                    imdbId: params.imdbId,
                    season: selectedSeason,
                    episode: selectedEpisode,
                  });
                  resetOverlayTimer();
                }}
                style={({ focused }) => [
                  styles.favoriteBtn,
                  isFavorite && styles.favoriteBtnActive,
                  focused && styles.overlayBtnFocused,
                ]}
              >
                {({ focused }) => (
                  <View style={styles.btnRow}>
                    <MaterialIcons
                      name={isFavorite ? 'star' : 'star-border'}
                      size={22}
                      color={
                        focused
                          ? '#000000'
                          : isFavorite
                          ? '#eab308'
                          : '#ffffff'
                      }
                    />
                    <Text
                      style={[
                        styles.favoriteText,
                        isFavorite && styles.favoriteTextActive,
                        focused && styles.overlayBtnTextFocused,
                      ]}
                    >
                      {isFavorite ? 'مفضلة' : 'إضافة للمفضلة'}
                    </Text>
                  </View>
                )}
              </Pressable>
            ) : null}
          </View>

          <View style={styles.helpHint}>
            <Text style={styles.helpHintText}>الأسهم و OK للتحكم</Text>
          </View>
        </View>
      )}

      {/* 4. قائمة التبديل بين الجودات والمصادر (Modal / Overlay) */}
      {showQualityModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MaterialIcons name="settings-input-antenna" size={24} color="#38bdf8" />
                <Text style={styles.modalTitle}>إعدادات البث والجودة</Text>
              </View>
              <Text style={styles.modalSub}>{channelTitle}</Text>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* قسم 1: مصادر وروابط البث المختلفة للقناة */}
              {channelSources.length > 1 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionHeader}>مصادر البث المتاحة:</Text>
                  <View style={styles.optionsWrap}>
                    {channelSources.map((src, idx) => {
                      const isCurrentSource = idx === activeSourceIndex;
                      const isYouTube =
                        src.label.includes('يوتيوب') || src.url.includes('youtube');
                      const isDailymotion =
                        src.label.includes('ديلي موشن') || src.url.includes('dailymotion');
                      const isArchive =
                        src.label.includes('أرشيف') || src.url.includes('archive.org');
                      const isDirect = src.label.includes('مباشر');

                      return (
                        <Pressable
                          key={`source-${idx}`}
                          hasTVPreferredFocus={isCurrentSource}
                          onPress={() => {
                            setActiveSourceIndex(idx);
                            setIsBuffering(true);
                            setPlaybackError(null);
                          }}
                          style={({ focused }) => [
                            styles.optionChip,
                            isCurrentSource && styles.optionChipActive,
                            focused && styles.optionChipFocused,
                          ]}
                        >
                          {({ focused }) => (
                            <View style={styles.optionContent}>
                              {isCurrentSource ? (
                                <MaterialIcons
                                  name="check"
                                  size={18}
                                  color={focused ? '#000000' : '#38bdf8'}
                                />
                              ) : isYouTube ? (
                                <MaterialIcons
                                  name="ondemand-video"
                                  size={18}
                                  color={focused ? '#000000' : '#ef4444'}
                                />
                              ) : isDailymotion ? (
                                <MaterialIcons
                                  name="video-collection"
                                  size={18}
                                  color={focused ? '#000000' : '#0066dc'}
                                />
                              ) : isArchive ? (
                                <MaterialIcons
                                  name="cloud-download"
                                  size={18}
                                  color={focused ? '#000000' : '#38bdf8'}
                                />
                              ) : isDirect ? (
                                <MaterialIcons
                                  name="videocam"
                                  size={18}
                                  color={focused ? '#000000' : '#10b981'}
                                />
                              ) : (
                                <MaterialIcons
                                  name="dns"
                                  size={18}
                                  color={focused ? '#000000' : '#c084fc'}
                                />
                              )}
                              <Text
                                style={[
                                  styles.optionText,
                                  isCurrentSource && styles.optionTextActive,
                                  focused && styles.optionTextFocused,
                                ]}
                              >
                                {src.label}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* قسم 2: مستويات جودة البث المتوفرة */}
              {hlsLevels.length > 1 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionHeader}>خيارات جودة البث:</Text>
                  <View style={styles.optionsWrap}>
                    {hlsLevels.map((lvl) => {
                      const isCurrentLevel = lvl.id === selectedHlsLevel;
                      return (
                        <Pressable
                          key={`hls-lvl-${lvl.id}`}
                          onPress={() => setSelectedHlsLevel(lvl.id)}
                          style={({ focused }) => [
                            styles.optionChip,
                            isCurrentLevel && styles.optionChipActive,
                            focused && styles.optionChipFocused,
                          ]}
                        >
                          {({ focused }) => (
                            <View style={styles.optionContent}>
                              {isCurrentLevel && (
                                <MaterialIcons
                                  name="check"
                                  size={18}
                                  color={focused ? '#000000' : '#38bdf8'}
                                />
                              )}
                              <Text
                                style={[
                                  styles.optionText,
                                  isCurrentLevel && styles.optionTextActive,
                                  focused && styles.optionTextFocused,
                                ]}
                              >
                                {lvl.label}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* زر إغلاق القائمة */}
            <Pressable
              onPress={() => setShowQualityModal(false)}
              style={({ focused }) => [
                styles.modalCloseBtn,
                focused && styles.modalCloseBtnFocused,
              ]}
            >
              {({ focused }) => (
                <View style={styles.btnRow}>
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text
                    style={[
                      styles.modalCloseBtnText,
                      focused && styles.modalCloseBtnTextFocused,
                    ]}
                  >
                    حفظ ومتابعة المشاهدة
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* 4.ب. قائمة المواسم والحلقات للمسلسلات */}
      {showEpisodesModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MaterialIcons name="video-library" size={24} color="#c084fc" />
                <Text style={styles.modalTitle}>المواسم والحلقات</Text>
              </View>
              <Text style={styles.modalSub}>{channelTitle}</Text>
            </View>

            {/* أزرار اختيار الموسم */}
            {seasons.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ maxHeight: 52, marginBottom: 14 }}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
              >
                {seasons.map((s) => {
                  const isCurrent = s.season === selectedSeason;
                  return (
                    <Pressable
                      key={`season-tab-${s.season}`}
                      onPress={() => setSelectedSeason(s.season)}
                      style={[
                        styles.optionChip,
                        isCurrent && { backgroundColor: '#7c3aed', borderColor: '#c084fc' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          isCurrent && { color: '#ffffff', fontWeight: '800' },
                        ]}
                      >
                        الموسم {s.season}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* قائمة حلقات الموسم المختار */}
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.optionsWrap}>
                {seasons
                  .find((s) => s.season === selectedSeason)
                  ?.episodes.map((ep) => {
                    const isCurrentEp =
                      selectedSeason === ep.season && selectedEpisode === ep.number;
                    return (
                      <Pressable
                        key={`ep-${ep.season}-${ep.number}`}
                        hasTVPreferredFocus={isCurrentEp}
                        onPress={() => handleSelectEpisode(ep.season, ep.number)}
                        style={({ focused }) => [
                          styles.optionChip,
                          isCurrentEp && { backgroundColor: '#7c3aed', borderColor: '#c084fc' },
                          focused && styles.optionChipFocused,
                        ]}
                      >
                        {({ focused }) => (
                          <View style={styles.optionContent}>
                            {isCurrentEp && (
                              <MaterialIcons
                                name="play-circle-filled"
                                size={18}
                                color={focused ? '#000000' : '#c084fc'}
                              />
                            )}
                            <Text
                              style={[
                                styles.optionText,
                                isCurrentEp && styles.optionTextActive,
                                focused && styles.optionTextFocused,
                              ]}
                            >
                              الحلقة {ep.number}: {ep.name}
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
              </View>
            </ScrollView>

            {/* زر إغلاق */}
            <Pressable
              onPress={() => setShowEpisodesModal(false)}
              style={({ focused }) => [
                styles.modalCloseBtn,
                focused && styles.modalCloseBtnFocused,
              ]}
            >
              <Text style={styles.modalCloseBtnText}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* إشعار الانتقال التلقائي للمصدر التالي */}
      {switchToast && (
        <View style={styles.switchToastBadge} pointerEvents="none">
          <ActivityIndicator size="small" color="#38bdf8" />
          <Text style={styles.switchToastText}>{switchToast}</Text>
        </View>
      )}

      {/* 5. مؤشر التحميل المؤقت */}
      {isBuffering && !playbackError && currentStreamUrl ? (
        <View style={styles.bufferingContainer} pointerEvents="none">
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.bufferingText}>
            {activeSourceIndex > 0
              ? 'جاري الاتصال بمصدر بث بديل...'
              : 'جاري تهيئة البث المباشر...'}
          </Text>
        </View>
      ) : null}

      {/* 6. واجهة الخطأ مع أزرار التحكم المتوافقة مع ريموت التلفاز */}
      {playbackError ? (
        <View style={styles.errorOverlay}>
          <MaterialIcons name="videocam-off" size={68} color="#ef4444" />
          <Text style={styles.errorTitle}>
            {isVod
              ? 'عذراً، هذا العمل غير متوفر للمشاهدة حالياً'
              : 'تعذر تشغيل البث المباشر'}
          </Text>
          <Text style={styles.errorDesc}>
            {isVod
              ? 'لم يتم العثور على مصادر بث صالحة أو تعذر تشغيل كافة المصادر المتوفرة لهذا العمل.'
              : playbackError.includes('HLS') || playbackError.includes('hls')
              ? 'تعذر تشغيل هذا البث حالياً، يرجى اختيار مصدر آخر أو إعادة المحاولة'
              : playbackError}
          </Text>

          <View style={styles.errorActions}>
            <Pressable
              hasTVPreferredFocus
              onPress={handleGoBack}
              style={({ focused }) => [
                styles.backToListBtn,
                { backgroundColor: '#0284c7' },
                focused && styles.overlayBtnFocused,
              ]}
            >
              {({ focused }) => (
                <View style={styles.btnRow}>
                  <MaterialIcons
                    name="arrow-back"
                    size={20}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text style={[styles.backToListText, focused && styles.overlayBtnTextFocused]}>
                    رجوع
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={handleRetry}
              style={({ focused }) => [
                styles.retryBtn,
                { backgroundColor: '#334155' },
                focused && styles.overlayBtnFocused,
              ]}
            >
              {({ focused }) => (
                <View style={styles.btnRow}>
                  <MaterialIcons
                    name="refresh"
                    size={20}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text style={[styles.retryBtnText, focused && styles.overlayBtnTextFocused]}>
                    إعادة المحاولة
                  </Text>
                </View>
              )}
            </Pressable>

            {isVod && !isYouTubeActive && (
              <Pressable
                onPress={handleSwitchToYouTube}
                disabled={isFetchingYouTube}
                style={({ focused }) => [
                  styles.youtubeFallbackBtn,
                  styles.errorYoutubeBtn,
                  focused && styles.overlayBtnFocused,
                  isFetchingYouTube && { opacity: 0.7 },
                ]}
              >
                {({ focused }) => (
                  <View style={styles.btnRow}>
                    {isFetchingYouTube ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <MaterialIcons
                        name="smart-display"
                        size={20}
                        color={focused ? '#000000' : '#ffffff'}
                      />
                    )}
                    <Text
                      style={[
                        styles.youtubeFallbackBtnText,
                        { color: focused ? '#000000' : '#ffffff', fontSize: 14 },
                        focused && styles.overlayBtnTextFocused,
                      ]}
                    >
                      {isFetchingYouTube ? 'جاري البحث في يوتيوب...' : 'البحث والتشغيل من يوتيوب'}
                    </Text>
                  </View>
                )}
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 36,
    paddingBottom: 24,
    paddingHorizontal: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    zIndex: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  overlayBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 30,
  },
  overlayBtnFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.08 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 10,
  },
  overlayBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  overlayBtnTextFocused: {
    color: '#000000',
    fontWeight: '800',
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 30,
    maxWidth: 360,
    gap: 10,
  },
  playerChannelLogo: {
    borderRadius: 8,
  },
  titleBadgeText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  youtubeFallbackBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
  },
  youtubeFallbackBtnText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
  errorYoutubeBtn: {
    backgroundColor: '#dc2626',
    borderColor: '#ef4444',
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  episodesBtn: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    borderWidth: 1.5,
    borderColor: '#7c3aed',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
  },
  episodesBtnText: {
    color: '#c084fc',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  qualityBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
  },
  qualityBtnText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  favoriteBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 30,
  },
  favoriteBtnActive: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderColor: '#eab308',
  },
  favoriteText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  favoriteTextActive: {
    color: '#facc15',
  },
  helpHint: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  helpHintText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    width: '100%',
    maxWidth: 560,
    maxHeight: '80%',
    padding: 28,
  },
  modalHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 16,
    marginBottom: 20,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalSub: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 12,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  optionChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  optionChipFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  optionTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  optionTextFocused: {
    color: '#000000',
    fontWeight: '900',
  },
  modalCloseBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnFocused: {
    backgroundColor: '#ffffff',
    transform: [{ scale: 1.04 }],
    shadowColor: '#ffffff',
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  modalCloseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalCloseBtnTextFocused: {
    color: '#000000',
  },
  bufferingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  bufferingText: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  loadingSourcesOverlay: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 80,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  loadingSourcesText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  switchToastBadge: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 90,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  switchToastText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  noUrlBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noUrlText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    zIndex: 20,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  errorDesc: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 480,
    marginVertical: 12,
  },
  errorActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 16,
  },
  retryBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  backToListBtn: {
    backgroundColor: '#334155',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backToListText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * مكون ErrorBoundary لحماية صفحة المشغل من الانهيار المفاجئ أو الشاشة البيضاء
 */
class PlayerErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[PlayerErrorBoundary] Uncaught player error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <PlayerCrashFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * واجهة خطأ بديلة متوافقة مع التلفاز وأجهزة التحكم عند حدوث استثناء غير معالج
 */
function PlayerCrashFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  const router = useRouter();

  return (
    <View style={fallbackStyles.container}>
      <MaterialIcons name="error-outline" size={72} color="#ef4444" />
      <Text style={fallbackStyles.title}>حدث خطأ غير متوقع في المشغل</Text>
      <Text style={fallbackStyles.message}>
        {error?.message || 'تعذر تشغيل المشغل حالياً. يمكنك إعادة المحاولة أو العودة لقائمة القنوات.'}
      </Text>

      <View style={fallbackStyles.actions}>
        <Pressable
          hasTVPreferredFocus
          onPress={() => router.replace('/home')}
          style={({ focused }) => [
            fallbackStyles.btn,
            fallbackStyles.primaryBtn,
            focused && fallbackStyles.btnFocused,
          ]}
        >
          {({ focused }) => (
            <View style={fallbackStyles.btnContent}>
              <MaterialIcons
                name="arrow-back"
                size={20}
                color={focused ? '#000000' : '#ffffff'}
              />
              <Text style={[fallbackStyles.btnText, focused && fallbackStyles.btnTextFocused]}>
                العودة للقنوات
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={onRetry}
          style={({ focused }) => [
            fallbackStyles.btn,
            fallbackStyles.secondaryBtn,
            focused && fallbackStyles.btnFocused,
          ]}
        >
          {({ focused }) => (
            <View style={fallbackStyles.btnContent}>
              <MaterialIcons
                name="refresh"
                size={20}
                color={focused ? '#000000' : '#ffffff'}
              />
              <Text style={[fallbackStyles.btnText, focused && fallbackStyles.btnTextFocused]}>
                إعادة المحاولة
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const fallbackStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    color: '#ef4444',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  message: {
    color: '#94a3b8',
    fontSize: 15,
    marginTop: 10,
    marginBottom: 24,
    textAlign: 'center',
    maxWidth: 480,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryBtn: {
    backgroundColor: '#0284c7',
  },
  secondaryBtn: {
    backgroundColor: '#334155',
  },
  btnFocused: {
    backgroundColor: '#38bdf8',
    transform: [{ scale: 1.05 }],
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  btnTextFocused: {
    color: '#000000',
  },
});

export default function SafePlayerScreen() {
  return (
    <PlayerErrorBoundary>
      <PlayerScreen />
    </PlayerErrorBoundary>
  );
}

