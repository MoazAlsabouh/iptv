import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, StyleProp, ViewStyle } from 'react-native';

export interface AdVideoPlayerProps {
  videoUrl: string;
  onEnded: () => void;
  onError?: (error: string) => void;
  contentFit?: 'contain' | 'cover' | 'fill';
  style?: StyleProp<ViewStyle>;
}

/**
 * مشغل إعلانات ذكي خفيف وسلس يدعم تشغيل ملفات MP4 المباشرة (مثل Cloudflare R2)
 * عبر HTML5 Video على الويب و expo-video على الأندرويد والتلفاز
 */
export const AdVideoPlayer: React.FC<AdVideoPlayerProps> = ({
  videoUrl,
  onEnded,
  onError,
  contentFit = 'contain',
  style,
}) => {
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  if (Platform.OS === 'web') {
    return (
      <View style={[StyleSheet.absoluteFill, styles.container, style]}>
        <video
          key={videoUrl}
          src={videoUrl}
          autoPlay
          playsInline
          controls={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: contentFit,
            backgroundColor: '#000000',
          }}
          onEnded={() => onEndedRef.current?.()}
          onError={(e: any) => {
            console.warn('[AdVideoPlayer Web] Video error:', e);
            onErrorRef.current?.('فشل تشغيل الإعلان');
          }}
        />
      </View>
    );
  }

  // على Android / Android TV / iOS: استخدام expo-video
  return (
    <NativeAdPlayer
      videoUrl={videoUrl}
      onEnded={() => onEndedRef.current?.()}
      onError={(err) => onErrorRef.current?.(err)}
      contentFit={contentFit}
      style={style}
    />
  );
};

// مكون منفصل للمنصات الأصلية لتجنب استدعاء هوك useVideoPlayer على الويب
let NativeAdPlayer: React.FC<AdVideoPlayerProps> = ({ onEnded }) => {
  useEffect(() => {
    onEnded();
  }, [onEnded]);
  return <View style={StyleSheet.absoluteFill} />;
};

if (Platform.OS !== 'web') {
  try {
    const { useVideoPlayer, VideoView } = require('expo-video');

    NativeAdPlayer = ({ videoUrl, onEnded, onError, contentFit = 'contain', style }) => {
      const player = useVideoPlayer(videoUrl, (p) => {
        p.loop = false;
        try {
          p.play();
        } catch {}
      });

      useEffect(() => {
        if (!player) return;

        const endSub = player.addListener('playToEnd', () => {
          onEnded();
        });

        const statusSub = player.addListener('statusChange', (status: any) => {
          if (status?.status === 'error') {
            onError?.(status?.error?.message || 'خطأ أثناء تشغيل الإعلان');
          }
        });

        return () => {
          endSub?.remove();
          statusSub?.remove();
        };
      }, [player, onEnded, onError]);

      return (
        <View style={[StyleSheet.absoluteFill, styles.container, style]}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit={contentFit}
            nativeControls={false}
          />
        </View>
      );
    };
  } catch (err) {
    console.warn('[AdVideoPlayer] Could not load expo-video for native ad player:', err);
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000',
  },
});
