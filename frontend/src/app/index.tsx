import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { useMediaData, CategoryGroup } from '../hooks/useMediaData';
import { DEFAULT_BACKEND_M3U_URL } from '../utils/m3uParser';

/**
 * شاشة لوحة التحكم الرئيسية (Dashboard) الموجهة لأجهزة التلفاز (TV-First).
 * تدعم إدخال رابط M3U أو استخدام رابط الخادم المدمج تلقائياً،
 * وتتيح التنقل الكامل بالريموت كنترول لعرض تصنيفات القنوات والأفلام.
 */
export default function DashboardScreen(): React.JSX.Element {
  const router = useRouter();
  const { playlistUrl, setPlaylistUrl } = useAppStore();
  const [inputUrl, setInputUrl] = useState<string>('');
  const [inputFocused, setInputFocused] = useState<boolean>(false);

  // جلب البيانات وإدارتها عبر React Query
  const { categories, totalChannels, isLoading, isError, error, refetch } =
    useMediaData();

  const handleSaveUrl = () => {
    if (inputUrl.trim().length > 0) {
      setPlaylistUrl(inputUrl.trim());
    }
  };

  const handleResetUrl = () => {
    setInputUrl('');
    setPlaylistUrl('');
  };

  const handleUseDefaultUrl = () => {
    setPlaylistUrl(DEFAULT_BACKEND_M3U_URL);
  };

  // 1. حالة عدم وجود رابط M3U: واجهة إدخال الرابط المخصصة للتلفاز
  if (!playlistUrl || playlistUrl.trim().length === 0) {
    return (
      <View className="flex-1 justify-center items-center px-6">
        <View className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl p-8 items-center shadow-2xl">
          <MaterialIcons name="playlist-play" size={56} color="#38bdf8" />
          <Text className="text-2xl font-bold text-white mt-4 mb-2 text-center">
            إعداد قائمة التشغيل (M3U Playlist)
          </Text>
          <Text className="text-neutral-400 text-sm mb-6 text-center leading-6">
            يرجى لصق رابط قائمة M3U أو استخدام خادم البث المدمج الذي يحتوي على قنوات عربية وأفلام رائجة.
          </Text>

          {/* حقل الإدخال مع تركيز مرئي واضح */}
          <View
            className={`w-full flex-row items-center bg-neutral-950 px-4 py-3 rounded-xl border mb-5 ${
              inputFocused
                ? 'border-white bg-neutral-900 scale-105'
                : 'border-neutral-700'
            }`}
          >
            <MaterialIcons name="link" size={24} color={inputFocused ? '#38bdf8' : '#737373'} />
            <TextInput
              value={inputUrl}
              onChangeText={setInputUrl}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="https://example.com/playlist.m3u"
              placeholderTextColor="#737373"
              className="flex-1 ml-3 text-white text-base outline-none"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* زر حفظ الرابط المدخل */}
          <Pressable
            hasTVPreferredFocus
            onPress={handleSaveUrl}
            className="w-full rounded-xl outline-none mb-3"
          >
            {({ focused }) => (
              <View
                className={`w-full py-4 rounded-xl flex-row justify-center items-center ${
                  focused
                    ? 'bg-white scale-105 shadow-xl'
                    : 'bg-sky-500'
                }`}
              >
                <MaterialIcons
                  name="check-circle"
                  size={24}
                  color={focused ? '#000000' : '#ffffff'}
                />
                <Text
                  className={`ml-2 text-lg font-bold ${
                    focused ? 'text-black' : 'text-white'
                  }`}
                >
                  حفظ وتحميل القنوات
                </Text>
              </View>
            )}
          </Pressable>

          {/* زر استخدام الخادم السحابي المدمج */}
          <Pressable
            onPress={handleUseDefaultUrl}
            className="w-full rounded-xl outline-none"
          >
            {({ focused }) => (
              <View
                className={`w-full py-3.5 rounded-xl flex-row justify-center items-center border ${
                  focused
                    ? 'bg-white border-white scale-105 shadow-xl'
                    : 'bg-neutral-800 border-neutral-700'
                }`}
              >
                <MaterialIcons
                  name="cloud-download"
                  size={20}
                  color={focused ? '#000000' : '#38bdf8'}
                />
                <Text
                  className={`ml-2 text-base font-semibold ${
                    focused ? 'text-black font-bold' : 'text-white'
                  }`}
                >
                  استخدام الخادم السحابي المدمج (قنوات + أفلام)
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  // 2. حالة جلب وتحليل البيانات (Loading State)
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text className="text-white text-xl font-bold mt-6">
          جاري تحميل وتجميع القنوات والأفلام...
        </Text>
        <Text className="text-neutral-400 text-sm mt-2">
          يتم الآن تحليل قائمة البث المباشر وأفلام VOD
        </Text>
      </View>
    );
  }

  // 3. حالة الخطأ (Error State)
  if (isError) {
    return (
      <View className="flex-1 justify-center items-center px-6">
        <View className="w-full max-w-lg bg-neutral-900 border border-red-900/50 rounded-2xl p-8 items-center">
          <MaterialIcons name="error-outline" size={60} color="#ef4444" />
          <Text className="text-xl font-bold text-white mt-4 text-center">
            تعذر تحميل قائمة القنوات
          </Text>
          <Text className="text-neutral-400 text-sm mt-2 text-center mb-6">
            {error?.message || 'تأكد من صحة الرابط أو حالة اتصالك بالإنترنت'}
          </Text>

          <View className="flex-row space-x-4 w-full justify-center">
            <Pressable
              hasTVPreferredFocus
              onPress={() => refetch()}
              className="rounded-xl outline-none"
            >
              {({ focused }) => (
                <View
                  className={`px-6 py-3.5 rounded-xl flex-row items-center ${
                    focused ? 'bg-white scale-110 shadow-lg' : 'bg-neutral-800'
                  }`}
                >
                  <MaterialIcons
                    name="refresh"
                    size={20}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text
                    className={`ml-2 font-semibold ${
                      focused ? 'text-black font-bold' : 'text-white'
                    }`}
                  >
                    إعادة المحاولة
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={handleResetUrl}
              className="rounded-xl outline-none ml-4"
            >
              {({ focused }) => (
                <View
                  className={`px-6 py-3.5 rounded-xl flex-row items-center ${
                    focused ? 'bg-white scale-110 shadow-lg' : 'bg-red-950 border border-red-800'
                  }`}
                >
                  <MaterialIcons
                    name="link-off"
                    size={20}
                    color={focused ? '#000000' : '#f87171'}
                  />
                  <Text
                    className={`ml-2 font-semibold ${
                      focused ? 'text-black font-bold' : 'text-red-300'
                    }`}
                  >
                    تغيير الرابط
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // 4. حالة النجاح (Success State): شبكة بطاقات التصنيفات
  return (
    <View className="flex-1">
      {/* شريط الإحصائيات العلوي */}
      <View className="flex-row justify-between items-center mb-6 pb-4 border-b border-neutral-800">
        <View>
          <Text className="text-2xl font-black text-white">
            لوحة التحكم والتصنيفات
          </Text>
          <Text className="text-neutral-400 text-sm mt-1">
            إجمالي التصنيفات: {categories.length} | إجمالي القنوات والأفلام: {totalChannels}
          </Text>
        </View>

        {/* زر إعادة ضبط وتغيير الرابط */}
        <Pressable
          onPress={handleResetUrl}
          className="rounded-lg outline-none"
        >
          {({ focused }) => (
            <View
              className={`flex-row items-center px-4 py-2 rounded-lg ${
                focused ? 'bg-white scale-105 shadow-md' : 'bg-neutral-800'
              }`}
            >
              <MaterialIcons
                name="settings"
                size={18}
                color={focused ? '#000000' : '#9ca3af'}
              />
              <Text
                className={`ml-2 text-sm ${
                  focused ? 'text-black font-bold' : 'text-neutral-300'
                }`}
              >
                تغيير الرابط
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* شبكة التصنيفات المتجاوبة الموجهة للتلفاز */}
      <FlatList<CategoryGroup>
        data={categories}
        keyExtractor={(item) => item.name}
        numColumns={3}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <View className="flex-1 p-2.5">
            <Pressable
              hasTVPreferredFocus={index === 0}
              onPress={() => {
                router.push({
                  pathname: '/category/[name]',
                  params: { name: item.name },
                });
              }}
              className="rounded-2xl outline-none"
            >
              {({ focused }) => (
                <View
                  className={`p-6 rounded-2xl border justify-between min-h-[140px] ${
                    focused
                      ? 'bg-white border-white scale-105 shadow-2xl z-10'
                      : 'bg-neutral-900 border-neutral-800'
                  }`}
                >
                  <View className="flex-row justify-between items-start">
                    <View
                      className={`p-2.5 rounded-xl ${
                        focused ? 'bg-neutral-100' : 'bg-neutral-800'
                      }`}
                    >
                      <MaterialIcons
                        name={item.name.includes('أفلام') ? 'movie' : 'folder-open'}
                        size={28}
                        color={focused ? '#0284c7' : '#38bdf8'}
                      />
                    </View>
                    <View
                      className={`px-3 py-1 rounded-full ${
                        focused ? 'bg-neutral-200' : 'bg-neutral-800'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          focused ? 'text-neutral-900' : 'text-sky-400'
                        }`}
                      >
                        {item.count} {item.name.includes('أفلام') ? 'فيلم' : 'قناة'}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-4">
                    <Text
                      numberOfLines={1}
                      className={`text-lg font-bold ${
                        focused ? 'text-black' : 'text-white'
                      }`}
                    >
                      {item.name}
                    </Text>
                    <Text
                      className={`text-xs mt-1 ${
                        focused ? 'text-neutral-600' : 'text-neutral-400'
                      }`}
                    >
                      اضغط للاستعراض بالريموت
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
