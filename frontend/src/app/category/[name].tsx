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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useMediaData } from '../../hooks/useMediaData';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { ChannelLogo } from '../../components/ChannelLogo';
import { MediaItem } from '../../types/media';

interface ChannelCardProps {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({ item, onSelect }) => {
  return (
    <Pressable
      onPress={() => onSelect(item)}
      style={({ focused }) => [
        styles.channelCard,
        focused && styles.channelCardFocused,
      ]}
    >
      {({ focused }) => (
        <View style={styles.cardContent}>
          <ChannelLogo
            uri={item.logo}
            name={item.name}
            size={76}
            focused={focused}
            style={[styles.logoWrapper, focused && styles.logoWrapperFocused]}
          />

          <Text
            numberOfLines={2}
            style={[styles.channelTitle, focused && styles.channelTitleFocused]}
          >
            {item.name}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

export default function CategoryChannelsScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; filterBy?: string }>();

  const categoryName = useMemo(() => {
    if (!params.name) return '';
    return typeof params.name === 'string'
      ? decodeURIComponent(params.name)
      : params.name[0]
      ? decodeURIComponent(params.name[0])
      : '';
  }, [params.name]);

  const filterBy = params.filterBy || 'category';
  const isCountryFilter = filterBy === 'country';

  const { channels, isLoading } = useMediaData();

  const filteredChannels = useMemo(() => {
    if (!channels || channels.length === 0 || !categoryName) {
      return [];
    }
    if (isCountryFilter) {
      return channels.filter(
        (ch) => (ch.country ? ch.country.trim() : 'قنوات عامة') === categoryName
      );
    }
    return channels.filter(
      (ch) => (ch.groupTitle ? ch.groupTitle.trim() : 'قنوات عامة ومنوعة') === categoryName
    );
  }, [channels, categoryName, isCountryFilter]);

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
      params: { id: channel.id, title: channel.name, url: channel.url, logo: channel.logo },
    });
  };

  return (
    <View style={styles.container}>
      {/* الشريط العلوي */}
      <View style={styles.topBar}>
        <Pressable
          hasTVPreferredFocus
          onPress={handleGoBack}
          style={({ focused }) => [styles.backBtn, focused && styles.backBtnFocused]}
        >
          {({ focused }) => (
            <View style={styles.btnRow}>
              <MaterialIcons
                name="arrow-back"
                size={22}
                color={focused ? '#000000' : '#ffffff'}
              />
              <Text style={[styles.backBtnText, focused && styles.backBtnTextFocused]}>
                رجوع
              </Text>
            </View>
          )}
        </Pressable>

        <View style={styles.titleInfo}>
          <Text style={styles.categoryTitle}>
            {isCountryFilter ? `قنوات دولة: ${categoryName}` : categoryName || 'التصنيف'}
          </Text>
          <Text style={styles.channelCount}>
            {filteredChannels.length} {categoryName.includes('أفلام') ? 'فيلم متاح' : 'قناة متاحة'}
          </Text>
        </View>
      </View>

      {/* المحتوى */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>جاري استخراج القنوات...</Text>
        </View>
      ) : filteredChannels.length === 0 ? (
        <View style={styles.centerBox}>
          <MaterialIcons name="tv-off" size={64} color="#64748b" />
          <Text style={styles.emptyTitle}>لا توجد قنوات متاحة في هذا التصنيف</Text>
        </View>
      ) : (
        <FlatList<MediaItem>
          data={filteredChannels}
          keyExtractor={(item) => item.id}
          numColumns={4}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.col}>
              <ChannelCard item={item} onSelect={handleChannelPress} />
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
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    marginRight: 20,
  },
  backBtnFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.08 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  backBtnTextFocused: {
    color: '#000000',
  },
  titleInfo: {
    justifyContent: 'center',
  },
  categoryTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
  },
  channelCount: {
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
  channelCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 16,
    minHeight: 160,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  channelCardFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },
  cardContent: {
    alignItems: 'center',
    width: '100%',
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
  channelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    lineHeight: 20,
  },
  channelTitleFocused: {
    color: '#000000',
    fontWeight: '800',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  emptyTitle: {
    color: '#94a3b8',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '700',
  },
});
