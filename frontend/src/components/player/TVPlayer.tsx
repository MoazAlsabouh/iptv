import React, { useEffect, useRef, useState, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { View, Text, Pressable, Platform, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { MaterialIcons } from '@expo/vector-icons';
import Hls from 'hls.js';
import { shouldAutoProxy, getProxyStreamUrl } from '../../utils/proxy';
import { TVEmbedPlayer, extractYouTubeIdAndStart } from './TVEmbedPlayer';

export interface HlsLevelOption {
  id: number; // -1 for auto
  label: string;
  height?: number;
  bitrate?: number;
}

export interface TrackOption {
  id: string | number;
  label: string;
  language?: string;
}

export interface TVPlayerPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  audioTracks: TrackOption[];
  selectedAudioTrackId?: string | number | null;
  subtitleTracks: TrackOption[];
  selectedSubtitleTrackId?: string | number | null;
  isLive: boolean;
}

export interface TVPlayerHandle {
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seekBy: (seconds: number) => void;
  seekTo: (seconds: number) => void;
  toggleMute: () => void;
  selectAudioTrack: (trackId: string | number) => void;
  selectSubtitleTrack: (trackId: string | number | null) => void;
}

export interface TVPlayerProps {
  streamUrl: string;
  streamType?: 'auto' | 'hls' | 'youtube' | 'iframe';
  contentFit?: 'contain' | 'cover' | 'fill';
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (errorMessage: string) => void;
  onEnded?: () => void;
  onLevelsLoaded?: (levels: HlsLevelOption[]) => void;
  onPlaybackStateChange?: (state: TVPlayerPlaybackState) => void;
  selectedLevel?: number;
  style?: StyleProp<ViewStyle>;
}

export function isEmbedStreamUrl(rawUrl: string, streamType?: string): boolean {
  if (!rawUrl) return false;
  const safeStreamUrl = String(rawUrl).toLowerCase();
  return (
    streamType === 'youtube' ||
    streamType === 'iframe' ||
    safeStreamUrl.includes('youtube.com') ||
    safeStreamUrl.includes('youtube-nocookie.com') ||
    safeStreamUrl.includes('youtu.be') ||
    safeStreamUrl.includes('/embed/') ||
    safeStreamUrl.includes('vidsrc') ||
    safeStreamUrl.includes('vidlink.pro') ||
    safeStreamUrl.includes('embed.su') ||
    safeStreamUrl.includes('autoembed') ||
    safeStreamUrl.includes('2embed') ||
    safeStreamUrl.includes('dailymotion.com') ||
    safeStreamUrl.includes('player.')
  );
}

/**
 * تحويل أي رابط يوتيوب بمختلف صيغه إلى صيغة التضمين الآمنة الخالية من ملفات التتبع والإعلانات (youtube-nocookie.com/embed/)
 * يدعم: watch?v=, youtu.be/, /shorts/, /live/, /playlist?list=, والروابط المركبة (v + list)
 * مع الإبقاء على controls=0 و autoplay=1 و start={startAt}
 */
export function toYouTubeEmbedUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl || '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  if (
    !trimmed.includes('youtube.com') &&
    !trimmed.includes('youtu.be') &&
    !trimmed.includes('youtube-nocookie.com') &&
    !trimmed.includes('/embed/yt')
  ) {
    return trimmed;
  }

  // على منصة Native نوجّه يوتيوب لخادم التضمين المباشر لتفادي خطأ Error 153
  if (Platform.OS !== 'web') {
    const yt = extractYouTubeIdAndStart(trimmed);
    if (yt.videoId) {
      return `https://iptv-backend.moaznsm.workers.dev/embed/yt?v=${encodeURIComponent(yt.videoId)}&start=${yt.start}`;
    }
  }

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();

    let videoId = '';
    const listId = parsed.searchParams.get('list') || '';
    const startParam = parsed.searchParams.get('start') || parsed.searchParams.get('t') || '';
    const startQuery = startParam ? `&start=${encodeURIComponent(startParam.replace('s', ''))}` : '';

    if (host.includes('youtu.be')) {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      videoId = pathParts[0] || '';
    } else if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      if (parsed.pathname.startsWith('/embed/')) {
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        const idPart = pathParts[1] || '';
        if (idPart !== 'videoseries') {
          videoId = idPart;
        }
      } else if (parsed.pathname.startsWith('/shorts/')) {
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        videoId = pathParts[1] || '';
      } else if (parsed.pathname.startsWith('/live/')) {
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        videoId = pathParts[1] || '';
      } else {
        videoId = parsed.searchParams.get('v') || '';
      }
    }

    const domain = Platform.OS !== 'web' ? 'www.youtube.com' : 'www.youtube-nocookie.com';
    const policyParams = 'autoplay=1&controls=0&rel=0&playsinline=1&enablejsapi=1&cc_load_policy=0&iv_load_policy=3&origin=https%3A%2F%2Ftv.moazns.sy&widget_referrer=https%3A%2F%2Ftv.moazns.sy';

    if (videoId && listId) {
      return `https://${domain}/embed/${videoId}?list=${encodeURIComponent(listId)}${startQuery}&${policyParams}`;
    }
    if (videoId) {
      return `https://${domain}/embed/${videoId}?${policyParams}${startQuery}`;
    }
    if (listId) {
      return `https://${domain}/embed/videoseries?list=${encodeURIComponent(listId)}${startQuery}&${policyParams}`;
    }
  } catch {
    const vMatch = trimmed.match(/(?:[?&]v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([a-zA-Z0-9_-]{11})/);
    const listMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    const startMatch = trimmed.match(/[?&](?:start|t)=([0-9]+)/);
    const videoId = vMatch ? vMatch[1] : '';
    const listId = listMatch ? listMatch[1] : '';
    const startQuery = startMatch ? `&start=${startMatch[1]}` : '';

    const domain = Platform.OS !== 'web' ? 'www.youtube.com' : 'www.youtube-nocookie.com';
    const policyParams = 'autoplay=1&controls=0&rel=0&playsinline=1&enablejsapi=1&cc_load_policy=0&iv_load_policy=3&origin=https%3A%2F%2Ftv.moazns.sy&widget_referrer=https%3A%2F%2Ftv.moazns.sy';

    if (videoId && listId) {
      return `https://${domain}/embed/${videoId}?list=${encodeURIComponent(listId)}${startQuery}&${policyParams}`;
    }
    if (videoId) {
      return `https://${domain}/embed/${videoId}?${policyParams}${startQuery}`;
    }
    if (listId) {
      return `https://${domain}/embed/videoseries?list=${encodeURIComponent(listId)}${startQuery}&${policyParams}`;
    }
  }

  return trimmed;
}

