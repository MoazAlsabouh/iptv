import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

export const TVEmbedPlayer: React.FC<{
  url: string;
  style?: StyleProp<ViewStyle>;
  onError?: (err: string) => void;
}> = ({ url, style, onError }) => {
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
        onError={(syntheticEvent) => {
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
