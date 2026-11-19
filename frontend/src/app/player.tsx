import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

/**
 * صفحة إعادة التوجيه التلقائي للمسار القديم أو البديل /player.
 * توجّه تلقائياً إلى /play/[id] إذا تواجد معرف المحتوى، أو إلى /home في الحالات الأخرى.
 */
export default function PlayerRedirectScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    url?: string;
    title?: string;
    logo?: string;
    type?: string;
    tmdbId?: string;
    imdbId?: string;
    season?: string;
    episode?: string;
  }>();

  useEffect(() => {
    if (params.id) {
      const cleanParams: Record<string, string> = {};
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && key !== 'id') {
          cleanParams[key] = Array.isArray(val) ? val[0] : String(val);
        }
      });
      const queryStr = new URLSearchParams(cleanParams).toString();
      const targetPath = `/play/${encodeURIComponent(params.id)}${queryStr ? `?${queryStr}` : ''}`;
      router.replace(targetPath as any);
    } else {
      router.replace('/home');
    }
  }, [params, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#38bdf8" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
