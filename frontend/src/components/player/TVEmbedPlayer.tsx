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
}> = ({ url, style, onBuffering, onError }) => {
  useEffect(() => {
    // مهلة أمان قصيرة لإخفاء مؤشر التحميل تلقائياً في وضع السيرفرات المدمجة
    const timer = setTimeout(() => {
      onBuffering?.(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [url, onBuffering]);

  const handleLoaded = () => {
    onBuffering?.(false);
  };

  if (Platform.OS !== 'web' && WebView) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.container, style]}>
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          allowsFullscreenVideo={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
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
