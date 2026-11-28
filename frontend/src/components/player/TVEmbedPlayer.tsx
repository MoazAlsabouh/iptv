import React, { useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';

let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch {}
}

const YOUTUBE_EMBED_BASE = 'https://iptv-backend.moaznsm.workers.dev/embed/yt';
const CHROME_TV_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * دالة مساعدة لاستخراج معرّف يوتيوب وثانية البداية من أي صيغة رابط
 */
export function extractYouTubeIdAndStart(rawUrl: string): { videoId: string; start: number } {
  let videoId = '';
  let start = 0;
  if (!rawUrl) return { videoId, start };

  const trimmed = rawUrl.trim();

  // إذا كان المعرّف مجرداً بطول 11 حرفاً
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

export interface TVEmbedPlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
}

export interface TVEmbedPlayerProps {
  url: string;
  style?: StyleProp<ViewStyle>;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (err: string) => void;
  onEnded?: () => void;
}

export const TVEmbedPlayer = forwardRef<TVEmbedPlayerHandle, TVEmbedPlayerProps>(({
  url,
  style,
  onBuffering,
  onError,
  onEnded,
}, ref) => {
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const webViewRef = useRef<any>(null);

  useEffect(() => {
    // مهلة أمان قصيرة لإخفاء مؤشر التحميل تلقائياً في وضع السيرفرات المدمجة
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

  const currentSecRef = useRef<number>(ytInfo?.start || 0);

  useImperativeHandle(ref, () => ({
    play: () => {
      try {
        webViewRef.current?.injectJavaScript(`
          (function() {
            try {
              if (window.player && typeof window.player.playVideo === 'function') {
                window.player.playVideo();
              }
            } catch(e) {}
          })();
          true;
        `);
      } catch {}
    },
    pause: () => {
      try {
        webViewRef.current?.injectJavaScript(`
          (function() {
            try {
              if (window.player && typeof window.player.pauseVideo === 'function') {
                window.player.pauseVideo();
              }
            } catch(e) {}
          })();
          true;
        `);
      } catch {}
    },
    seekTo: (seconds: number) => {
      try {
        currentSecRef.current = seconds;
        webViewRef.current?.injectJavaScript(`
          (function() {
            try {
              if (window.player && typeof window.player.seekTo === 'function') {
                window.player.seekTo(${seconds}, true);
              }
            } catch(e) {}
          })();
          true;
        `);
      } catch {}
    },
    getCurrentTime: () => currentSecRef.current,
  }));

  // تحديد رابط المصدر الأولي لـ WebView دون إعادة تحميل عند التنقل بين الحلقات
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
    if (!ytInfo?.videoId || Platform.OS === 'web') return;

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

  // استماع لرسائل انتهاء الفيديو (postMessage) على بيئة الويب
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWindowMessage = (event: MessageEvent) => {
      try {
        if (
          event.origin &&
          (String(event.origin).includes('youtube.com') ||
            String(event.origin).includes('youtube-nocookie.com') ||
            String(event.origin).includes('iptv-backend.moaznsm.workers.dev'))
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
            (data.event === 'infoDelivery' && data.info && Number(data.info.playerState) === 0) ||
            data.type === 'ended'
          ) {
            onEndedRef.current?.();
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleWindowMessage);
    return () => {
      window.removeEventListener('message', handleWindowMessage);
    };
  }, []);

  const handleLoaded = () => {
    onBuffering?.(false);
  };

  // على منصة Native / Android TV: تحميل صفحة Worker الموثقة كـ uri حقيقي مع استقرار المشغل
  if (Platform.OS !== 'web' && WebView) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.container, style]}>
        <WebView
          ref={webViewRef}
          source={isYouTube ? initialSourceRef.current : { uri: url }}
          style={styles.webview}
          userAgent={CHROME_TV_USER_AGENT}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          allowsFullscreenVideo={true}
          originWhitelist={['*']}
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
            onError?.(syntheticEvent.nativeEvent?.description || 'فشل تحميل المشغل المدمج');
          }}
        />
      </View>
    );
  }

  // على منصة Web: الإبقاء على iframe كما هو لأنه يعمل بنجاح
  return (
    <View style={[StyleSheet.absoluteFill, styles.container, style]}>
      <iframe
        src={url}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        referrerPolicy="strict-origin-when-cross-origin"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        onLoad={handleLoaded}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});
