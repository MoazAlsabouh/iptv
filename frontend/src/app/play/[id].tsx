import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { TVPlayer } from '../../components/player/TVPlayer';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';

/**
 * شاشة مشغل الفيديو بتصميم ملء الشاشة الداكن والتحكم الكامل بالريموت كنترول.
 */
export default function PlayerScreen(): React.JSX.Element {
  useKeepAwake();

  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; url: string; title?: string }>();

  const { favoriteIds, toggleFavorite } = useAppStore();

  const channelId = useMemo(() => {
    if (!params.id) return '';
    return typeof params.id === 'string' ? params.id : params.id[0] || '';
  }, [params.id]);

  const isFavorite = useMemo(() => {
    return Boolean(channelId && favoriteIds.includes(channelId));
  }, [channelId, favoriteIds]);

  const streamUrl = useMemo(() => {
    if (!params.url) return '';
    return typeof params.url === 'string'
      ? decodeURIComponent(params.url)
      : params.url[0]
      ? decodeURIComponent(params.url[0])
      : '';
  }, [params.url]);

  const channelTitle = useMemo(() => {
    if (!params.title) return '';
    return typeof params.title === 'string'
      ? decodeURIComponent(params.title)
      : params.title[0]
      ? decodeURIComponent(params.title[0])
      : '';
  }, [params.title]);

  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);

  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
  }, []);

  useEffect(() => {
    if (!showOverlay) return;

    const timer = setTimeout(() => {
      setShowOverlay(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [showOverlay]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  useTVRemoteNavigation({
    onBack: handleGoBack,
    onAnyKey: resetOverlayTimer,
  });

  const handleRetry = () => {
    setPlaybackError(null);
    setIsBuffering(true);
    setRetryKey((prev) => prev + 1);
    resetOverlayTimer();
  };

  return (
    <View style={styles.rootContainer}>
      {/* 1. مشغل الفيديو HLS */}
      {streamUrl ? (
        <TVPlayer
          key={`tv-player-${retryKey}`}
          streamUrl={streamUrl}
          style={StyleSheet.absoluteFillObject}
          onBuffering={(buffering) => setIsBuffering(buffering)}
          onError={(errorMsg) => {
            setPlaybackError(errorMsg);
            setIsBuffering(false);
          }}
        />
      ) : (
        <View style={styles.noUrlBox}>
          <MaterialIcons name="link-off" size={64} color="#ef4444" />
          <Text style={styles.noUrlText}>رابط تشغيل القناة غير متوفر</Text>
        </View>
      )}

      {/* 2. طبقة حساسة للنقر لاستعادة الواجهة عند اختفائها */}
      {!showOverlay && !playbackError && (
        <Pressable
          hasTVPreferredFocus
          onPress={resetOverlayTimer}
          style={StyleSheet.absoluteFillObject}
        >
          <View style={StyleSheet.absoluteFillObject} />
        </Pressable>
      )}

      {/* 3. عناصر التحكم العائمة العلوية */}
      {showOverlay && !playbackError && (
        <View style={styles.overlayBar}>
          <View style={styles.controlsRow}>
            {/* زر الخروج */}
            <Pressable
              hasTVPreferredFocus
              onPress={handleGoBack}
              style={({ focused }) => [
                styles.overlayBtn,
                focused && styles.overlayBtnFocused,
              ]}
            >
              {({ focused }) => (
                <View style={styles.btnRow}>
                  <MaterialIcons
                    name="arrow-back"
                    size={22}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text style={[styles.overlayBtnText, focused && styles.overlayBtnTextFocused]}>
                    خروج
                  </Text>
                </View>
              )}
            </Pressable>

            {/* عنوان القناة */}
            {channelTitle ? (
              <View style={styles.titleBadge}>
                <Text numberOfLines={1} style={styles.titleBadgeText}>
                  {channelTitle}
                </Text>
              </View>
            ) : null}

            {/* زر المفضلة */}
            {channelId ? (
              <Pressable
                onPress={() => {
                  toggleFavorite(channelId);
                  resetOverlayTimer();
                }}
                style={({ focused }) => [
                  styles.favoriteBtn,
                  isFavorite && styles.favoriteBtnActive,
                  focused && styles.overlayBtnFocused,
                ]}
              >
                {({ focused }) => (
                  <View style={styles.btnRow}>
                    <MaterialIcons
                      name={isFavorite ? 'star' : 'star-border'}
                      size={22}
                      color={
                        focused
                          ? '#000000'
                          : isFavorite
                          ? '#eab308'
                          : '#ffffff'
                      }
                    />
                    <Text
                      style={[
                        styles.favoriteText,
                        isFavorite && styles.favoriteTextActive,
                        focused && styles.overlayBtnTextFocused,
                      ]}
                    >
                      {isFavorite ? 'مفضلة' : 'إضافة للمفضلة'}
                    </Text>
                  </View>
                )}
              </Pressable>
            ) : null}
          </View>

          <View style={styles.helpHint}>
            <Text style={styles.helpHintText}>الأسهم و OK للتحكم</Text>
          </View>
        </View>
      )}

      {/* 4. مؤشر التحميل المؤقت */}
      {isBuffering && !playbackError && streamUrl ? (
        <View style={styles.bufferingContainer} pointerEvents="none">
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.bufferingText}>جاري تهيئة البث المباشر (HLS)...</Text>
        </View>
      ) : null}

      {/* 5. واجهة الخطأ مع أزرار التحكم */}
      {playbackError ? (
        <View style={styles.errorOverlay}>
          <MaterialIcons name="error-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>تعذر تشغيل البث المباشر</Text>
          <Text style={styles.errorDesc}>{playbackError}</Text>

          <View style={styles.errorActions}>
            <Pressable
              hasTVPreferredFocus
              onPress={handleRetry}
              style={({ focused }) => [styles.retryBtn, focused && styles.overlayBtnFocused]}
            >
              {({ focused }) => (
                <View style={styles.btnRow}>
                  <MaterialIcons name="refresh" size={20} color={focused ? '#000000' : '#ffffff'} />
                  <Text style={[styles.retryBtnText, focused && styles.overlayBtnTextFocused]}>
                    إعادة محاولة الاتصال
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={handleGoBack}
              style={({ focused }) => [styles.backToListBtn, focused && styles.overlayBtnFocused]}
            >
              {({ focused }) => (
                <View style={styles.btnRow}>
                  <MaterialIcons name="arrow-back" size={20} color={focused ? '#000000' : '#ffffff'} />
                  <Text style={[styles.backToListText, focused && styles.overlayBtnTextFocused]}>
                    العودة للقنوات
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noUrlBox: {
    alignItems: 'center',
  },
  noUrlText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  overlayBar: {
    position: 'absolute',
    top: 32,
    left: 32,
    right: 32,
    zIndex: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlayBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 30,
  },
  overlayBtnFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.08 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 10,
  },
  overlayBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  overlayBtnTextFocused: {
    color: '#000000',
    fontWeight: '800',
  },
  titleBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 30,
    maxWidth: 360,
  },
  titleBadgeText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  favoriteBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 30,
  },
  favoriteBtnActive: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderColor: '#eab308',
  },
  favoriteText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  favoriteTextActive: {
    color: '#facc15',
  },
  helpHint: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  helpHintText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  bufferingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  bufferingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    zIndex: 60,
  },
  errorTitle: {
    color: '#f87171',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 18,
  },
  errorDesc: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 500,
    marginTop: 8,
    marginBottom: 28,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 16,
  },
  retryBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  backToListBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  backToListText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
