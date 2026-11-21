import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Platform, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { MaterialIcons } from '@expo/vector-icons';
import Hls from 'hls.js';
import { shouldAutoProxy, getProxyStreamUrl } from '../../utils/proxy';
import { TVEmbedPlayer } from './TVEmbedPlayer';

export interface HlsLevelOption {
  id: number; // -1 for auto
  label: string;
  height?: number;
  bitrate?: number;
}

export interface TVPlayerProps {
  streamUrl: string;
  streamType?: 'auto' | 'hls' | 'youtube' | 'iframe';
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (errorMessage: string) => void;
  onLevelsLoaded?: (levels: HlsLevelOption[]) => void;
  selectedLevel?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * تحويل أي رابط يوتيوب بمختلف صيغه إلى رابط embed جاهز للتشغيل التلقائي
 */
export function normalizeYouTubeEmbedUrl(url: string): string {
  if (!url) return url;
  try {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
    );
    if (match && match[1]) {
      const videoId = match[1];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&enablejsapi=1`;
    }
  } catch {}
  return url;
}

/**
 * مشغل فيديو متطور يدعم شاشات التلفاز والويب وأجهزة Android/iOS.
 * - يستخدم hls.js لبث قنوات m3u8 الحية بكفاءة عالية على المتصفحات والشاشات الذكية.
 * - يدعم استخراج وتبديل مستويات الجودة Hls Levels ومعالجة Autoplay.
 * - يدعم تشغيل السيرفرات المدمجة مباشرة عبر iframe دون قيود sandbox لضمان التوافق التام.
 */
export const TVPlayer: React.FC<TVPlayerProps> = ({
  streamUrl,
  streamType = 'auto',
  onBuffering,
  onError,
  onLevelsLoaded,
  selectedLevel = -1,
  style,
}) => {
  const videoHtmlRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [needsUserPlay, setNeedsUserPlay] = useState<boolean>(false);

  // تخزين دوال رد الاتصال في refs لتجنب إعادة تشغيل useEffect عند كل re-render
  const onBufferingRef = useRef(onBuffering);
  onBufferingRef.current = onBuffering;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onLevelsLoadedRef = useRef(onLevelsLoaded);
  onLevelsLoadedRef.current = onLevelsLoaded;

  const isYouTube =
    streamType === 'youtube' ||
    streamUrl.includes('youtube.com') ||
    streamUrl.includes('youtu.be');

  const isEmbedUrl =
    streamType === 'youtube' ||
    streamType === 'iframe' ||
    isYouTube ||
    streamUrl.includes('/embed/') ||
    streamUrl.includes('vidsrc') ||
    streamUrl.includes('vidlink.pro') ||
    streamUrl.includes('embed.su') ||
    streamUrl.includes('autoembed') ||
    streamUrl.includes('2embed') ||
    streamUrl.includes('dailymotion.com') ||
    streamUrl.includes('player.');

  const finalEmbedUrl = React.useMemo(() => {
    if (!isEmbedUrl) return streamUrl;
    let url = streamUrl;

    if (isYouTube) {
      url = normalizeYouTubeEmbedUrl(url);
    }

    // إزالة أي معاملات لكتم الصوت مثل mute=1 أو muted=1
    url = url
      .replace(/([?&])(?:mute|muted)=(?:1|true|yes)(&|$)/gi, '$1')
      .replace(/[?&]$/, '');

    if (isYouTube && !url.includes('enablejsapi=1')) {
      url = url + (url.includes('?') ? '&' : '?') + 'enablejsapi=1';
    }
    return url;
  }, [streamUrl, isEmbedUrl, isYouTube]);

  // استماع لرسائل أخطاء يوتيوب (postMessage) من الـ iframe للتنقل التلقائي عند الحظر أو تقييد العمر
  useEffect(() => {
    if (Platform.OS !== 'web' || !isEmbedUrl) {
      return;
    }

    const handleWindowMessage = (event: MessageEvent) => {
      try {
        if (
          event.origin &&
          (event.origin.includes('youtube.com') || event.origin.includes('youtube-nocookie.com'))
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

          // أكواد أخطاء يوتيوب: 100 (محذوف)، 101/150 (معطل التضمين)، 152 (مقيد بالعمر)
          if (data.event === 'onError' || data.info !== undefined) {
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
    if (Platform.OS !== 'web' || !streamUrl) {
      return;
    }

    if (isEmbedUrl) {
      onBufferingRef.current?.(false);
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
    let timeoutId: NodeJS.Timeout | null = null;
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

    videoEl.addEventListener('playing', onPlaySuccess);
    videoEl.addEventListener('canplay', onPlaySuccess);
    videoEl.addEventListener('error', onVideoError);

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

      const isM3u8 =
        urlToLoad.toLowerCase().includes('.m3u8') ||
        urlToLoad.includes('playlist') ||
        urlToLoad.includes('/api/proxy');

      if (isM3u8 && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
        });

        hlsRef.current = hls;
        hls.loadSource(urlToLoad);
        hls.attachMedia(videoEl);

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
          if (data.fatal) {
            const isNetworkOrBlocked =
              data.type === Hls.ErrorTypes.NETWORK_ERROR ||
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
              data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
              (data.response && (data.response.code === 403 || data.response.code === 0));

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
            onErrorRef.current?.('تعذر الاتصال بمصدر البث، يرجى إعادة المحاولة أو اختيار مصدر آخر');
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
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
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
            objectFit: 'contain',
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
        onError={onError}
      />
    );
  }

  // روابط البث التلفزيوني العادية (HLS / m3u8) عبر expo-video
  return (
    <NativeVideoPlayer
      streamUrl={streamUrl}
      style={style}
      onBuffering={onBuffering}
      onError={onError}
    />
  );
};

/**
 * مشغل الفيديو للأجهزة الأصلية (Android / Android TV / iOS) باستخدام expo-video الحديثة
 */
const NativeVideoPlayer: React.FC<{
  streamUrl: string;
  style?: StyleProp<ViewStyle>;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (errorMessage: string) => void;
}> = ({ streamUrl, style, onBuffering, onError }) => {
  const player = useVideoPlayer(streamUrl, (p) => {
    p.loop = false;
    p.muted = false;
    p.volume = 1.0;
    p.play();
  });

  useEffect(() => {
    const statusSub = player.addListener('statusChange', ({ status, error }: any) => {
      if (status === 'error') {
        onError?.(error?.message || 'تعذر تشغيل البث على المشغل');
      } else if (status === 'loading') {
        onBuffering?.(true);
      } else if (status === 'readyToPlay') {
        onBuffering?.(false);
      }
    });

    return () => {
      statusSub.remove();
    };
  }, [player, onError, onBuffering]);

  return (
    <View style={[styles.nativeContainer, style]}>
      <VideoView
        style={[StyleSheet.absoluteFill, styles.videoViewFill]}
        player={player}
        surfaceType="textureView"
        contentFit="contain"
        nativeControls={false}
      />
    </View>
  );
};

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
    ...StyleSheet.absoluteFillObject,
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
