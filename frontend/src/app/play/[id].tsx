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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeKeepAwake } from '../../hooks/useSafeKeepAwake';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useMediaData } from '../../hooks/useMediaData';
import { TVPlayer, HlsLevelOption, toYouTubeEmbedUrl } from '../../components/player/TVPlayer';
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
  const insets = useSafeAreaInsets();

  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    url: string;
    title?: string;
    logo?: string;
    sources?: string;
    type?: string;
    category?: string;
    tmdbId?: string;
    imdbId?: string;
    season?: string;
    episode?: string;
    lang?: string;
    originalLanguage?: string;
  }>();

  const { favoriteIds, toggleFavorite } = useAppStore();
  const { channels, categories, countries, networks, totalChannels } = useMediaData();
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
          queryParams.set('token', token);
        }

        const res = await fetch(
          `https://iptv-backend.moaznsm.workers.dev/api/vod/sources?${queryParams.toString()}`,
          { headers }
        );

        if (res.status === 401 || res.status === 403) {
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

  // 1. القناة الحية النشطة (تدعم التبديل اللحظي بالريموت Zapping والقائمة الجانبية)
  const [liveChannel, setLiveChannel] = useState<MediaItem | null>(() => {
    if (channels && channels.length > 0 && channelId) {
      const found = channels.find((c) => c.id === channelId);
      if (found) return found;
    }
    return null;
  });

  useEffect(() => {
    if (!liveChannel && channels && channels.length > 0 && channelId) {
      const found = channels.find((c) => c.id === channelId);
      if (found) setLiveChannel(found);
    }
  }, [channels, channelId, liveChannel]);

  const effectiveChannelId = liveChannel ? liveChannel.id : channelId;
  const effectiveTitle = liveChannel ? liveChannel.name : channelTitle;
  const effectiveLogo = liveChannel ? (liveChannel.logo || '') : channelLogo;

  // 2. سياق القسم النشط للتنقل السريع (Zapping)
  const [activeCategoryName, setActiveCategoryName] = useState<string>(() => {
    if (params.category) return decodeURIComponent(params.category);
    return 'جميع القنوات';
  });
  const [activeCategoryType, setActiveCategoryType] = useState<
    'favorites' | 'all' | 'network' | 'country' | 'category'
  >('all');

  // 3. بناء قائمة المجموعات بشكل ديناميكي مرن (Dynamic Categories/Groups)
  const navGroups = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'favorites' | 'all' | 'network' | 'country' | 'category';
      name: string;
      icon: keyof typeof MaterialIcons.glyphMap;
      count: number;
      channels?: MediaItem[];
    }> = [];

    list.push({
      id: 'favorites',
      type: 'favorites',
      name: 'المفضلة',
      icon: 'star',
      count: favoriteIds.length,
    });

    list.push({
      id: 'all',
      type: 'all',
      name: 'جميع القنوات',
      icon: 'live-tv',
      count: totalChannels || channels.length,
    });

    if (networks && networks.length > 0) {
      networks.forEach((net) => {
        list.push({
          id: `net-${net.name}`,
          type: 'network',
          name: net.name,
          icon: 'hub',
          count: net.count,
          channels: net.channels,
        });
      });
    }

    if (countries && countries.length > 0) {
      countries.forEach((country) => {
        if (country.name && country.name !== 'أفلام عالمية' && country.name !== 'أفلام رائجة') {
          list.push({
            id: `country-${country.name}`,
            type: 'country',
            name: country.name,
            icon: 'flag',
            count: country.count,
          });
        }
      });
    }

    if (categories && categories.length > 0) {
      categories.forEach((cat) => {
        if (cat.name && cat.name !== 'أفلام عالمية' && cat.name !== 'أفلام رائجة') {
          list.push({
            id: `cat-${cat.name}`,
            type: 'category',
            name: cat.name,
            icon: 'folder',
            count: cat.count,
          });
        }
      });
    }

    return list;
  }, [favoriteIds.length, totalChannels, channels.length, networks, countries, categories]);

  // 4. قنوات القسم النشط للـ Zapping
  const activeChannelList = useMemo<MediaItem[]>(() => {
    if (!channels || channels.length === 0) return [];

    if (activeCategoryType === 'favorites') {
      return channels.filter((ch) => favoriteIds.includes(ch.id));
    }
    if (activeCategoryType === 'all') {
      return channels;
    }
    if (activeCategoryType === 'network') {
      const net = networks.find((n) => n.name === activeCategoryName);
      return net ? net.channels : [];
    }
    if (activeCategoryType === 'country') {
      return channels.filter(
        (ch) => (ch.country ? ch.country.trim() : 'قنوات عامة') === activeCategoryName
      );
    }
    if (activeCategoryType === 'category') {
      return channels.filter(
        (ch) => (ch.groupTitle ? ch.groupTitle.trim() : 'قنوات عامة ومنوعة') === activeCategoryName
      );
    }
    const byGroup = channels.filter(
      (ch) => ch.groupTitle && ch.groupTitle.trim() === activeCategoryName
    );
    if (byGroup.length > 0) return byGroup;
    return channels;
  }, [channels, networks, activeCategoryType, activeCategoryName, favoriteIds]);

  // 5. شريط معلومات التبديل السريع (Zapping Banner)
  const [zapBanner, setZapBanner] = useState<{
    visible: boolean;
    channel: MediaItem;
    numberStr: string;
  } | null>(null);
  const zapTimeoutRef = useRef<any>(null);

  const showZapBanner = useCallback((ch: MediaItem, numStr: string) => {
    if (zapTimeoutRef.current) {
      clearTimeout(zapTimeoutRef.current);
    }
    setZapBanner({ visible: true, channel: ch, numberStr: numStr });
    zapTimeoutRef.current = setTimeout(() => {
      setZapBanner(null);
    }, 3000);
  }, []);

  // 6. دالة التبديل اللحظي للقناة دون انقطاع البث
  const switchLiveChannel = useCallback(
    (ch: MediaItem) => {
      setLiveChannel(ch);
      setActiveSourceIndex(0);
      setPlaybackError(null);
      setIsBuffering(true);
      setRetryKey((k) => k + 1);

      const idx = activeChannelList.findIndex((c) => c.id === ch.id);
      const numStr = String(idx >= 0 ? idx + 1 : 1).padStart(3, '0');
      showZapBanner(ch, numStr);
    },
    [activeChannelList, showZapBanner]
  );

  // 7. دوال الـ Zapping للقناة التالية والسابقة
  const handleZapNext = useCallback(() => {
    if (isVod || activeChannelList.length <= 1) return;
    const currentIdx = activeChannelList.findIndex((c) => c.id === effectiveChannelId);
    const nextIdx = (currentIdx + 1) % activeChannelList.length;
    const nextCh = activeChannelList[nextIdx];
    switchLiveChannel(nextCh);
  }, [isVod, activeChannelList, effectiveChannelId, switchLiveChannel]);

  const handleZapPrev = useCallback(() => {
    if (isVod || activeChannelList.length <= 1) return;
    const currentIdx = activeChannelList.findIndex((c) => c.id === effectiveChannelId);
    const prevIdx = (currentIdx - 1 + activeChannelList.length) % activeChannelList.length;
    const prevCh = activeChannelList[prevIdx];
    switchLiveChannel(prevCh);
  }, [isVod, activeChannelList, effectiveChannelId, switchLiveChannel]);

  // 8. القائمة المتداخلة الشفافة فوق البث (Hierarchical Overlay Menu)
  const [showSideMenu, setShowSideMenu] = useState<boolean>(false);
  const [sideMenuLevel, setSideMenuLevel] = useState<'channels' | 'categories'>('channels');

  // مصادر البث المتعددة للقناة أو العمل
  const channelSources: StreamSource[] = useMemo(() => {
    if (vodSources && vodSources.length > 0) {
      return vodSources;
    }
    if (customSources && customSources.length > 0) {
      return customSources;
    }
    if (liveChannel && liveChannel.sources && liveChannel.sources.length > 0) {
      return liveChannel.sources;
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
    const found = channels.find((c) => c.id === effectiveChannelId);
    return found?.sources || [];
  }, [vodSources, customSources, liveChannel, params.sources, channels, effectiveChannelId]);

  const [activeSourceIndex, setActiveSourceIndex] = useState<number>(0);
  const [hlsLevels, setHlsLevels] = useState<HlsLevelOption[]>([]);
  const [selectedHlsLevel, setSelectedHlsLevel] = useState<number>(-1);
  const [showQualityModal, setShowQualityModal] = useState<boolean>(false);

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
  }, [effectiveChannelId]);

  // رابط البث الفعلي بناءً على المصدر المختار
  const currentStreamUrl = useMemo(() => {
    let url = liveChannel ? liveChannel.streamUrl : rawStreamUrl;
    if (channelSources.length > 0 && channelSources[activeSourceIndex]) {
      url = channelSources[activeSourceIndex].url;
    }
    // تحويل روابط يوتيوب تلقائياً إلى صيغة التضمين الآمنة لمنع خطأ X-Frame-Options
    if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) {
      url = toYouTubeEmbedUrl(url);
    }
    // إذا كان الرابط ينتمي لنطاقات تفرض حظر 403 على المتصفحات، نوجهه مباشرة للبروكسي
    if (Platform.OS === 'web' && shouldAutoProxy(url)) {
      return getProxyStreamUrl(url);
    }
    return url;
  }, [liveChannel, channelSources, activeSourceIndex, rawStreamUrl]);

  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);

  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
  }, []);

  useEffect(() => {
    if (!showOverlay || showQualityModal || showEpisodesModal || showSideMenu) return;

    const timer = setTimeout(() => {
      setShowOverlay(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [showOverlay, showQualityModal, showEpisodesModal, showSideMenu]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  useTVRemoteNavigation({
    onBack: () => {
      if (showSideMenu) {
        if (sideMenuLevel === 'channels') {
          setSideMenuLevel('categories');
          return true;
        } else {
          setShowSideMenu(false);
          return true;
        }
      }
      if (showEpisodesModal) {
        setShowEpisodesModal(false);
        return true;
      }
      if (showQualityModal) {
        setShowQualityModal(false);
        return true;
      }
      handleGoBack();
      return true;
    },
    onChannelUp: () => {
      if (!isVod && !showSideMenu && !showQualityModal && !showEpisodesModal) {
        handleZapNext();
      }
    },
    onChannelDown: () => {
      if (!isVod && !showSideMenu && !showQualityModal && !showEpisodesModal) {
        handleZapPrev();
      }
    },
    onArrowUp: () => {
      if (!isVod && !showSideMenu && !showQualityModal && !showEpisodesModal && !showOverlay) {
        handleZapNext();
      }
    },
    onArrowDown: () => {
      if (!isVod && !showSideMenu && !showQualityModal && !showEpisodesModal && !showOverlay) {
        handleZapPrev();
      }
    },
    onArrowRight: () => {
      if (!isVod && !showQualityModal && !showEpisodesModal) {
        if (!showSideMenu) {
          setSideMenuLevel('channels');
          setShowSideMenu(true);
        } else if (sideMenuLevel === 'channels') {
          setSideMenuLevel('categories');
        }
      }
    },
    onEnter: () => {
      if (!isVod && !showSideMenu && !showQualityModal && !showEpisodesModal && !showOverlay) {
        setSideMenuLevel('channels');
        setShowSideMenu(true);
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
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'transparent' }]}
        >
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'transparent' }]} />
        </Pressable>
      )}

      {/* 3. عناصر التحكم العائمة العلوية مع دعم المنطقة الآمنة للهاتف والتلفاز */}
      {showOverlay && !playbackError && (
        <View
          style={[
            styles.overlayBar,
            {
              paddingTop: Math.max(insets.top, 16) + (Platform.OS === 'android' ? 8 : 0),
              paddingHorizontal: Math.max(insets.left, insets.right, 24),
            },
          ]}
        >
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
            {effectiveTitle ? (
              <View style={styles.titleBadge}>
                <ChannelLogo
                  uri={effectiveLogo}
                  name={effectiveTitle}
                  size={26}
                  style={styles.playerChannelLogo}
                />
                <Text numberOfLines={1} style={styles.titleBadgeText}>
                  {effectiveTitle}
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

            {/* زر دليل القنوات والتنقل السريع للقنوات التلفزيونية */}
            {!isVod && (
              <Pressable
                onPress={() => {
                  setSideMenuLevel('channels');
                  setShowSideMenu(true);
                  resetOverlayTimer();
                }}
                style={({ focused }) => [
                  styles.channelsListBtn,
                  focused && styles.overlayBtnFocused,
                ]}
              >
                {({ focused }) => (
                  <View style={styles.btnRow}>
                    <MaterialIcons
                      name="menu"
                      size={20}
                      color={focused ? '#000000' : '#38bdf8'}
                    />
                    <Text
                      style={[
                        styles.channelsListBtnText,
                        focused && styles.overlayBtnTextFocused,
                      ]}
                    >
                      دليل القنوات ☰
                    </Text>
                  </View>
                )}
              </Pressable>
            )}

            {/* زر المفضلة */}
            {effectiveChannelId ? (
              <Pressable
                onPress={() => {
                  toggleFavorite({
                    id: effectiveChannelId,
                    title: effectiveTitle,
                    name: effectiveTitle,
                    logo: effectiveLogo,
                    poster: effectiveLogo,
                    url: currentStreamUrl,
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
            <Text style={styles.helpHintText}>الأسهم أو CH+/- للتبديل • OK لدليل القنوات</Text>
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
          </View>
        </View>
      ) : null}

      {/* 5. قائمة التنقل السريع المتداخلة الشفافة فوق البث (Live Overlay Drawer) */}
      {showSideMenu && !isVod && (
        <View style={styles.sideMenuOverlay}>
          {/* خلفية شفافة قابلة للنقر لإغلاق القائمة */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowSideMenu(false)}
          />

          {/* الدرج الجانبي على اليمين RTL */}
          <View style={styles.sideMenuDrawer}>
            {/* رأس القائمة */}
            <View style={styles.sideMenuHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                {sideMenuLevel === 'channels' ? (
                  <Pressable
                    style={styles.backToCategoriesBtn}
                    onPress={() => setSideMenuLevel('categories')}
                  >
                    <MaterialIcons name="chevron-right" size={24} color="#38bdf8" />
                    <Text style={styles.backToCategoriesText}>الأقسام</Text>
                  </Pressable>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="dashboard" size={20} color="#38bdf8" />
                    <Text style={styles.sideMenuTitle}>الأقسام والباقات</Text>
                  </View>
                )}

                {sideMenuLevel === 'channels' && (
                  <Text style={styles.sideMenuSubTitle} numberOfLines={1}>
                    {activeCategoryName} ({activeChannelList.length})
                  </Text>
                )}
              </View>

              <Pressable
                style={styles.closeSideMenuBtn}
                onPress={() => setShowSideMenu(false)}
              >
                <MaterialIcons name="close" size={20} color="#94a3b8" />
              </Pressable>
            </View>

            {/* المستوى 1: قائمة القنوات في القسم الحالي */}
            {sideMenuLevel === 'channels' ? (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {activeChannelList.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: '#64748b', fontSize: 13 }}>لا توجد قنوات في هذا القسم</Text>
                  </View>
                ) : (
                  activeChannelList.map((ch, idx) => {
                    const isCurrent = ch.id === effectiveChannelId;
                    const numStr = String(idx + 1).padStart(3, '0');

                    return (
                      <Pressable
                        key={ch.id}
                        focusable={true}
                        accessible={true}
                        hasTVPreferredFocus={isCurrent}
                        style={({ focused }) => [
                          styles.sideMenuChannelRow,
                          isCurrent && styles.sideMenuChannelRowCurrent,
                          focused && styles.sideMenuRowFocused,
                        ]}
                        onPress={() => switchLiveChannel(ch)}
                      >
                        {({ focused }) => (
                          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                            <Text style={[styles.sideMenuChannelNum, focused && styles.textFocused]}>
                              {numStr}
                            </Text>

                            <View style={styles.sideMenuLogoBox}>
                              <ChannelLogo
                                uri={ch.logo}
                                name={ch.name}
                                size={32}
                                focused={focused}
                              />
                            </View>

                            <Text
                              style={[
                                styles.sideMenuChannelName,
                                isCurrent && { color: '#10b981', fontWeight: '800' },
                                focused && styles.textFocused,
                              ]}
                              numberOfLines={1}
                            >
                              {ch.name}
                            </Text>

                            {isCurrent && (
                              <View style={styles.sideMenuPlayingDot} />
                            )}
                          </View>
                        )}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            ) : (
              /* المستوى 2: قائمة الأقسام والبلدان والسلاسل */
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {navGroups.map((group) => {
                  const isSelected = activeCategoryName === group.name;

                  return (
                    <Pressable
                      key={group.id}
                      focusable={true}
                      accessible={true}
                      hasTVPreferredFocus={isSelected}
                      style={({ focused }) => [
                        styles.sideMenuGroupRow,
                        isSelected && styles.sideMenuGroupRowSelected,
                        focused && styles.sideMenuRowFocused,
                      ]}
                      onPress={() => {
                        setActiveCategoryName(group.name);
                        setActiveCategoryType(group.type);
                        setSideMenuLevel('channels');
                      }}
                    >
                      {({ focused }) => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <MaterialIcons
                              name={group.icon}
                              size={20}
                              color={focused ? '#38bdf8' : isSelected ? '#38bdf8' : '#94a3b8'}
                            />
                            <Text
                              style={[
                                styles.sideMenuGroupName,
                                isSelected && { color: '#38bdf8', fontWeight: '800' },
                                focused && styles.textFocused,
                              ]}
                              numberOfLines={1}
                            >
                              {group.name}
                            </Text>
                          </View>

                          <View style={styles.sideMenuGroupBadge}>
                            <Text style={[styles.sideMenuGroupBadgeText, focused && { color: '#38bdf8' }]}>
                              {group.count}
                            </Text>
                          </View>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      )}

      {/* 6. شريط معلومات التبديل السريع (Zapping Quick Banner) */}
      {zapBanner && zapBanner.visible && (
        <View style={styles.zapBannerContainer}>
          <Text style={styles.zapBannerNumber}>{zapBanner.numberStr}</Text>
          <ChannelLogo
            uri={zapBanner.channel.logo}
            name={zapBanner.channel.name}
            size={42}
            style={{ borderRadius: 6, backgroundColor: '#0f172a' }}
          />
          <View style={{ flex: 1, paddingHorizontal: 10 }}>
            <Text style={styles.zapBannerTitle} numberOfLines={1}>
              {zapBanner.channel.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={styles.greenPulseDot} />
              <Text style={styles.zapBannerCategory}>
                {zapBanner.channel.country || zapBanner.channel.groupTitle || activeCategoryName}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
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
  channelsListBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
  },
  channelsListBtnText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  sideMenuOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    zIndex: 100,
  },
  sideMenuDrawer: {
    width: 380,
    maxWidth: '85%',
    height: '100%',
    backgroundColor: 'rgba(7, 11, 20, 0.95)',
    borderLeftWidth: 1.5,
    borderLeftColor: '#1e293b',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 20,
  },
  sideMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  sideMenuTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  sideMenuSubTitle: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  backToCategoriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  backToCategoriesText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  closeSideMenuBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  sideMenuChannelRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 8,
    marginVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.3)',
  },
  sideMenuChannelRowCurrent: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10b981',
    borderWidth: 1,
  },
  sideMenuRowFocused: {
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#38bdf8',
    transform: [{ scale: 1.02 }],
  },
  sideMenuChannelNum: {
    width: 32,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  sideMenuLogoBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 8,
  },
  sideMenuChannelName: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 6,
  },
  sideMenuPlayingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginLeft: 6,
  },
  sideMenuGroupRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.3)',
  },
  sideMenuGroupRowSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38bdf8',
    borderWidth: 1,
  },
  sideMenuGroupName: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  sideMenuGroupBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sideMenuGroupBadgeText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  zapBannerContainer: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 17, 32, 0.92)',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 320,
    maxWidth: '90%',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
    zIndex: 90,
  },
  zapBannerNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#38bdf8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginRight: 12,
  },
  zapBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc',
  },
  zapBannerCategory: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  textFocused: {
    color: '#38bdf8',
    fontWeight: '800',
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