export function normalizeYouTubeEmbedUrl(url: string): string {
  return toYouTubeEmbedUrl(url);
}

/**
 * مشغل يوتيوب المخصص لبيئة الويب باستخدام YouTube IFrame API الرسمي.
 * يضمن الانتقال السلس التلقائي بين الحلقات عبر player.loadVideoById دون إعادة بناء المشغل
 * مع إيقاف الترجمة إجبارياً عبر unloadModule('captions') و unloadModule('cc').
 */
const YouTubeWebPlayer: React.FC<{
  url: string;
  style?: StyleProp<ViewStyle>;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (err: string) => void;
  onEnded?: () => void;
}> = ({ url, style, onBuffering, onError, onEnded }) => {
  const containerRef = useRef<any>(null);
  const playerRef = useRef<any>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onBufferingRef = useRef(onBuffering);
  onBufferingRef.current = onBuffering;

  const ytInfo = useMemo(() => extractYouTubeIdAndStart(url), [url]);
  const currentVideoIdRef = useRef<string>(ytInfo.videoId);
  const lastValidTimeRef = useRef<number>(ytInfo.start || 0);
  const watchdogTimerRef = useRef<any>(null);
  const timeTrackingIntervalRef = useRef<any>(null);

  const startTimeTracking = () => {
    if (timeTrackingIntervalRef.current) clearInterval(timeTrackingIntervalRef.current);
    timeTrackingIntervalRef.current = setInterval(() => {
      try {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const cur = playerRef.current.getCurrentTime();
          if (typeof cur === 'number' && cur > 0) {
            lastValidTimeRef.current = Math.floor(cur);
          }
        }
      } catch (e) {}
    }, 1000);
  };

  const stopTimeTracking = () => {
    if (timeTrackingIntervalRef.current) {
      clearInterval(timeTrackingIntervalRef.current);
      timeTrackingIntervalRef.current = null;
    }
  };

  // مراقب أمان تلقائي (Auto-Play Watchdog):
  // إذا دخل المشغل في حالة UNSTARTED (-1) أو PAUSED (2) دون رغبة المستخدم لأكثر من 1.5 ثانية:
  // استدعاء playVideo مع الرجوع 5 ثوانٍ للخلف لتعويض أي انقطاع
  const triggerWatchdog = (state: number) => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }

    if (state === 1) { // PLAYING
      startTimeTracking();
      return;
    }

    if (state === 0) { // ENDED
      stopTimeTracking();
      return;
    }

    if (state === -1 || state === 2) {
      watchdogTimerRef.current = setTimeout(() => {
        try {
          if (!playerRef.current) return;
          const curState = playerRef.current.getPlayerState ? playerRef.current.getPlayerState() : -1;
          if (curState === -1 || curState === 2) {
            console.log('[YouTubeWebPlayer Watchdog] Auto-recovering playback at second:', lastValidTimeRef.current);
            if (lastValidTimeRef.current > 5) {
              const resumeSec = Math.max(0, lastValidTimeRef.current - 5);
              playerRef.current.seekTo(resumeSec, true);
            }
            playerRef.current.playVideo();
            try {
              playerRef.current.unloadModule('captions');
              playerRef.current.unloadModule('cc');
            } catch (e) {}
          }
        } catch (err) {}
      }, 1500);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    let destroyed = false;

    const initPlayer = () => {
      const win = window as any;
      if (!win.YT || !win.YT.Player || !containerRef.current || playerRef.current || destroyed) return;

      try {
        playerRef.current = new win.YT.Player(containerRef.current, {
          videoId: ytInfo.videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: 0,
            rel: 0,
            playsinline: 1,
            start: ytInfo.start,
            cc_load_policy: 0,
            iv_load_policy: 3,
            enablejsapi: 1,
            origin: window.location.origin,
            widget_referrer: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (destroyed) return;
              try {
                event.target.unloadModule('captions');
                event.target.unloadModule('cc');
              } catch (e) {}
              try {
                event.target.playVideo();
              } catch (e) {}
              onBufferingRef.current?.(false);
            },
            onStateChange: (event: any) => {
              if (destroyed) return;
              triggerWatchdog(event.data);
              const win = window as any;
              // 1 = PLAYING
              if (event.data === 1 || event.data === win?.YT?.PlayerState?.PLAYING) {
                try {
                  event.target.unloadModule('captions');
                  event.target.unloadModule('cc');
                } catch (e) {}
                onBufferingRef.current?.(false);
              }
              // 0 = ENDED
              if (event.data === 0 || event.data === win?.YT?.PlayerState?.ENDED) {
                onEndedRef.current?.();
              }
            },
            onError: (event: any) => {
              if (destroyed) return;
              onErrorRef.current?.(`فيديو يوتيوب غير متاح (كود ${event.data})`);
            },
          },
        });
      } catch (err) {
        console.warn('[YouTubeWebPlayer] Init error:', err);
      }
    };

    const loadApi = () => {
      const win = window as any;
      if (win.YT && win.YT.Player) {
        initPlayer();
        return;
      }

      if (!document.getElementById('yt-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }

      const prevOnReady = win.onYouTubeIframeAPIReady;
      win.onYouTubeIframeAPIReady = () => {
        if (typeof prevOnReady === 'function') prevOnReady();
        initPlayer();
      };
    };

    loadApi();

    return () => {
      destroyed = true;
      stopTimeTracking();
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  // التبديل السلس للحلقة التالية دون إعادة بناء المشغل
  useEffect(() => {
    if (!ytInfo.videoId) return;

    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      if (currentVideoIdRef.current !== ytInfo.videoId) {
        currentVideoIdRef.current = ytInfo.videoId;
        lastValidTimeRef.current = ytInfo.start || 0;
        playerRef.current.loadVideoById({
          videoId: ytInfo.videoId,
          startSeconds: ytInfo.start || 0,
        });
        try {
          playerRef.current.unloadModule('captions');
          playerRef.current.unloadModule('cc');
        } catch (e) {}
        try {
          playerRef.current.playVideo();
        } catch (e) {}
      }
    }
  }, [ytInfo.videoId, ytInfo.start]);

  return (
    <View style={[styles.container, style]}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#000000',
        }}
      />
    </View>
  );
};

