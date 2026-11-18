import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useMediaData } from '../../hooks/useMediaData';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { ChannelLogo } from '../../components/ChannelLogo';
import { MediaItem } from '../../types/media';

type MovieFilterType = 'all' | 'movies' | 'series';

interface MovieCardProps {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
  index: number;
}

const MovieCard: React.FC<MovieCardProps> = ({ item, onSelect, index }) => {
  return (
    <Pressable
      hasTVPreferredFocus={index === 0}
      onPress={() => onSelect(item)}
      style={({ focused }) => [
        styles.card,
        focused && styles.cardFocused,
      ]}
    >
      {({ focused }) => (
        <View style={styles.cardContent}>
          {/* شارة التصنيف */}
          <View style={styles.badgeRow}>
            <View style={styles.genreBadge}>
              <Text numberOfLines={1} style={styles.genreBadgeText}>
                {item.groupTitle || 'أفلام ومسلسلات'}
              </Text>
            </View>
            {item.country ? (
              <Text numberOfLines={1} style={styles.countryBadgeText}>
                {item.country}
              </Text>
            ) : null}
          </View>

          {/* بوستر / شعار الفيلم */}
          <ChannelLogo
            uri={item.logo}
            name={item.name}
            size={80}
            focused={focused}
            style={[styles.logoWrapper, focused && styles.logoWrapperFocused]}
          />

          {/* عنوان المحتوى */}
          <Text
            numberOfLines={2}
            style={[styles.itemTitle, focused && styles.itemTitleFocused]}
          >
            {item.name}
          </Text>

          {/* زر تشغيل فوري */}
          <View style={[styles.playIndicator, focused && styles.playIndicatorFocused]}>
            <MaterialIcons
              name="play-arrow"
              size={18}
              color={focused ? '#000000' : '#38bdf8'}
            />
            <Text
              style={[
                styles.playIndicatorText,
                focused && styles.playIndicatorTextFocused,
              ]}
            >
              تشغيل
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
};

/**
 * شاشة مخصصة لعرض الأفلام والمسلسلات (VOD) فقط بتصميم تلفاز داكن احترافي.
 * تستبعد قنوات البث المباشر التلفزيونية وتدعم التصفية بين (الكل، أفلام، مسلسلات).
 */
export default function MoviesScreen(): React.JSX.Element {
  const router = useRouter();
  const { vodItems, isLoading, isError, refetch } = useMediaData();
  const [filterType, setFilterType] = useState<MovieFilterType>('all');

  // محتوى الأفلام والمسلسلات VOD المسجل حصراً
  const allMovieItems = useMemo(() => {
    return vodItems || [];
  }, [vodItems]);

  const moviesOnly = useMemo(() => {
    return allMovieItems.filter((item) => item.type === 'movie' || item.type !== 'series');
  }, [allMovieItems]);

  const seriesOnly = useMemo(() => {
    return allMovieItems.filter((item) => item.type === 'series');
  }, [allMovieItems]);

  // التصفية بحسب التبويب المختار
  const filteredItems = useMemo(() => {
    if (filterType === 'movies') {
      return moviesOnly;
    }
    if (filterType === 'series') {
      return seriesOnly;
    }
    return allMovieItems;
  }, [allMovieItems, moviesOnly, seriesOnly, filterType]);

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

  const handleSelect = (item: MediaItem) => {
    router.push({
      pathname: '/play/[id]',
      params: {
        id: item.id,
        title: item.name,
        url: item.url,
        logo: item.logo,
        sources: item.sources ? JSON.stringify(item.sources) : undefined,
      },
    });
  };

  // 1. حالة التحميل
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingTitle}>جاري تحميل الأفلام والمسلسلات...</Text>
        <Text style={styles.loadingSub}>جاري الاتصال بالخادم لجلب المحتوى...</Text>
      </View>
    );
  }

  // 2. حالة الخطأ
  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorCard}>
          <MaterialIcons name="error-outline" size={60} color="#ef4444" />
          <Text style={styles.errorTitle}>تعذر الاتصال بالخادم</Text>
          <Text style={styles.errorDesc}>يرجى التأكد من الاتصال بالإنترنت ثم إعادة المحاولة</Text>
          <Pressable
            hasTVPreferredFocus
            onPress={() => refetch()}
            style={({ focused }) => [styles.retryBtn, focused && styles.btnFocused]}
          >
            {({ focused }) => (
              <View style={styles.btnRow}>
                <MaterialIcons name="refresh" size={20} color={focused ? '#000000' : '#ffffff'} />
                <Text style={[styles.btnText, focused && styles.btnTextFocused]}>
                  إعادة المحاولة
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* شريط العنوان العلوي والتبويبات */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>الأفلام والمسلسلات</Text>
          <Text style={styles.headerSubtitle}>
            إجمالي المحتوى المتاح: {filteredItems.length} فيلم ومسلسل
          </Text>
        </View>

        {/* أزرار التصفية السريعة */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => setFilterType('all')}
            style={({ focused }) => [
              styles.tabBtn,
              filterType === 'all' && styles.tabBtnActive,
              focused && styles.tabBtnFocused,
            ]}
          >
            {({ focused }) => (
              <View style={styles.tabContent}>
                <MaterialIcons
                  name="dashboard"
                  size={18}
                  color={focused ? '#000000' : filterType === 'all' ? '#ffffff' : '#94a3b8'}
                />
                <Text
                  style={[
                    styles.tabText,
                    filterType === 'all' && styles.tabTextActive,
                    focused && styles.tabTextFocused,
                  ]}
                >
                  الكل ({allMovieItems.length})
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => setFilterType('movies')}
            style={({ focused }) => [
              styles.tabBtn,
              filterType === 'movies' && styles.tabBtnActive,
              focused && styles.tabBtnFocused,
            ]}
          >
            {({ focused }) => (
              <View style={styles.tabContent}>
                <MaterialIcons
                  name="movie"
                  size={18}
                  color={focused ? '#000000' : filterType === 'movies' ? '#ffffff' : '#94a3b8'}
                />
                <Text
                  style={[
                    styles.tabText,
                    filterType === 'movies' && styles.tabTextActive,
                    focused && styles.tabTextFocused,
                  ]}
                >
                  أفلام ({moviesOnly.length})
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => setFilterType('series')}
            style={({ focused }) => [
              styles.tabBtn,
              filterType === 'series' && styles.tabBtnActive,
              focused && styles.tabBtnFocused,
            ]}
          >
            {({ focused }) => (
              <View style={styles.tabContent}>
                <MaterialIcons
                  name="tv"
                  size={18}
                  color={focused ? '#000000' : filterType === 'series' ? '#ffffff' : '#94a3b8'}
                />
                <Text
                  style={[
                    styles.tabText,
                    filterType === 'series' && styles.tabTextActive,
                    focused && styles.tabTextFocused,
                  ]}
                >
                  مسلسلات ({seriesOnly.length})
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* المحتوى أو الحالة الفارغة */}
      {filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons
            name={filterType === 'series' ? 'tv' : 'local-movies'}
            size={68}
            color="#475569"
          />
          <Text style={styles.emptyTitle}>
            {filterType === 'series'
              ? 'لا تتوفر مسلسلات حالياً'
              : filterType === 'movies'
              ? 'لا تتوفر أفلام حالياً'
              : 'لا يتوفر محتوى أفلام أو مسلسلات حالياً'}
          </Text>
          <Text style={styles.emptySub}>
            {filterType === 'series'
              ? 'سيتم إضافة المسلسلات قريباً'
              : filterType === 'movies'
              ? 'سيتم إضافة المزيد من الأفلام قريباً'
              : 'سيتم تحديث القائمة وإضافة المزيد من المحتوى الترفيهي تلقائياً'}
          </Text>
        </View>
      ) : (
        <FlatList<MediaItem>
          data={filteredItems}
          keyExtractor={(item) => item.id}
          numColumns={4}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={styles.col}>
              <MovieCard item={item} onSelect={handleSelect} index={index} />
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
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0b1120',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 6,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#0284c7',
  },
  tabBtnFocused: {
    backgroundColor: '#ffffff',
    transform: [{ scale: 1.05 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  tabTextFocused: {
    color: '#000000',
    fontWeight: '900',
  },
  listContent: {
    paddingBottom: 40,
  },
  col: {
    flex: 1,
    padding: 8,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 16,
    minHeight: 200,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 14,
  },
  cardContent: {
    width: '100%',
    alignItems: 'center',
  },
  badgeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  genreBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '65%',
  },
  genreBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  countryBadgeText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  logoWrapper: {
    marginBottom: 12,
  },
  logoWrapperFocused: {
    transform: [{ scale: 1.04 }],
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  itemTitleFocused: {
    color: '#000000',
    fontWeight: '900',
  },
  playIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  playIndicatorFocused: {
    backgroundColor: '#0284c7',
  },
  playIndicatorText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  playIndicatorTextFocused: {
    color: '#ffffff',
    fontWeight: '800',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 24,
  },
  loadingTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 18,
  },
  loadingSub: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
  },
  errorCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: '#334155',
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 16,
  },
  errorDesc: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  btnFocused: {
    backgroundColor: '#ffffff',
    transform: [{ scale: 1.06 }],
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  btnTextFocused: {
    color: '#000000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySub: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
