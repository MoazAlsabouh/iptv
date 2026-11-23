import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';

let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch {}
}

const DEFAULT_BASE_URL = 'https://tv.moazns.sy';
const DEFAULT_REFERER = 'https://tv.moazns.sy/';

export const TVEmbedPlayer: React.FC<{
  url: string;
  style?: StyleProp<ViewStyle>;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (err: string) => void;
  onEnded?: () => void;
}> = ({ url, style, onBuffering, onError, onEnded }) => {
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    // مهلة أمان قصيرة لإخفاء مؤشر التحميل تلقائياً في وضع السيرفرات المدمجة
    const timer = setTimeout(() => {
      onBuffering?.(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [url, onBuffering]);

  // معالجة رابط يوتيوب وضمان معاملات السياسة الجديدة واستبدال nocookie على منصات Native
  const processedUrl = useMemo(() => {
    let finalUrl = url || '';
    const isYouTube =
      finalUrl.includes('youtube.com') ||
      finalUrl.includes('youtube-nocookie.com') ||
      finalUrl.includes('youtu.be');

    if (isYouTube) {
      // على منصة Android / Native نستخدم youtube.com بدلاً من youtube-nocookie.com لتفادي Error 153
      if (Platform.OS !== 'web' && finalUrl.includes('youtube-nocookie.com')) {
        finalUrl = finalUrl.replace('youtube-nocookie.com', 'youtube.com');
      }

      // إضافة معاملات origin و widget_referrer و enablejsapi=1
      const originParam = 'origin=https%3A%2F%2Ftv.moazns.sy';
      const referrerParam = 'widget_referrer=https%3A%2F%2Ftv.moazns.sy';
      const jsApiParam = 'enablejsapi=1';

      const sep = finalUrl.includes('?') ? '&' : '?';
      const additions: string[] = [];
      if (!finalUrl.includes('origin=')) additions.push(originParam);
      if (!finalUrl.includes('widget_referrer=')) additions.push(referrerParam);
      if (!finalUrl.includes('enablejsapi=')) additions.push(jsApiParam);

      if (additions.length > 0) {
        finalUrl = `${finalUrl}${sep}${additions.join('&')}`;
      }
    }
    return finalUrl;
  }, [url]);

  // استماع لرسائل انتهاء الفيديو (postMessage) على بيئة الويب
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWindowMessage = (event: MessageEvent) => {
      try {
        if (
          event.origin &&
          (String(event.origin).includes('youtube.com') ||
            String(event.origin).includes('youtube-nocookie.com'))
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

  if (Platform.OS !== 'web' && WebView) {
    const escapedUrl = processedUrl.replace(/"/g, '&quot;');
    const htmlContent = `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background-color: #000;
      overflow: hidden;
    }
    #player-frame {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
    }
  </style>
</head>
<body>
  <iframe
    id="player-frame"
    src="${escapedUrl}"
    referrerpolicy="strict-origin-when-cross-origin"
    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
    allowfullscreen
  ></iframe>
  <script>
    (function() {
      window.addEventListener('message', function(e) {
        try {
          var d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (!d) return;
          if ((d.event === 'onStateChange' && (Number(d.info) === 0 || Number(d.data) === 0)) ||
              (d.event === 'infoDelivery' && d.info && Number(d.info.playerState) === 0)) {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' }));
            }
          }
        } catch(err) {}
      });
    })();
  </script>
</body>
</html>`;

    return (
      <View style={[StyleSheet.absoluteFill, styles.container, style]}>
        <WebView
          source={{
            html: htmlContent,
            baseUrl: DEFAULT_BASE_URL,
            headers: {
              Referer: DEFAULT_REFERER,
            },
          }}
          style={styles.webview}
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

  return (
    <View style={[StyleSheet.absoluteFill, styles.container, style]}>
      <iframe
        src={processedUrl}
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
