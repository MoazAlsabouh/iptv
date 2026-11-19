import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Platform, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import Hls from 'hls.js';

export interface HlsLevelOption {
  id: number; // -1 for auto
  label: string;
  height?: number;
  bitrate?: number;
}

export interface TVPlayerProps {
  streamUrl: string;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (errorMessage: string) => void;
  onLevelsLoaded?: (levels: HlsLevelOption[]) => void;
  selectedLevel?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * مشغل فيديو متطور يدعم شاشات التلفاز والويب وأجهزة Android/iOS.
 * - يستخدم hls.js لبث قنوات m3u8 الحية بكفاءة عالية على المتصفحات والشاشات الذكية.
 * - يدعم استخراج وتبديل مستويات الجودة Hls Levels ومعالجة Autoplay.
 * - يدعم تشغيل السيرفرات المدمجة مباشرة عبر iframe دون قيود sandbox لضمان التوافق التام.
 */
export const TVPlayer: React.FC<TVPlayerProps> = ({
  streamUrl,
  onBuffering,
  onError,
  onLevelsLoaded,
  selectedLevel = -1,
  style,
}) => {
  const videoHtmlRef = useRef<HTMLVideoElement | null>(null);
  const nativeVideoRef = useRef<Video>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [needsUserPlay, setNeedsUserPlay] = useState<boolean>(false);

  // تخزين دوال رد الاتصال في refs لتجنب إعادة تشغيل useEffect عند كل re-render
  const onBufferingRef = useRef(onBuffering);
  onBufferingRef.current = onBuffering;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onLevelsLoadedRef = useRef(onLevelsLoaded);
  onLevelsLoadedRef.current = onLevelsLoaded;

  const isEmbedUrl =
    streamUrl.includes('/embed/') ||
    streamUrl.includes('vidsrc') ||
    streamUrl.includes('vidlink.pro') ||
    streamUrl.includes('embed.su') ||
    streamUrl.includes('autoembed') ||
    streamUrl.includes('2embed') ||
    streamUrl.includes('dailymotion.com') ||
    streamUrl.includes('youtube.com/embed') ||
    streamUrl.includes('youtube.com') ||
    streamUrl.includes('youtu.be') ||
    streamUrl.includes('player.');

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

    const clearPlaybackTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const onPlaySuccess = () => {
      playbackStarted = true;
      clearPlaybackTimeout();
      onBufferingRef.current?.(false);
    };

    const onVideoError = () => {
      clearPlaybackTimeout();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      onErrorRef.current?.('تعذر الاتصال بمصدر البث، يرجى إعادة المحاولة أو اختيار مصدر آخر');
    };

    videoEl.addEventListener('playing', onPlaySuccess);
    videoEl.addEventListener('canplay', onPlaySuccess);
    videoEl.addEventListener('error', onVideoError);

    // مؤقت أمان لمدة 10 ثوانٍ
    timeoutId = setTimeout(() => {
      if (!playbackStarted) {
        clearPlaybackTimeout();
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        onErrorRef.current?.('استغرق الاتصال بمصدر البث وقتاً أطول من المتوقع');
      }
    }, 10000);

    const safePlay = () => {
      videoEl.play().catch((err: any) => {
        if (err.name === 'AbortError') {
          return;
        }
        if (err.name === 'NotAllowedError') {
          clearPlaybackTimeout();
          setNeedsUserPlay(true);
        } else {
          console.warn('[TVPlayer] Play warning:', err);
        }
      });
    };

    const isM3u8 = streamUrl.toLowerCase().includes('.m3u8') || streamUrl.includes('playlist');

    if (isM3u8 && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        safePlay();

        const levels: HlsLevelOption[] = [
          { id: -1, label: 'تلقائي (Auto)' },
        ];

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
          clearPlaybackTimeout();
          hls.destroy();
          hlsRef.current = null;
          onErrorRef.current?.('تعذر الاتصال بمصدر البث، يرجى إعادة المحاولة أو اختيار مصدر آخر');
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = streamUrl;
      videoEl.addEventListener('loadedmetadata', safePlay, { once: true });
    } else {
      videoEl.src = streamUrl;
      videoEl.addEventListener('loadedmetadata', safePlay, { once: true });
    }

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
            src={streamUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: '#000000',
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
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

  // البيئات الأصلية (Native - Android TV / Fire TV)
  return (
    <Video
      ref={nativeVideoRef}
      source={{ uri: streamUrl }}
      style={[styles.container, style]}
      resizeMode={ResizeMode.CONTAIN}
      shouldPlay
      isLooping={false}
      useNativeControls={false}
      onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          if (status.error) {
            onErrorRef.current?.(status.error);
          }
        } else {
          onBufferingRef.current?.(status.isBuffering);
        }
      }}
    />
  );
};

const styles = StyleSheet.create({
  container: {
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
