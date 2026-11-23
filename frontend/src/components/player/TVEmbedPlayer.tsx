import React, { useEffect } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Platform } from 'react-native';

let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch {}
}

export const TVEmbedPlayer: React.FC<{
  url: string;
  style?: StyleProp<ViewStyle>;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (err: string) => void;
  onEnded?: () => void;
}> = ({ url, style, onBuffering, onError, onEnded }) => {
  const onEndedRef = React.useRef(onEnded);
  onEndedRef.current = onEnded;

  useEffect(() => {
    // مهلة أمان قصيرة لإخفاء مؤشر التحميل تلقائياً في وضع السيرفرات المدمجة
    const timer = setTimeout(() => {
      onBuffering?.(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [url, onBuffering]);

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
    const injectedJS = `
      (function() {
        window.addEventListener('message', function(e) {
          try {
            var d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
            if (!d) return;
            if ((d.event === 'onStateChange' && (Number(d.info) === 0 || Number(d.data) === 0)) ||
                (d.event === 'infoDelivery' && d.info && Number(d.info.playerState) === 0)) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ended' }));
            }
          } catch(err) {}
        });
      })();
      true;
    `;

    return (
      <View style={[StyleSheet.absoluteFill, styles.container, style]}>
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          allowsFullscreenVideo={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          injectedJavaScript={injectedJS}
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
        src={url}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture; accelerometer; clipboard-write; gyroscope"
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
