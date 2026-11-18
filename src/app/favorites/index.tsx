import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useMediaData } from '../../hooks/useMediaData';
import { MediaItem } from '../../types/media';

/**
 * مكون بطاقة القناة في شاشة المفضلة مع شارة نجمة تفاعلية
 */
interface FavoriteChannelCardProps {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
}

const FavoriteChannelCard: React.FC<FavoriteChannelCardProps> = ({ item, onSelect }) => {
  const [imageError, setImageError] = useState<boolean>(false);
  const hasValidLogo = Boolean(item.logo && item.logo.trim().length > 0) && !imageError;

  return (
    <Pressable
      onPress={() => onSelect(item)}
      className="rounded-2xl outline-none"
    >
      {({ focused }) => (
        <View
          className={`p-4 rounded-2xl border items-center justify-between min-h-[170px] relative ${
            focused
              ? 'bg-white border-white scale-105 shadow-2xl z-10'
              : 'bg-neutral-900 border-neutral-800'
          }`}
        >
          {/* شارة النجمة الذهبية في الزاوية */}
          <View className="absolute top-3 right-3 z-10">
            <MaterialIcons name="star" size={18} color="#eab308" />
          </View>

          {/* حاوية الشعار مع صورة بديلة */}
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
 * شاشة استعراض القنوات المفضلة (Favorites Screen).
 * تعرض فقط القنوات المحفوظة في المتجر العام، مع دعم كامل للريموت كنترول وشبكة من 4 أعمدة.
 */
export default function FavoritesScreen(): React.JSX.Element {
  const router = useRouter();
  const { favoriteIds } = useAppStore();
  const { channels, isLoading } = useMediaData();

  // تصفية القنوات المسجلة ضمن المفضلة فقط
  const favoriteChannels = useMemo(() => {
    if (!channels || channels.length === 0 || favoriteIds.length === 0) {
      return [];
    }
    const favSet = new Set(favoriteIds);
    return channels.filter((ch) => favSet.has(ch.id));
  }, [channels, favoriteIds]);

  const handleChannelPress = (channel: MediaItem) => {
    router.push({
      pathname: '/play/[id]',
      params: { id: channel.id, title: channel.name, url: channel.url },
    });
  };

  return (
    <View className="flex-1">
      {/* الشريط العلوي لشاشة المفضلة */}
      <View className="flex-row items-center justify-between mb-6 pb-4 border-b border-neutral-800">
        <View className="flex-row items-center">
          <View className="p-2.5 rounded-xl bg-amber-500/10 mr-3">
            <MaterialIcons name="star" size={28} color="#eab308" />
          </View>
          <View>
            <Text className="text-2xl font-black text-white">
              القنوات المفضلة
            </Text>
            <Text className="text-neutral-400 text-sm mt-0.5">
              إجمالي القنوات المحفوظة: {favoriteChannels.length}
            </Text>
          </View>
        </View>
      </View>

      {/* 1. حالة التحميل */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text className="text-white text-lg font-bold mt-4">
            جاري مزامنة القنوات المفضلة...
          </Text>
        </View>
      ) : favoriteChannels.length === 0 ? (
        /* 2. حالة عدم وجود قنوات في المفضلة (Empty State) */
        <View className="flex-1 justify-center items-center px-6">
          <View className="p-6 rounded-full bg-neutral-900 border border-neutral-800 mb-4">
            <MaterialIcons name="star-border" size={64} color="#737373" />
          </View>
          <Text className="text-xl font-bold text-white text-center">
            لا توجد قنوات في المفضلة حالياً
          </Text>
          <Text className="text-neutral-400 text-sm mt-2 text-center max-w-md leading-6">
            يمكنك إضافة القنوات إلى هذه القائمة بالضغط على زر "إضافة للمفضلة" أثناء تشغيل أي قناة في المشغل.
          </Text>
        </View>
      ) : (
        /* 3. شبكة القنوات المفضلة المكونة من 4 أعمدة والمتوافقة مع التلفاز */
        <FlatList<MediaItem>
          data={favoriteChannels}
          keyExtractor={(item) => item.id}
          numColumns={4}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View className="flex-1 p-2">
              <FavoriteChannelCard item={item} onSelect={handleChannelPress} />
            </View>
          )}
        />
      )}
    </View>
  );
}
