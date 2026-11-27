import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

const YOUTUBE_EMBED_BASE = 'https://iptv-backend.moaznsm.workers.dev/embed/yt';
const CHROME_TV_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function extractYouTubeIdAndStart(rawUrl: string): { videoId: string; start: number } {
  let videoId = '';
  let start = 0;
  if (!rawUrl) return { videoId, start };

  const trimmed = rawUrl.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { videoId: trimmed, start: 0 };
  }

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const startParam = parsed.searchParams.get('start') || parsed.searchParams.get('t') || '';
    if (startParam) {
      start = parseInt(startParam.replace('s', ''), 10) || 0;
    }

    if (parsed.hostname.includes('youtu.be')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      videoId = parts[0] || '';
    } else if (parsed.pathname.startsWith('/embed/yt')) {
      videoId = parsed.searchParams.get('v') || '';
    } else if (parsed.pathname.startsWith('/embed/')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      videoId = parts[1] || '';
    } else if (parsed.pathname.startsWith('/shorts/') || parsed.pathname.startsWith('/live/')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      videoId = parts[1] || '';
    } else {
      videoId = parsed.searchParams.get('v') || '';
    }
  } catch {
    const vMatch = trimmed.match(/(?:[?&]v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([a-zA-Z0-9_-]{11})/);
    const startMatch = trimmed.match(/[?&](?:start|t)=([0-9]+)/);
    if (vMatch && vMatch[1]) videoId = vMatch[1];
    if (startMatch && startMatch[1]) start = parseInt(startMatch[1], 10) || 0;
  }

  return { videoId, start: Math.max(0, start) };
}

export const TVEmbedPlayer: React.FC<{
  url: string;
  style?: StyleProp<ViewStyle>;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (err: string) => void;
  onEnded?: () => void;
}> = ({ url, style, onBuffering, onError, onEnded }) => {
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const webViewRef = useRef<any>(null);

  useEffect(() => {
    // مهلة أمان لإخفاء مؤشر التحميل تلقائياً
    const timer = setTimeout(() => {
      onBuffering?.(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [url, onBuffering]);

  // التحقق مما إذا كان الرابط يخص يوتيوب
  const isYouTube = useMemo(() => {
    const u = (url || '').toLowerCase();
    return (
      u.includes('youtube.com') ||
      u.includes('youtube-nocookie.com') ||
      u.includes('youtu.be') ||
      u.includes('/embed/yt')
    );
  }, [url]);

  const ytInfo = useMemo(() => {
    if (!isYouTube) return null;
    return extractYouTubeIdAndStart(url);
  }, [url, isYouTube]);

  const currentVideoIdRef = useRef<string>(ytInfo?.videoId || '');

  // تثبيت المصدر الأولي لمنع إعادة تحميل صفحة WebView بالكامل عند التنقل بين الحلقات
  const initialSourceRef = useRef<any>(null);
  if (!initialSourceRef.current) {
    if (ytInfo && ytInfo.videoId) {
      initialSourceRef.current = {
        uri: `${YOUTUBE_EMBED_BASE}?v=${encodeURIComponent(ytInfo.videoId)}&start=${ytInfo.start}`,
      };
    } else {
      initialSourceRef.current = { uri: url };
    }
  }

  // على أندرويد/الشاشات: تمرير الحلقة التالية لنفس المشغل عبر loadVideoById مباشرة دون unmount/remount
  useEffect(() => {
    if (!ytInfo?.videoId) return;

    if (currentVideoIdRef.current && currentVideoIdRef.current !== ytInfo.videoId) {
      currentVideoIdRef.current = ytInfo.videoId;
      const js = `
        (function() {
          try {
            if (typeof loadNextVideo === 'function') {
              loadNextVideo('${ytInfo.videoId}', ${ytInfo.start});
            } else if (window.player && typeof window.player.loadVideoById === 'function') {
              window.player.loadVideoById({ videoId: '${ytInfo.videoId}', startSeconds: ${ytInfo.start} });
              try { window.player.unloadModule('captions'); window.player.unloadModule('cc'); } catch(e){}
            }
          } catch(e) {}
        })();
        true;
      `;
      webViewRef.current?.injectJavaScript(js);
    } else if (!currentVideoIdRef.current && ytInfo.videoId) {
      currentVideoIdRef.current = ytInfo.videoId;
    }
  }, [ytInfo?.videoId, ytInfo?.start]);

  const handleLoaded = () => {
    onBuffering?.(false);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={isYouTube ? initialSourceRef.current : { uri: url }}
        style={[StyleSheet.absoluteFill, styles.webview]}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        originWhitelist={['*']}
        userAgent={CHROME_TV_USER_AGENT}
        mixedContentMode="compatibility"
        onMessage={(event: any) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'ended') {
              onEndedRef.current?.();
            }
          } catch {}
        }}
        onLoadStart={() => onBuffering?.(true)}
        onLoadEnd={handleLoaded}
        onError={(syntheticEvent: any) => {
          handleLoaded();
          const { nativeEvent } = syntheticEvent;
          onError?.(nativeEvent?.description || 'فشل تشغيل الرابط في المشغل');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});
