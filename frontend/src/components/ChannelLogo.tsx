import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface ChannelLogoProps {
  uri?: string;
  name: string;
  size?: number;
  focused?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * مكون ذكي وموحد لعرض شعارات القنوات
 * في حال كان الرابط مفقوداً أو تالفاً (404 / onError)، يعرض بديلاً أنيقاً بخلفية داكنة وأيقونة تلفاز/حروف القناة.
 */
export const ChannelLogo: React.FC<ChannelLogoProps> = ({
  uri,
  name,
  size = 56,
  focused = false,
  style,
}) => {
  const [hasError, setHasError] = useState<boolean>(false);

  // إعادة ضبط حالة الخطأ عند تغير رابط الشعار
  useEffect(() => {
    setHasError(false);
  }, [uri]);

  const cleanUri = uri?.trim();
  const isValidUrl = Boolean(
    cleanUri &&
      cleanUri.length > 8 &&
      (cleanUri.startsWith('http://') || cleanUri.startsWith('https://')) &&
      !cleanUri.includes('twimg.com')
  );

  const showFallback = !isValidUrl || hasError;

  // استخراج أول حرفين من اسم القناة للبديل النصي
  const initials = name
    ? name
        .trim()
        .replace(/[^a-zA-Z\u0600-\u06FF0-9]/g, '')
        .slice(0, 2)
    : '';

  const containerSize = { width: size, height: size, borderRadius: Math.round(size * 0.22) };

  if (showFallback) {
    const iconSize = Math.round(size * 0.48);
    return (
      <View
        style={[
          styles.fallbackContainer,
          containerSize,
          focused && styles.fallbackContainerFocused,
          style,
        ]}
      >
        <MaterialIcons
          name="tv"
          size={iconSize}
          color={focused ? '#0284c7' : '#38bdf8'}
        />
        {initials.length > 0 && size >= 60 ? (
          <Text
            numberOfLines={1}
            style={[styles.initialsText, focused && styles.initialsTextFocused]}
          >
            {initials}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.imageContainer, containerSize, style]}>
      <Image
        source={{ uri: cleanUri }}
        onError={() => setHasError(true)}
        resizeMode="contain"
        style={styles.image}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    padding: 4,
  },
  fallbackContainerFocused: {
    backgroundColor: '#f1f5f9',
    borderColor: '#0284c7',
  },
  initialsText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginTop: 2,
  },
  initialsTextFocused: {
    color: '#0f172a',
  },
  imageContainer: {
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    padding: 6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

export default ChannelLogo;
