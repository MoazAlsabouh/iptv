import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useMediaData } from '../../hooks/useMediaData';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { MediaItem } from '../../types/media';

/**
 * مكون بطاقة القناة المستقل لتسهيل إدارة حالة فشل تحميل الشعار (Fallback Logo)
 * وتوفير أقصى قدر من الأداء أثناء التمرير على أجهزة التلفاز.
 */
interface ChannelCardProps {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({ item, onSelect }) => {
  const [imageError, setImageError] = useState<boolean>(false);
  const hasValidLogo = Boolean(item.logo && item.logo.trim().length > 0) && !imageError;

  return (
    <Pressable
      onPress={() => onSelect(item)}
      className="rounded-2xl outline-none"
    >
      {({ focused }) => (
        <View
          className={`p-4 rounded-2xl border items-center justify-between min-h-[170px] ${
            focused
              ? 'bg-white border-white scale-105 shadow-2xl z-10'
              : 'bg-neutral-900 border-neutral-800'
          }`}
        >
          {/* حاوية الشعار مع صورة بديلة عند الفشل أو عدم التوفر */}
          <View
            className={`w-20 h-20 rounded-xl justify-center items-center overflow-hidden mb-3 ${
              focused ? 'bg-neutral-100' : 'bg-neutral-950'
            }`}
          >
            {hasValidLogo ? (
              <Image
                source={{ uri: item.logo }}
                onError={() => setImageError(true)}
                resizeMode="contain"
                className="w-16 h-16"
              />
            ) : (
              <MaterialIcons
                name="tv"
                size={40}
                color={focused ? '#0284c7' : '#38bdf8'}
              />
            )}
          </View>

          {/* اسم القناة */}
          <Text
            numberOfLines={2}
            className={`text-sm text-center font-bold leading-5 ${
              focused ? 'text-black' : 'text-white'
            }`}
          >
            {item.name}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

/**
 * شاشة استعراض القنوات التابعة لتصنيف محدد (Category Channels Grid).
 * تدعم التنقل السلس بشبكة من 4 أعمدة مع زر رجوع متوافق مع ريموت التلفاز.
 */
export default function CategoryChannelsScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string }>();

  // استخراج وفك ترميز اسم التصنيف بأمان
  const categoryName = useMemo(() => {
    if (!params.name) return '';
    return typeof params.name === 'string'
      ? decodeURIComponent(params.name)
      : params.name[0]
      ? decodeURIComponent(params.name[0])
      : '';
  }, [params.name]);

  const { channels, isLoading } = useMediaData();

  // تصفية القنوات التابعة لهذا التصنيف
  const filteredChannels = useMemo(() => {
    if (!channels || channels.length === 0 || !categoryName) {
      return [];
    }
    return channels.filter(
      (ch) => (ch.groupTitle ? ch.groupTitle.trim() : 'General') === categoryName
    );
  }, [channels, categoryName]);

  // دعم أزرار الرجوع بريموت التلفاز
  useTVRemoteNavigation({
    onBack: () => router.back(),
  });

  const handleChannelPress = (channel: MediaItem) => {
    router.push({
      pathname: '/play/[id]',
      params: { id: channel.id, title: channel.name, url: channel.url },
    });
  };

  return (
    <View className="flex-1">
      {/* الشريط العلوي مع زر الرجوع ومعلومات التصنيف */}
      <View className="flex-row items-center justify-between mb-6 pb-4 border-b border-neutral-800">
        <View className="flex-row items-center">
          {/* زر الرجوع للوراء مع التركيز التلقائي لريموت التلفاز */}
          <Pressable
            hasTVPreferredFocus
            onPress={() => router.back()}
            className="rounded-xl outline-none mr-4"
          >
            {({ focused }) => (
              <View
                className={`flex-row items-center px-4 py-2.5 rounded-xl ${
                  focused ? 'bg-white scale-105 shadow-md' : 'bg-neutral-800'
                }`}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={22}
                  color={focused ? '#000000' : '#ffffff'}
                />
                <Text
                  className={`ml-2 text-sm font-semibold ${
                    focused ? 'text-black font-bold' : 'text-white'
                  }`}
                >
                  رجوع
                </Text>
              </View>
            )}
          </Pressable>

          {/* تفاصيل التصنيف الحالي */}
          <View>
            <Text className="text-2xl font-black text-white">
              {categoryName || 'التصنيف'}
            </Text>
            <Text className="text-neutral-400 text-sm mt-0.5">
              عدد القنوات المتاحة: {filteredChannels.length}
            </Text>
          </View>
        </View>
      </View>

      {/* حالة التحميل إذا لم تنتهِ بعد */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text className="text-white text-lg font-bold mt-4">
            جاري استخراج قنوات التصنيف...
          </Text>
        </View>
      ) : filteredChannels.length === 0 ? (
        /* حالة عدم وجود قنوات في هذا التصنيف */
        <View className="flex-1 justify-center items-center">
          <MaterialIcons name="tv-off" size={64} color="#525252" />
          <Text className="text-white text-xl font-bold mt-4">
            لا توجد قنوات متاحة في هذا التصنيف
          </Text>
          <Text className="text-neutral-500 text-sm mt-2">
            يرجى الرجوع واختيار تصنيف آخر.
          </Text>
        </View>
      ) : (
        /* شبكة القنوات المكونة من 4 أعمدة والمتوافقة مع ريموت التلفاز */
        <FlatList<MediaItem>
          data={filteredChannels}
          keyExtractor={(item) => item.id}
          numColumns={4}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View className="flex-1 p-2">
              <ChannelCard item={item} onSelect={handleChannelPress} />
            </View>
          )}
        />
      )}
    </View>
  );
}
