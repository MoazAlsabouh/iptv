import React, { useEffect, useRef } from 'react';
import { View, Platform, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
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
 * ويعتمد على expo-av في بيئات التشغيل الأصلية (Native Platforms).
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

  // إعداد hls.js على بيئة الويب وشاشات التلفاز الذكية (Web/Smart TV)
  useEffect(() => {
    if (Platform.OS !== 'web' || !streamUrl) {
      return;
    }

    const videoEl = videoHtmlRef.current;
    if (!videoEl) return;

    // تنظيف أي نسخة سابقة من Hls
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

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
        onBuffering?.(false);
        videoEl.play().catch((err) => {
          console.warn('[TVPlayer] Autoplay prevented:', err);
        });
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
              onError?.(`خطأ غير قابل للاسترداد في بث HLS: ${data.details}`);
              break;
          }
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // دعم HLS المدمج (مثل متصفحات Apple وبعض شاشات التلفاز الذكية)
      videoEl.src = streamUrl;
      videoEl.play().catch((err) => console.warn('[TVPlayer] Native play warning:', err));
    } else {
      // تشغيل مباشر لملفات MP4 و VOD
      videoEl.src = streamUrl;
      videoEl.play().catch((err) => console.warn('[TVPlayer] Play warning:', err));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, onBuffering, onError]);

  // في بيئة الويب وشاشات Smart TV Web (Tizen, WebOS, Android TV WebView)
  if (Platform.OS === 'web') {
    return (
      <View style={[StyleSheet.absoluteFillObject, style]} className="bg-black justify-center items-center">
        {/* عنصر HTML5 video أصلي محقون داخل واجهة الويب */}
        <video
          ref={videoHtmlRef}
          controls
          autoPlay
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: 'black',
          }}
          onWaiting={() => onBuffering?.(true)}
          onPlaying={() => onBuffering?.(false)}
          onError={() => onError?.('تعذر تحميل البث المباشر')}
        />
      </View>
    );
  }

  // في بيئات التشغيل الأصلية (React Native / Android TV / Apple TV via expo-av)
  return (
    <Video
      ref={nativeVideoRef}
      style={[StyleSheet.absoluteFillObject, style]}
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
