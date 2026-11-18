import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Platform, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import Hls from 'hls.js';

interface TVPlayerProps {
  streamUrl: string;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (errorMessage: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * مشغل فيديو متطور يدعم شاشات التلفاز والويب وأجهزة Android/iOS.
 * يستخدم hls.js لبث قنوات m3u8 الحية بكفاءة عالية على المتصفحات والشاشات الذكية،
 * ويعالج أخطاء التشغيل التلقائي (Autoplay / AbortError) مع زر تشغيل يدوي للريموت.
 */
export const TVPlayer: React.FC<TVPlayerProps> = ({
  streamUrl,
  onBuffering,
  onError,
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

  // إعداد hls.js على بيئة الويب وشاشات التلفاز الذكية
  useEffect(() => {
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

    const safePlay = () => {
      videoEl.play().catch((err: any) => {
        // تجاهل خطأ AbortError الناتج عن إلغاء طلب التشغيل عند التحميل الجديد
        if (err.name === 'AbortError') {
          return;
        }
        // إذا منع المتصفح التشغيل التلقائي (Autoplay Policy) نظهر زر التشغيل اليدوي
        if (err.name === 'NotAllowedError') {
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
        onBufferingRef.current?.(false);
        safePlay();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              onErrorRef.current?.(`خطأ غير قابل للاسترداد في بث HLS: ${data.details}`);
              break;
          }
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // دعم HLS المدمج (مثل متصفحات Apple وبعض شاشات التلفاز)
      videoEl.src = streamUrl;
      videoEl.addEventListener('loadedmetadata', safePlay, { once: true });
    } else {
      // تشغيل مباشر لملفات MP4 و VOD
      videoEl.src = streamUrl;
      videoEl.addEventListener('loadedmetadata', safePlay, { once: true });
    }

    // دالة التنظيف عند تغيير القناة أو مغادرة الصفحة
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
      }
    };
  }, [streamUrl]);

  const handleManualPlay = () => {
    if (videoHtmlRef.current) {
      videoHtmlRef.current.play().then(() => {
        setNeedsUserPlay(false);
      }).catch((e) => console.warn('Manual play failed:', e));
    }
  };

  // في بيئة الويب وشاشات Smart TV Web
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]}>
        <video
          ref={videoHtmlRef}
          controls
          autoPlay
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: '#000000',
          }}
          onWaiting={() => onBufferingRef.current?.(true)}
          onPlaying={() => {
            onBufferingRef.current?.(false);
            setNeedsUserPlay(false);
          }}
          onError={() => onErrorRef.current?.('تعذر تحميل البث المباشر')}
        />

        {/* زر تشغيل يدوي للريموت في حال منع المتصفح التشغيل التلقائي */}
        {needsUserPlay && (
          <View style={styles.overlayCenter}>
            <Pressable
              hasTVPreferredFocus
              onPress={handleManualPlay}
              style={({ focused }) => [
                styles.manualPlayBtn,
                focused && styles.manualPlayBtnFocused,
              ]}
            >
              {({ focused }) => (
                <View style={styles.btnContent}>
                  <MaterialIcons
                    name="play-arrow"
                    size={36}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text style={[styles.btnText, focused && styles.btnTextFocused]}>
                    اضغط للتشغيل (OK)
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // في بيئات التشغيل الأصلية (React Native / Android TV / Apple TV)
  return (
    <Video
      ref={nativeVideoRef}
      style={[styles.container, style]}
      source={{ uri: streamUrl }}
      useNativeControls
      resizeMode={ResizeMode.CONTAIN}
      shouldPlay
      onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          if (status.error) {
            onError?.(`خطأ في البث: ${status.error}`);
          }
        } else {
          onBuffering?.(status.isBuffering);
        }
      }}
      onError={(err) => onError?.(`فشل الاتصال بالبث: ${err}`)}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 30,
  },
  manualPlayBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  manualPlayBtnFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.1 }],
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  btnTextFocused: {
    color: '#000000',
  },
});
