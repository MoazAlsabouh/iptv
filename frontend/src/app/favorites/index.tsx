import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useMediaData } from '../../hooks/useMediaData';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { MediaItem } from '../../types/media';

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
      style={({ focused }) => [
        styles.favCard,
        focused && styles.favCardFocused,
      ]}
    >
      {({ focused }) => (
        <View style={styles.cardContent}>
          <View style={styles.starBadge}>
            <MaterialIcons name="star" size={18} color="#eab308" />
          </View>

          <View style={[styles.logoWrapper, focused && styles.logoWrapperFocused]}>
            {hasValidLogo ? (
              <Image
                source={{ uri: item.logo }}
                onError={() => setImageError(true)}
                resizeMode="contain"
                style={styles.logoImage}
              />
            ) : (
              <MaterialIcons
                name="tv"
                size={40}
                color={focused ? '#0284c7' : '#38bdf8'}
              />
            )}
          </View>

          <Text
            numberOfLines={2}
            style={[styles.favTitle, focused && styles.favTitleFocused]}
          >
            {item.name}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

export default function FavoritesScreen(): React.JSX.Element {
  const router = useRouter();
  const { favoriteIds } = useAppStore();
  const { channels, isLoading } = useMediaData();

  const favoriteChannels = useMemo(() => {
    if (!channels || channels.length === 0 || favoriteIds.length === 0) {
      return [];
    }
    const favSet = new Set(favoriteIds);
    return channels.filter((ch) => favSet.has(ch.id));
  }, [channels, favoriteIds]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  useTVRemoteNavigation({
    onBack: handleGoBack,
  });

  const handleChannelPress = (channel: MediaItem) => {
    router.push({
      pathname: '/play/[id]',
      params: { id: channel.id, title: channel.name, url: channel.url },
    });
  };

  return (
    <View style={styles.container}>
      {/* الشريط العلوي */}
      <View style={styles.topBar}>
        <View style={styles.headerTitleRow}>
          <View style={styles.starIconBox}>
            <MaterialIcons name="star" size={26} color="#eab308" />
          </View>
          <View>
            <Text style={styles.screenTitle}>القنوات المفضلة</Text>
            <Text style={styles.screenSub}>
              إجمالي القنوات المحفوظة: {favoriteChannels.length}
            </Text>
          </View>
        </View>
      </View>

      {/* المحتوى */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>جاري مزامنة القنوات المفضلة...</Text>
        </View>
      ) : favoriteChannels.length === 0 ? (
        <View style={styles.centerBox}>
          <View style={styles.emptyCircle}>
            <MaterialIcons name="star-border" size={60} color="#64748b" />
          </View>
          <Text style={styles.emptyTitle}>لا توجد قنوات في المفضلة حالياً</Text>
          <Text style={styles.emptySub}>
            يمكنك إضافة القنوات إلى هذه القائمة بالضغط على زر "إضافة للمفضلة" أثناء تشغيل القناة.
          </Text>
        </View>
      ) : (
        <FlatList<MediaItem>
          data={favoriteChannels}
          keyExtractor={(item) => item.id}
          numColumns={4}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.col}>
              <FavoriteChannelCard item={item} onSelect={handleChannelPress} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
  },
  screenSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 40,
  },
  col: {
    flex: 1,
    padding: 8,
  },
  favCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 16,
    minHeight: 160,
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  favCardFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },
  cardContent: {
    alignItems: 'center',
    width: '100%',
  },
  starBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },
  logoWrapper: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  logoWrapperFocused: {
    backgroundColor: '#f1f5f9',
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  favTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    lineHeight: 20,
  },
  favTitleFocused: {
    color: '#000000',
    fontWeight: '800',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  emptyCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
  },
  emptySub: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 420,
    marginTop: 8,
    lineHeight: 22,
  },
});