/**
 * مشغل فيديو متطور يدعم شاشات التلفاز والويب وأجهزة Android/iOS.
 * - يستخدم hls.js لبث قنوات m3u8 الحية بكفاءة عالية على المتصفحات والشاشات الذكية.
 * - يدعم استخراج وتبديل مستويات الجودة Hls Levels ومعالجة Autoplay.
 * - يدعم تشغيل السيرفرات المدمجة مباشرة عبر iframe دون قيود sandbox لضمان التوافق التام.
 */
export const TVPlayer = forwardRef<TVPlayerHandle, TVPlayerProps>(({
  streamUrl,
  streamType = 'auto',
  contentFit = 'contain',
  onBuffering,
  onError,
  onEnded,
  onLevelsLoaded,
  onPlaybackStateChange,
  selectedLevel = -1,
  style,
}, ref) => {
  const videoHtmlRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [needsUserPlay, setNeedsUserPlay] = useState<boolean>(false);
  const nativePlayerRef = useRef<TVPlayerHandle | null>(null);

  // تخزين دوال رد الاتصال في refs لتجنب إعادة تشغيل useEffect عند كل re-render
  const onBufferingRef = useRef(onBuffering);
  onBufferingRef.current = onBuffering;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onLevelsLoadedRef = useRef(onLevelsLoaded);
  onLevelsLoadedRef.current = onLevelsLoaded;
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  onPlaybackStateChangeRef.current = onPlaybackStateChange;

  const safeStreamUrl = String(streamUrl || '');

  const isYouTube =
    streamType === 'youtube' ||
    safeStreamUrl.includes('youtube.com') ||
    safeStreamUrl.includes('youtube-nocookie.com') ||
    safeStreamUrl.includes('youtu.be');

  const isEmbedUrl = isEmbedStreamUrl(safeStreamUrl, streamType);

  const finalEmbedUrl = React.useMemo(() => {
    if (!isEmbedUrl) return safeStreamUrl;
    let url = safeStreamUrl;

    if (isYouTube) {
      if (Platform.OS !== 'web') {
        const yt = extractYouTubeIdAndStart(url);
        if (yt.videoId) {
          return `https://iptv-backend.moaznsm.workers.dev/embed/yt?v=${encodeURIComponent(yt.videoId)}&start=${yt.start}`;
        }
      }
      url = normalizeYouTubeEmbedUrl(url);
    }

    // إزالة أي معاملات لكتم الصوت مثل mute=1 أو muted=1
    url = url
      .replace(/([?&])(?:mute|muted)=(?:1|true|yes)(&|$)/gi, '$1')
      .replace(/[?&]$/, '');

    if (isYouTube && url) {
      if (Platform.OS !== 'web' && url.includes('youtube-nocookie.com')) {
        url = url.replace('youtube-nocookie.com', 'youtube.com');
      }
      const sep = url.includes('?') ? '&' : '?';
      const additions: string[] = [];
      if (!url.includes('origin=')) additions.push('origin=https%3A%2F%2Ftv.moazns.sy');
      if (!url.includes('widget_referrer=')) additions.push('widget_referrer=https%3A%2F%2Ftv.moazns.sy');
      if (!url.includes('enablejsapi=')) additions.push('enablejsapi=1');
      if (additions.length > 0) {
        url = `${url}${sep}${additions.join('&')}`;
      }
    }
    return url;
  }, [safeStreamUrl, isEmbedUrl, isYouTube]);

  // إرسال حالة التشغيل للويب
  const notifyWebPlaybackState = useCallback(() => {
    const videoEl = videoHtmlRef.current;
    if (!videoEl || Platform.OS !== 'web' || isEmbedUrl) return;

    const hls = hlsRef.current;
    let audioTracks: TrackOption[] = [];
    let selectedAudioTrackId: number | null = null;
    let subtitleTracks: TrackOption[] = [];
    let selectedSubtitleTrackId: number | null = null;

    if (hls) {
      if (hls.audioTracks && hls.audioTracks.length > 0) {
        audioTracks = hls.audioTracks.map((t, idx) => ({
          id: idx,
          label: t.name || t.lang || `مسار ${idx + 1}`,
          language: t.lang,
        }));
        selectedAudioTrackId = hls.audioTrack;
      }
      if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
        subtitleTracks = hls.subtitleTracks.map((t, idx) => ({
          id: idx,
          label: t.name || t.lang || `ترجمة ${idx + 1}`,
          language: t.lang,
        }));
        selectedSubtitleTrackId = hls.subtitleTrack >= 0 ? hls.subtitleTrack : null;
      }
    }

    const curTime = Number(videoEl.currentTime) || 0;
    const dur = Number(videoEl.duration) || 0;
    const isLive = !Number.isFinite(dur) || dur <= 0;

    onPlaybackStateChangeRef.current?.({
      isPlaying: !videoEl.paused && !videoEl.ended,
      currentTime: curTime,
      duration: isLive ? 0 : dur,
      isMuted: videoEl.muted,
      audioTracks,
      selectedAudioTrackId,
      subtitleTracks,
      selectedSubtitleTrackId,
      isLive,
    });
  }, [isEmbedUrl]);

  // إتاحة التحكم الخارجي عبر useImperativeHandle
  useImperativeHandle(ref, () => {
    if (Platform.OS !== 'web') {
      return {
        play: () => nativePlayerRef.current?.play(),
        pause: () => nativePlayerRef.current?.pause(),
        togglePlayPause: () => nativePlayerRef.current?.togglePlayPause(),
        seekBy: (secs) => nativePlayerRef.current?.seekBy(secs),
        seekTo: (secs) => nativePlayerRef.current?.seekTo(secs),
        toggleMute: () => nativePlayerRef.current?.toggleMute(),
        selectAudioTrack: (tId) => nativePlayerRef.current?.selectAudioTrack(tId),
        selectSubtitleTrack: (tId) => nativePlayerRef.current?.selectSubtitleTrack(tId),
      };
    }

    // على الويب:
    return {
      play: () => {
        const videoEl = videoHtmlRef.current;
        if (videoEl) {
          videoEl.play().catch(() => {});
        }
      },
      pause: () => {
        const videoEl = videoHtmlRef.current;
        if (videoEl) {
          videoEl.pause();
        }
      },
      togglePlayPause: () => {
        const videoEl = videoHtmlRef.current;
        if (videoEl) {
          if (videoEl.paused) {
            videoEl.play().catch(() => {});
          } else {
            videoEl.pause();
          }
        }
      },
      seekBy: (seconds: number) => {
        const videoEl = videoHtmlRef.current;
        if (videoEl) {
          const newTime = Math.max(0, Math.min(videoEl.duration || 0, (videoEl.currentTime || 0) + seconds));
          videoEl.currentTime = newTime;
          notifyWebPlaybackState();
        }
      },
      seekTo: (seconds: number) => {
        const videoEl = videoHtmlRef.current;
        if (videoEl) {
          videoEl.currentTime = Math.max(0, seconds);
          notifyWebPlaybackState();
        }
      },
      toggleMute: () => {
        const videoEl = videoHtmlRef.current;
        if (videoEl) {
          videoEl.muted = !videoEl.muted;
          notifyWebPlaybackState();
        }
      },
      selectAudioTrack: (trackId: string | number) => {
        const hls = hlsRef.current;
        if (hls && typeof trackId === 'number') {
          hls.audioTrack = trackId;
          notifyWebPlaybackState();
        }
      },
      selectSubtitleTrack: (trackId: string | number | null) => {
        const hls = hlsRef.current;
        if (hls) {
          hls.subtitleTrack = trackId === null ? -1 : Number(trackId);
          notifyWebPlaybackState();
        }
      },
    };
  }, [notifyWebPlaybackState]);

  // استماع لرسائل أخطاء يوتيوب (postMessage) من الـ iframe للتنقل التلقائي عند الحظر أو تقييد العمر
  useEffect(() => {
    if (Platform.OS !== 'web' || !isEmbedUrl) {
      return;
    }

    const handleWindowMessage = (event: MessageEvent) => {
      try {
        if (
          event.origin &&
          (String(event.origin).includes('youtube.com') || String(event.origin).includes('youtube-nocookie.com'))
        ) {
          let data = event.data;
          if (typeof data === 'string') {
            try {
              data = JSON.parse(data);
            } catch {
              return;
            }
          }
          if (!data || typeof data !== 'object') return;

          // انتهاء تشغيل فيديو يوتيوب (state 0 = ENDED)
          if (
            (data.event === 'onStateChange' && (Number(data.info) === 0 || Number(data.data) === 0)) ||
            (data.event === 'infoDelivery' && data.info && Number(data.info.playerState) === 0)
          ) {
            console.log('[TVPlayer] YouTube iframe video ended (state 0)');
            onEndedRef.current?.();
          }

          // أكواد أخطاء يوتيوب: 100 (محذوف)، 101/150 (معطل التضمين)، 152 (مقيد بالعمر)
          if (data.event === 'onError' || (data.info !== undefined && data.event !== 'onStateChange')) {
            const code = Number(data.info ?? data.data);
            if ([100, 101, 150, 152].includes(code)) {
              console.warn('[TVPlayer] YouTube iframe error received:', code);
              onErrorRef.current?.(`فيديو يوتيوب غير متاح للتضمين (كود ${code})`);
            }
          }
        }
      } catch {
        // تجاهل أي رسائل غير متوافقة
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => {
      window.removeEventListener('message', handleWindowMessage);
    };
  }, [isEmbedUrl]);

  // إعداد hls.js على بيئة الويب وشاشات التلفاز الذكية
  useEffect(() => {
    if (isEmbedUrl) {
      onBufferingRef.current?.(false);
      const timer = setTimeout(() => {
        onBufferingRef.current?.(false);
      }, 2500);
      return () => clearTimeout(timer);
    }

    if (Platform.OS !== 'web' || !streamUrl) {
      return;
    }

    const videoEl = videoHtmlRef.current;
    if (!videoEl) return;

    setNeedsUserPlay(false);

    // تنظيف أي نسخة سابقة من Hls وإيقاف الفيديو السابق
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let playbackStarted = false;
    let timeoutId: any = null;
    let hasTriedProxy = shouldAutoProxy(streamUrl);

    const clearPlaybackTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const resetPlaybackTimeout = () => {
      clearPlaybackTimeout();
      timeoutId = setTimeout(() => {
        if (!playbackStarted) {
          if (!hasTriedProxy) {
            console.log('[TVPlayer] Connection timeout. Retrying via HLS stream proxy...');
            hasTriedProxy = true;
            if (hlsRef.current) {
              hlsRef.current.destroy();
              hlsRef.current = null;
            }
            loadHlsStream(getProxyStreamUrl(streamUrl));
            return;
          }
          clearPlaybackTimeout();
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          onErrorRef.current?.('استغرق الاتصال بمصدر البث وقتاً أطول من المتوقع');
        }
      }, 10000);
    };

    const onPlaySuccess = () => {
      playbackStarted = true;
      clearPlaybackTimeout();
      onBufferingRef.current?.(false);
    };

    const onVideoError = () => {
      clearPlaybackTimeout();
      if (!hasTriedProxy) {
        console.log('[TVPlayer] HTML5 video error. Retrying via HLS stream proxy...');
        hasTriedProxy = true;
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        loadHlsStream(getProxyStreamUrl(streamUrl));
        return;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      onErrorRef.current?.('تعذر الاتصال بمصدر البث، يرجى إعادة المحاولة أو اختيار مصدر آخر');
    };

    const onVideoEnded = () => {
      onEndedRef.current?.();
    };

    videoEl.addEventListener('playing', onPlaySuccess);
    videoEl.addEventListener('canplay', onPlaySuccess);
    videoEl.addEventListener('error', onVideoError);
    videoEl.addEventListener('ended', onVideoEnded);
    videoEl.addEventListener('timeupdate', notifyWebPlaybackState);
    videoEl.addEventListener('pause', notifyWebPlaybackState);
    videoEl.addEventListener('play', notifyWebPlaybackState);
    videoEl.addEventListener('volumechange', notifyWebPlaybackState);

    const safePlay = () => {
      // تشغيل غير مكتوم بالصوت الكامل افتراضياً
      try {
        videoEl.muted = false;
        videoEl.volume = 1;
      } catch {}

      videoEl.play().catch((err: any) => {
        if (err.name === 'AbortError') {
          return;
        }
        if (err.name === 'NotAllowedError') {
          // في حال رفض المتصفح التشغيل التلقائي مع الصوت بسبب Autoplay Policy، نجرب الكتم كحل بديل
          try {
            videoEl.muted = true;
            videoEl.play().catch(() => {
              clearPlaybackTimeout();
              setNeedsUserPlay(true);
            });
          } catch {
            clearPlaybackTimeout();
            setNeedsUserPlay(true);
          }
        } else {
          console.warn('[TVPlayer] Play warning:', err);
        }
      });
    };

    const loadHlsStream = (urlToLoad: string) => {
      resetPlaybackTimeout();

      const safeUrl = String(urlToLoad || '');
      const isM3u8 =
        safeUrl.toLowerCase().includes('.m3u8') ||
        safeUrl.includes('playlist') ||
        safeUrl.includes('/api/proxy');

      if (isM3u8 && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 60,
          manifestLoadingMaxRetry: 1,
          manifestLoadingRetryDelay: 1000,
          manifestLoadingMaxRetryTimeout: 4000,
          levelLoadingMaxRetry: 2,
          levelLoadingRetryDelay: 1000,
          levelLoadingMaxRetryTimeout: 4000,
          fragLoadingMaxRetry: 2,
          fragLoadingRetryDelay: 1000,
          fragLoadingMaxRetryTimeout: 4000,
        });

        hlsRef.current = hls;
        let consecutiveFragErrors = 0;
        let mediaRecoveryAttempts = 0;

        hls.loadSource(urlToLoad);
        hls.attachMedia(videoEl);

        hls.on(Hls.Events.FRAG_LOADED, () => {
          consecutiveFragErrors = 0;
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          safePlay();

          const levels: HlsLevelOption[] = [{ id: -1, label: 'تلقائي (Auto)' }];

          if (hls.levels && hls.levels.length > 0) {
            hls.levels.forEach((lvl, idx) => {
              const h = lvl.height || 0;
              const label = h > 0 ? `${h}p` : `جودة ${idx + 1}`;
              levels.push({
                id: idx,
                label,
                height: lvl.height,
                bitrate: lvl.bitrate,
              });
            });
          }

          onLevelsLoadedRef.current?.(levels);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          const httpStatus =
            data.response?.code ||
            (data.context as any)?.xhr?.status ||
            (data.context as any)?.response?.status ||
            0;

          // 1. معالجة خطأ 404 المباشر (البث غير متاح نهائياً - عدم إعادة المحاولة عبر البروكسي)
          if (httpStatus === 404) {
            console.warn('[TVPlayer] Stream 404 Not Found. Aborting immediately without retry.');
            clearPlaybackTimeout();
            hls.destroy();
            hlsRef.current = null;
            onErrorRef.current?.('البث غير متاح حالياً (404 Not Found)');
            return;
          }

          // 2. مراقبة تكرار فشل تحميل المقاطع (FRAG_LOAD_ERROR) لمنع الحلقات اللانهائية
          if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
            consecutiveFragErrors++;
            if (httpStatus === 403 || consecutiveFragErrors >= 2) {
              if (!hasTriedProxy) {
                console.log('[TVPlayer] Fragment 403/Blocked. Switching to HLS proxy...');
                hasTriedProxy = true;
                clearPlaybackTimeout();
                hls.destroy();
                hlsRef.current = null;
                loadHlsStream(getProxyStreamUrl(streamUrl));
                return;
              } else {
                clearPlaybackTimeout();
                hls.destroy();
                hlsRef.current = null;
                onErrorRef.current?.('تعذر تحميل مقاطع البث، القناة غير متاحة حالياً');
                return;
              }
            }
          }

          // 3. مراقبة فشل تحميل مستويات الجودة (LEVEL_LOAD_ERROR)
          if (data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR) {
            if (httpStatus === 403 || !hasTriedProxy) {
              console.log('[TVPlayer] Level load error. Switching to HLS proxy...');
              hasTriedProxy = true;
              clearPlaybackTimeout();
              hls.destroy();
              hlsRef.current = null;
              loadHlsStream(getProxyStreamUrl(streamUrl));
              return;
            } else {
              clearPlaybackTimeout();
              hls.destroy();
              hlsRef.current = null;
              onErrorRef.current?.('تعذر تحميل قائمة الجودات، القناة غير متاحة حالياً');
              return;
            }
          }

          // 4. معالجة الأخطاء القاتلة (data.fatal)
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              if (mediaRecoveryAttempts < 1) {
                mediaRecoveryAttempts++;
                console.log('[TVPlayer] Media error encountered, attempting recovery...');
                hls.recoverMediaError();
                return;
              }
            }

            const isNetworkOrBlocked =
              data.type === Hls.ErrorTypes.NETWORK_ERROR ||
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
              httpStatus === 403 ||
              httpStatus === 0;

            if (isNetworkOrBlocked && !hasTriedProxy) {
              console.log(
                '[TVPlayer] Direct stream failed (403/Network). Retrying via HLS stream proxy...'
              );
              hasTriedProxy = true;
              clearPlaybackTimeout();
              hls.destroy();
              hlsRef.current = null;
              loadHlsStream(getProxyStreamUrl(streamUrl));
              return;
            }

            clearPlaybackTimeout();
            hls.destroy();
            hlsRef.current = null;
            onErrorRef.current?.('تعذر الاتصال بمصدر البث، القناة غير متاحة حالياً');
          }
        });
      } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        videoEl.src = urlToLoad;
        videoEl.addEventListener('loadedmetadata', safePlay, { once: true });
      } else {
        videoEl.src = urlToLoad;
        videoEl.addEventListener('loadedmetadata', safePlay, { once: true });
      }
    };

    // بدء تشغيل البث الأولي (مباشر أو عبر البروكسي للنطاقات المعروفة بالحظر)
    const initialUrlToLoad = hasTriedProxy ? getProxyStreamUrl(streamUrl) : streamUrl;
    loadHlsStream(initialUrlToLoad);

    return () => {
      clearPlaybackTimeout();
      videoEl.removeEventListener('playing', onPlaySuccess);
      videoEl.removeEventListener('canplay', onPlaySuccess);
      videoEl.removeEventListener('error', onVideoError);
      videoEl.removeEventListener('ended', onVideoEnded);
      videoEl.removeEventListener('timeupdate', notifyWebPlaybackState);
      videoEl.removeEventListener('pause', notifyWebPlaybackState);
      videoEl.removeEventListener('play', notifyWebPlaybackState);
      videoEl.removeEventListener('volumechange', notifyWebPlaybackState);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        try {
          videoEl.load();
        } catch {}
      }
    };
  }, [streamUrl]);

  // تحديث مستوى الجودة المختار في hls.js
  useEffect(() => {
    if (hlsRef.current && typeof selectedLevel === 'number') {
      hlsRef.current.currentLevel = selectedLevel;
    }
  }, [selectedLevel]);

  const handleManualPlay = () => {
    const videoEl = videoHtmlRef.current;
    if (videoEl) {
      try {
        videoEl.muted = false;
        videoEl.volume = 1;
      } catch {}
      videoEl.play().then(() => {
        setNeedsUserPlay(false);
      }).catch((err) => {
        console.error('[TVPlayer] Manual play error:', err);
      });
    }
  };

  if (Platform.OS === 'web') {
    if (isEmbedUrl) {
      if (isYouTube) {
        return (
          <YouTubeWebPlayer
            url={finalEmbedUrl}
            style={style}
            onBuffering={onBuffering}
            onError={onError}
            onEnded={onEnded}
          />
        );
      }

      return (
        <View style={[styles.container, style]}>
          <iframe
            src={finalEmbedUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: '#000000',
            }}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; clipboard-write; gyroscope"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => {
              onBufferingRef.current?.(false);
            }}
          />
        </View>
      );
    }

    return (
      <View style={[styles.container, style]}>
        <video
          ref={videoHtmlRef}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#000000',
            objectFit: contentFit,
          }}
          playsInline
          autoPlay
          controls={false}
        />

        {/* زر تشغيل يدوي مخصص لأجهزة التلفاز عند حظر المتصفح للتشغيل التلقائي */}
        {needsUserPlay && (
          <View style={styles.autoplayOverlay}>
            <Pressable
              hasTVPreferredFocus
              onPress={handleManualPlay}
              style={({ focused }) => [
                styles.playBtn,
                focused && styles.playBtnFocused,
              ]}
            >
              {({ focused }) => (
                <View style={styles.playBtnContent}>
                  <MaterialIcons
                    name="play-arrow"
                    size={36}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text style={[styles.playBtnText, focused && styles.playBtnTextFocused]}>
                    اضغط للتشغيل
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // البيئات الأصلية (Native - Android TV / Fire TV / Mobile)
  if (isEmbedUrl) {
    return (
      <TVEmbedPlayer
        url={finalEmbedUrl}
        style={style}
        onBuffering={onBuffering}
        onError={onError}
        onEnded={onEnded}
      />
    );
  }

  // روابط البث التلفزيوني العادية (HLS / m3u8) عبر expo-video
  return (
    <NativeVideoPlayer
      ref={nativePlayerRef}
      streamUrl={streamUrl}
      contentFit={contentFit}
      style={style}
      onBuffering={onBuffering}
      onError={onError}
      onEnded={onEnded}
      onPlaybackStateChange={onPlaybackStateChange}
    />
  );
});

/**
 * مشغل الفيديو للأجهزة الأصلية (Android / Android TV / iOS) باستخدام expo-video الحديثة
 */
const NativeVideoPlayer = forwardRef<
  TVPlayerHandle,
  {
    streamUrl: string;
    contentFit?: 'contain' | 'cover' | 'fill';
    style?: StyleProp<ViewStyle>;
    onBuffering?: (isBuffering: boolean) => void;
    onError?: (errorMessage: string) => void;
    onEnded?: () => void;
    onPlaybackStateChange?: (state: TVPlayerPlaybackState) => void;
  }
>(({ streamUrl, contentFit = 'contain', style, onBuffering, onError, onEnded, onPlaybackStateChange }, ref) => {
  // تحديد مصدر البث صراحةً كـ HLS لضمان تعرف ExoPlayer عليه على أندرويد والتلفاز
  const videoSource = useMemo(() => {
    if (!streamUrl) return '';
    return {
      uri: streamUrl,
      contentType: 'hls' as const,
    };
  }, [streamUrl]);

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
    p.muted = false;
    p.volume = 1.0;
    p.timeUpdateEventInterval = 0.5;
    p.play();
  });

  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  onPlaybackStateChangeRef.current = onPlaybackStateChange;
  const onEndedNativeRef = useRef(onEnded);
  onEndedNativeRef.current = onEnded;

  useEffect(() => {
    if (!player) return;
    try {
      const sub = (player as any).addListener?.('playToEnd', () => {
        onEndedNativeRef.current?.();
      });
      return () => {
        sub?.remove?.();
      };
    } catch {}
  }, [player]);

  const syncPlaybackState = useCallback(() => {
    if (!player) return;
    try {
      const p = player as any;
      const audioTracks: TrackOption[] = (p.availableAudioTracks || []).map((t: any, idx: number) => ({
        id: t.id ?? idx,
        label: t.label || t.language || `صوت ${idx + 1}`,
        language: t.language,
      }));

      const subtitleTracks: TrackOption[] = (p.availableSubtitleTracks || []).map((t: any, idx: number) => ({
        id: t.id ?? idx,
        label: t.label || t.language || `ترجمة ${idx + 1}`,
        language: t.language,
      }));

      const curTime = Number(p.currentTime) || 0;
      const dur = Number(p.duration) || 0;
      const isLive = !Number.isFinite(dur) || dur <= 0;

      onPlaybackStateChangeRef.current?.({
        isPlaying: Boolean(p.playing),
        currentTime: curTime,
        duration: isLive ? 0 : dur,
        isMuted: Boolean(p.muted),
        audioTracks,
        selectedAudioTrackId: p.audioTrack?.id ?? null,
        subtitleTracks,
        selectedSubtitleTrackId: p.subtitleTrack?.id ?? null,
        isLive,
      });
    } catch (err) {
      // تجاهل
    }
  }, [player]);

  useImperativeHandle(ref, () => ({
    play: () => {
      try {
        player.play();
        syncPlaybackState();
      } catch {}
    },
    pause: () => {
      try {
        player.pause();
        syncPlaybackState();
      } catch {}
    },
    togglePlayPause: () => {
      try {
        if ((player as any).playing) {
          player.pause();
        } else {
          player.play();
        }
        syncPlaybackState();
      } catch {}
    },
    seekBy: (seconds: number) => {
      try {
        (player as any).seekBy?.(seconds);
        syncPlaybackState();
      } catch {}
    },
    seekTo: (seconds: number) => {
      try {
        (player as any).currentTime = Math.max(0, seconds);
        syncPlaybackState();
      } catch {}
    },
    toggleMute: () => {
      try {
        player.muted = !player.muted;
        syncPlaybackState();
      } catch {}
    },
    selectAudioTrack: (trackId: string | number) => {
      try {
        const tracks = (player as any).availableAudioTracks || [];
        const match = tracks.find((t: any, idx: number) => (t.id ?? idx) === trackId);
        if (match) {
          (player as any).audioTrack = match;
        }
        syncPlaybackState();
      } catch {}
    },
    selectSubtitleTrack: (trackId: string | number | null) => {
      try {
        if (trackId === null) {
          (player as any).subtitleTrack = null;
        } else {
          const tracks = (player as any).availableSubtitleTracks || [];
          const match = tracks.find((t: any, idx: number) => (t.id ?? idx) === trackId);
          if (match) {
            (player as any).subtitleTrack = match;
          }
        }
        syncPlaybackState();
      } catch {}
    },
  }), [player, syncPlaybackState]);

  // تحديث مصدر البث وتشغيله فور تغيّر الرابط
  useEffect(() => {
    if (streamUrl && player && videoSource) {
      try {
        player.replace(videoSource);
        player.play();
        syncPlaybackState();
      } catch (err) {
        console.warn('[NativeVideoPlayer] replace stream error:', err);
      }
    }
  }, [player, streamUrl, videoSource, syncPlaybackState]);

  useEffect(() => {
    const p = player as any;
    const statusSub = player.addListener('statusChange', ({ status, error }: any) => {
      if (status === 'error') {
        onBuffering?.(false);
        onError?.(error?.message || 'تعذر تشغيل البث على المشغل');
      } else if (status === 'loading') {
        onBuffering?.(true);
      } else if (status === 'readyToPlay') {
        onBuffering?.(false);
      }
      syncPlaybackState();
    });

    const playingSub = p.addListener?.('playingChange', ({ isPlaying }: any) => {
      if (isPlaying) {
        onBuffering?.(false);
      }
      syncPlaybackState();
    });

    const timeUpdateSub = p.addListener?.('timeUpdate', () => {
      syncPlaybackState();
    });

    const audioTracksSub = p.addListener?.('availableAudioTracksChange', () => {
      syncPlaybackState();
    });

    const subtitleTracksSub = p.addListener?.('availableSubtitleTracksChange', () => {
      syncPlaybackState();
    });

    syncPlaybackState();

    return () => {
      statusSub.remove();
      playingSub?.remove?.();
      timeUpdateSub?.remove?.();
      audioTracksSub?.remove?.();
      subtitleTracksSub?.remove?.();
    };
  }, [player, onError, onBuffering, syncPlaybackState]);

  return (
    <View style={[styles.nativeContainer, style]} focusable={false}>
      <VideoView
        style={[StyleSheet.absoluteFill, styles.videoViewFill]}
        player={player}
        surfaceType={Platform.OS === 'android' ? 'surfaceView' : 'textureView'}
        contentFit={contentFit}
        nativeControls={false}
        focusable={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  nativeContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoViewFill: {
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  autoplayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  playBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  playBtnFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.1 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 16,
  },
  playBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  playBtnTextFocused: {
    color: '#000000',
  },
});
