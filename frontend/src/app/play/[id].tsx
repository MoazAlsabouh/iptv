import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useMediaData } from '../../hooks/useMediaData';
import { TVPlayer, HlsLevelOption } from '../../components/player/TVPlayer';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { ChannelLogo } from '../../components/ChannelLogo';
import { StreamSource } from '../../types/media';

/**
 * شاشة مشغل الفيديو بتصميم ملء الشاشة الداكن والتحكم الكامل بالريموت كنترول.
 * تدعم التبديل السلس بين مصادر البث وجودات HLS.
 */
export default function PlayerScreen(): React.JSX.Element {
  useKeepAwake();

  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    url: string;
    title?: string;
    logo?: string;
    sources?: string;
  }>();

  const { favoriteIds, toggleFavorite } = useAppStore();
  const { channels } = useMediaData();

  const channelId = useMemo(() => {
    if (!params.id) return '';
    return typeof params.id === 'string' ? params.id : params.id[0] || '';
  }, [params.id]);

  const isFavorite = useMemo(() => {
    return Boolean(channelId && favoriteIds.includes(channelId));
  }, [channelId, favoriteIds]);

  const rawStreamUrl = useMemo(() => {
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

  const channelLogo = useMemo(() => {
    if (!params.logo) return '';
    return typeof params.logo === 'string'
      ? decodeURIComponent(params.logo)
      : params.logo[0]
      ? decodeURIComponent(params.logo[0])
      : '';
  }, [params.logo]);

  // مصادر البث المتعددة للقناة
  const channelSources: StreamSource[] = useMemo(() => {
    if (params.sources) {
      try {
        const raw = typeof params.sources === 'string' ? params.sources : params.sources[0];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // تجاهل
      }
    }
    const found = channels.find((c) => c.id === channelId);
    return found?.sources || [];
  }, [params.sources, channels, channelId]);

  const [activeSourceIndex, setActiveSourceIndex] = useState<number>(0);
  const [hlsLevels, setHlsLevels] = useState<HlsLevelOption[]>([]);
  const [selectedHlsLevel, setSelectedHlsLevel] = useState<number>(-1);
  const [showQualityModal, setShowQualityModal] = useState<boolean>(false);

  // رابط البث الفعلي بناءً على المصدر المختار
  const currentStreamUrl = useMemo(() => {
    if (channelSources.length > 0 && channelSources[activeSourceIndex]) {
      return channelSources[activeSourceIndex].url;
    }
    return rawStreamUrl;
  }, [channelSources, activeSourceIndex, rawStreamUrl]);

  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);

  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
  }, []);

  useEffect(() => {
    if (!showOverlay || showQualityModal) return;

    const timer = setTimeout(() => {
      setShowOverlay(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [showOverlay, showQualityModal]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  useTVRemoteNavigation({
    onBack: () => {
      if (showQualityModal) {
        setShowQualityModal(false);
      } else {
        handleGoBack();
      }
    },
    onAnyKey: resetOverlayTimer,
  });

  const handleRetry = () => {
    setPlaybackError(null);
    setIsBuffering(true);
    setRetryKey((prev) => prev + 1);
    resetOverlayTimer();
  };

  const hasMultiQuality = channelSources.length > 1 || hlsLevels.length > 1;

  return (
    <View style={styles.rootContainer}>
      {/* 1. مشغل الفيديو HLS */}
      {currentStreamUrl ? (
        <TVPlayer
          key={`tv-player-${retryKey}-${activeSourceIndex}`}
          streamUrl={currentStreamUrl}
          selectedLevel={selectedHlsLevel}
          onLevelsLoaded={(levels) => setHlsLevels(levels)}
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
      {!showOverlay && !playbackError && !showQualityModal && (
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
              hasTVPreferredFocus={!showQualityModal}
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

            {/* عنوان وشعار القناة */}
            {channelTitle ? (
              <View style={styles.titleBadge}>
                <ChannelLogo
                  uri={channelLogo}
                  name={channelTitle}
                  size={26}
                  style={styles.playerChannelLogo}
                />
                <Text numberOfLines={1} style={styles.titleBadgeText}>
                  {channelTitle}
                </Text>
              </View>
            ) : null}

            {/* زر الجودة والمصادر */}
            {hasMultiQuality ? (
              <Pressable
                onPress={() => {
                  setShowQualityModal(true);
                  resetOverlayTimer();
                }}
                style={({ focused }) => [
                  styles.qualityBtn,
                  focused && styles.overlayBtnFocused,
                ]}
              >
                {({ focused }) => (
                  <View style={styles.btnRow}>
                    <MaterialIcons
                      name="tune"
                      size={20}
                      color={focused ? '#000000' : '#38bdf8'}
                    />
                    <Text style={[styles.qualityBtnText, focused && styles.overlayBtnTextFocused]}>
                      الجودة / المصادر
                    </Text>
                  </View>
                )}
              </Pressable>
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

      {/* 4. قائمة التبديل بين الجودات والمصادر (Modal / Overlay) */}
      {showQualityModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <MaterialIcons name="settings-input-antenna" size={24} color="#38bdf8" />
                <Text style={styles.modalTitle}>إعدادات البث والجودة</Text>
              </View>
              <Text style={styles.modalSub}>{channelTitle}</Text>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* قسم 1: مصادر وروابط البث المختلفة للقناة */}
              {channelSources.length > 1 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionHeader}>مصادر البث المتاحة:</Text>
                  <View style={styles.optionsWrap}>
                    {channelSources.map((src, idx) => {
                      const isCurrentSource = idx === activeSourceIndex;
                      return (
                        <Pressable
                          key={`source-${idx}`}
                          hasTVPreferredFocus={isCurrentSource}
                          onPress={() => {
                            setActiveSourceIndex(idx);
                            setIsBuffering(true);
                            setPlaybackError(null);
                          }}
                          style={({ focused }) => [
                            styles.optionChip,
                            isCurrentSource && styles.optionChipActive,
                            focused && styles.optionChipFocused,
                          ]}
                        >
                          {({ focused }) => (
                            <View style={styles.optionContent}>
                              {isCurrentSource && (
                                <MaterialIcons
                                  name="check"
                                  size={18}
                                  color={focused ? '#000000' : '#38bdf8'}
                                />
                              )}
                              <Text
                                style={[
                                  styles.optionText,
                                  isCurrentSource && styles.optionTextActive,
                                  focused && styles.optionTextFocused,
                                ]}
                              >
                                {src.label}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* قسم 2: مستويات جودة البث المتوفرة */}
              {hlsLevels.length > 1 && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionHeader}>خيارات جودة البث:</Text>
                  <View style={styles.optionsWrap}>
                    {hlsLevels.map((lvl) => {
                      const isCurrentLevel = lvl.id === selectedHlsLevel;
                      return (
                        <Pressable
                          key={`hls-lvl-${lvl.id}`}
                          onPress={() => setSelectedHlsLevel(lvl.id)}
                          style={({ focused }) => [
                            styles.optionChip,
                            isCurrentLevel && styles.optionChipActive,
                            focused && styles.optionChipFocused,
                          ]}
                        >
                          {({ focused }) => (
                            <View style={styles.optionContent}>
                              {isCurrentLevel && (
                                <MaterialIcons
                                  name="check"
                                  size={18}
                                  color={focused ? '#000000' : '#38bdf8'}
                                />
                              )}
                              <Text
                                style={[
                                  styles.optionText,
                                  isCurrentLevel && styles.optionTextActive,
                                  focused && styles.optionTextFocused,
                                ]}
                              >
                                {lvl.label}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* زر إغلاق القائمة */}
            <Pressable
              onPress={() => setShowQualityModal(false)}
              style={({ focused }) => [
                styles.modalCloseBtn,
                focused && styles.modalCloseBtnFocused,
              ]}
            >
              {({ focused }) => (
                <View style={styles.btnRow}>
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text
                    style={[
                      styles.modalCloseBtnText,
                      focused && styles.modalCloseBtnTextFocused,
                    ]}
                  >
                    حفظ ومتابعة المشاهدة
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* 5. مؤشر التحميل المؤقت */}
      {isBuffering && !playbackError && currentStreamUrl ? (
        <View style={styles.bufferingContainer} pointerEvents="none">
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.bufferingText}>جاري تهيئة البث المباشر...</Text>
        </View>
      ) : null}

      {/* 6. واجهة الخطأ مع أزرار التحكم */}
      {playbackError ? (
        <View style={styles.errorOverlay}>
          <MaterialIcons name="error-outline" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>تعذر تشغيل البث المباشر</Text>
          <Text style={styles.errorDesc}>
            {playbackError.includes('HLS') || playbackError.includes('hls')
              ? 'تعذر تشغيل هذا البث حالياً، يرجى اختيار مصدر آخر أو إعادة المحاولة'
              : playbackError}
          </Text>

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
  overlayBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 36,
    paddingBottom: 24,
    paddingHorizontal: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    zIndex: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 30,
    maxWidth: 360,
    gap: 10,
  },
  playerChannelLogo: {
    borderRadius: 8,
  },
  titleBadgeText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  qualityBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
  },
  qualityBtnText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
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
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    width: '100%',
    maxWidth: 560,
    maxHeight: '80%',
    padding: 28,
  },
  modalHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 16,
    marginBottom: 20,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  modalSub: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 12,
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  optionChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  optionChipFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  optionTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  optionTextFocused: {
    color: '#000000',
    fontWeight: '900',
  },
  modalCloseBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnFocused: {
    backgroundColor: '#ffffff',
    transform: [{ scale: 1.04 }],
    shadowColor: '#ffffff',
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  modalCloseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalCloseBtnTextFocused: {
    color: '#000000',
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
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  noUrlBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noUrlText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    zIndex: 20,
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  errorDesc: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 480,
    marginVertical: 12,
  },
  errorActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 16,
  },
  retryBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  backToListBtn: {
    backgroundColor: '#334155',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backToListText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
