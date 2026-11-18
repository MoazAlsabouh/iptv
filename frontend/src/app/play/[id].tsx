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
 * شاشة مشغل الفيديو الموجهة بالكامل للتلفاز (Fullscreen TV Video Player).
 * تدعم HLS.js لقنوات البث المباشر (m3u8)، إبقاء الشاشة نشطة، تحكم الريموت كنترول،
 * ومؤقت إخفاء الواجهة بعد 5 ثوانٍ.
 */
export default function PlayerScreen(): React.JSX.Element {
  // منع شاشة التلفاز من الإغلاق التلقائي أو التعتيم طوال فترة فتح المشغل
  useKeepAwake();

  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; url: string; title?: string }>();

  // إدارة المفضلة من المتجر العام
  const { favoriteIds, toggleFavorite } = useAppStore();

  const channelId = useMemo(() => {
    if (!params.id) return '';
    return typeof params.id === 'string' ? params.id : params.id[0] || '';
  }, [params.id]);

  const isFavorite = useMemo(() => {
    return Boolean(channelId && favoriteIds.includes(channelId));
  }, [channelId, favoriteIds]);

  // استخراج الرابط وعنوان القناة بأمان
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

  // حالة إظهار وإخفاء الواجهة العائمة (Auto-hide Overlay)
  const [showOverlay, setShowOverlay] = useState<boolean>(true);

  /**
   * إعادة ضبط وتنشيط مؤقت الإخفاء التلقائي لمدة 5 ثوانٍ
   */
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

  // دعم أزرار ريموت التلفاز ولوحة المفاتيح
  useTVRemoteNavigation({
    onBack: () => router.back(),
    onAnyKey: resetOverlayTimer,
  });

  /**
   * إعادة تحميل مصدر الفيديو ومحاولة الاتصال بالبث مجدداً
   */
  const handleRetry = () => {
    setPlaybackError(null);
    setIsBuffering(true);
    setRetryKey((prev) => prev + 1);
    resetOverlayTimer();
  };

  return (
    <View className="flex-1 bg-black justify-center items-center">
      {/* 1. مشغل الفيديو المتطور بملء الشاشة مع دعم hls.js لقنوات m3u8 */}
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
        <View className="items-center px-6">
          <MaterialIcons name="link-off" size={64} color="#ef4444" />
          <Text className="text-white text-xl font-bold mt-4">
            رابط تشغيل القناة غير متوفر
          </Text>
        </View>
      )}

      {/* 2. منطقة تفاعل لالتقاط إشارات ريموت التلفاز عند اختفاء الواجهة لإعادة إظهارها */}
      {!showOverlay && !playbackError && (
        <Pressable
          hasTVPreferredFocus
          onPress={resetOverlayTimer}
          className="absolute inset-0 outline-none"
        >
          <View style={StyleSheet.absoluteFillObject} />
        </Pressable>
      )}

      {/* 3. الواجهة العلوية العائمة (Auto-hide Floating Overlay) */}
      {showOverlay && !playbackError && (
        <View className="absolute top-8 left-8 right-8 z-50 flex-row justify-between items-center">
          <View className="flex-row items-center">
            {/* زر العودة ويأخذ التركيز الافتراضي للريموت فور ظهوره */}
            <Pressable
              hasTVPreferredFocus
              onPress={() => router.back()}
              className="rounded-full outline-none"
            >
              {({ focused }) => (
                <View
                  className={`flex-row items-center px-5 py-2.5 rounded-full transition-all ${
                    focused
                      ? 'bg-white scale-110 shadow-2xl'
                      : 'bg-black/70 border border-neutral-700/60'
                  }`}
                >
                  <MaterialIcons
                    name="arrow-back"
                    size={22}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text
                    className={`ml-2 text-sm font-bold ${
                      focused ? 'text-black' : 'text-white'
                    }`}
                  >
                    خروج
                  </Text>
                </View>
              )}
            </Pressable>

            {/* عرض عنوان القناة الحالية */}
            {channelTitle ? (
              <View className="ml-4 px-4 py-2 rounded-full bg-black/70 border border-neutral-800">
                <Text className="text-white text-sm font-semibold max-w-md" numberOfLines={1}>
                  {channelTitle}
                </Text>
              </View>
            ) : null}

            {/* زر تبديل المفضلة المخصص للريموت كنترول */}
            {channelId ? (
              <Pressable
                onPress={() => {
                  toggleFavorite(channelId);
                  resetOverlayTimer();
                }}
                className="ml-3 rounded-full outline-none"
              >
                {({ focused }) => (
                  <View
                    className={`flex-row items-center px-4 py-2.5 rounded-full transition-all ${
                      focused
                        ? 'bg-white scale-110 shadow-2xl'
                        : isFavorite
                        ? 'bg-amber-500/20 border border-amber-500/50'
                        : 'bg-black/70 border border-neutral-700/60'
                    }`}
                  >
                    <MaterialIcons
                      name={isFavorite ? 'star' : 'star-border'}
                      size={22}
                      color={
                        focused
                          ? isFavorite
                            ? '#b45309'
                            : '#000000'
                          : isFavorite
                          ? '#eab308'
                          : '#ffffff'
                      }
                    />
                    <Text
                      className={`ml-1.5 text-sm font-bold ${
                        focused
                          ? 'text-black'
                          : isFavorite
                          ? 'text-yellow-400'
                          : 'text-white'
                      }`}
                    >
                      {isFavorite ? 'مفضلة' : 'إضافة للمفضلة'}
                    </Text>
                  </View>
                )}
              </Pressable>
            ) : null}
          </View>

          {/* تنبيه إرشادي */}
          <View className="bg-black/50 px-3 py-1.5 rounded-md">
            <Text className="text-neutral-400 text-xs">
              استخدم الأسهم و OK للتحكم بالريموت
            </Text>
          </View>
        </View>
      )}

      {/* 4. مؤشر التحميل والتخزين المؤقت (Buffering Indicator) */}
      {isBuffering && !playbackError && streamUrl ? (
        <View className="absolute inset-0 justify-center items-center bg-black/40 pointer-events-none">
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text className="text-white text-base font-bold mt-4 bg-black/70 px-4 py-1.5 rounded-full">
            جاري تهيئة البث المباشر (HLS)...
          </Text>
        </View>
      ) : null}

      {/* 5. واجهة الخطأ مع زر إعادة المحاولة */}
      {playbackError ? (
        <View className="absolute inset-0 justify-center items-center bg-black/95 p-8 z-40">
          <MaterialIcons name="error-outline" size={64} color="#ef4444" />
          <Text className="text-white text-2xl font-bold mt-4 text-center">
            تعذر تشغيل البث
          </Text>
          <Text className="text-neutral-400 text-sm mt-2 text-center max-w-lg mb-8 leading-6">
            {playbackError}
          </Text>

          <View className="flex-row space-x-4">
            <Pressable
              hasTVPreferredFocus
              onPress={handleRetry}
              className="rounded-xl outline-none"
            >
              {({ focused }) => (
                <View
                  className={`px-8 py-3.5 rounded-xl flex-row items-center ${
                    focused ? 'bg-white scale-110 shadow-lg' : 'bg-sky-500'
                  }`}
                >
                  <MaterialIcons
                    name="refresh"
                    size={20}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text
                    className={`ml-2 text-base font-bold ${
                      focused ? 'text-black' : 'text-white'
                    }`}
                  >
                    إعادة محاولة الاتصال
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              className="rounded-xl outline-none ml-4"
            >
              {({ focused }) => (
                <View
                  className={`px-8 py-3.5 rounded-xl flex-row items-center ${
                    focused ? 'bg-white scale-110 shadow-lg' : 'bg-neutral-800'
                  }`}
                >
                  <MaterialIcons
                    name="arrow-back"
                    size={20}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text
                    className={`ml-2 text-base font-bold ${
                      focused ? 'text-black' : 'text-white'
                    }`}
                  >
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
