import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

export const TVEmbedPlayer: React.FC<{
  url: string;
  style?: StyleProp<ViewStyle>;
  onError?: (err: string) => void;
}> = ({ url, style }) => {
  return (
    <View style={[StyleSheet.absoluteFill, styles.container, style]}>
      <iframe
        src={url}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
});
