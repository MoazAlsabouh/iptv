import React, { useEffect } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

export const TVEmbedPlayer: React.FC<{
  url: string;
  style?: StyleProp<ViewStyle>;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (err: string) => void;
}> = ({ url, style, onBuffering, onError }) => {
  useEffect(() => {
    // مهلة أمان لإخفاء مؤشر التحميل تلقائياً
    const timer = setTimeout(() => {
      onBuffering?.(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [url, onBuffering]);

  const handleLoaded = () => {
    onBuffering?.(false);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.container, style]}>
      <WebView
        source={{ uri: url }}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', backgroundColor: '#000000' }]}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        originWhitelist={['*']}
        userAgent="Mozilla/5.0 (Linux; Android 10; TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36"
        onLoadStart={() => onBuffering?.(true)}
        onLoadEnd={handleLoaded}
        onError={(syntheticEvent) => {
          handleLoaded();
          const { nativeEvent } = syntheticEvent;
          onError?.(nativeEvent.description || 'فشل تشغيل الرابط في المشغل');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
});
