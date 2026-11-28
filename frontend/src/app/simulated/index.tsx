import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ChannelLogo } from '../../components/ChannelLogo';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { useAppStore } from '../../store/useAppStore';
import { getVirtualLivePosition, VirtualLiveEpisode } from '../../utils/virtualLive';
import { setActiveSimulatedChannel, SimulatedAdRule } from '../../utils/simulatedChannelStore';

const BACKEND_BASE_URL = 'https://iptv-backend.moaznsm.workers.dev';

export interface PublicSimulatedChannel {
  id: string;
  name: string;
  logo: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
  episodes: VirtualLiveEpisode[];
  createdAt?: number | string;
  updatedAt?: number | string;
  adRules?: SimulatedAdRule[];
}

const DEFAULT_CATEGORIES = [
  { id: 'all', title: 'الكل' },
  { id: 'comedy', title: 'كوميديا' },
  { id: 'drama', title: 'دراما' },
  { id: 'historical', title: 'تاريخي' },
  { id: 'religious', title: 'إسلامي وديني' },
  { id: 'animation', title: 'كرتون وأنيميشن' },
  { id: 'documentary', title: 'وثائقي' },
  { id: 'variety', title: 'منوعات' },
];

export default function SimulatedChannelsScreen(): React.JSX.Element {
  const router = useRouter();

  const [channels, setChannels] = useState<PublicSimulatedChannel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [focusedCategoryIndex, setFocusedCategoryIndex] = useState<number>(0);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [focusedPane, setFocusedPane] = useState<'categories' | 'channels'>('channels');
  const [hasMounted, setHasMounted] = useState<boolean>(false);
  const [tickerTime, setTickerTime] = useState<number>(0);

  const setIsSidebarFocused = useAppStore((state) => state.setIsSidebarFocused);

  const flatListRef = useRef<FlatList<PublicSimulatedChannel>>(null);
  const categoriesScrollViewRef = useRef<ScrollView>(null);

  // حماية الترطيب (Hydration Safe): تجنب قراءة Date.now() في خادم الـ SSR
  useEffect(() => {
    setHasMounted(true);
    setTickerTime(Date.now());
    const timer = setInterval(() => {
      setTickerTime(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // جلب قنوات البث 24/7 من السيرفر بدون كاش
  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/simulated-channels?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const rawChannels = data?.channels ?? data?.simulatedChannels ?? (Array.isArray(data) ? data : []);
        setChannels(Array.isArray(rawChannels) ? rawChannels : []);
      }
    } catch (err) {
      console.warn('[Simulated] Failed to fetch 24/7 channels:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // تجميع التصنيفات ديناميكياً من القنوات المضافة فعلياً
  const dynamicCategories = useMemo(() => {
    const set = new Set<string>();
    channels.forEach((ch) => {
      const cat = ch.category?.trim();
      if (cat) set.add(cat);
    });
    const unique = Array.from(set);
    return [
      { id: 'all', title: 'الكل' },
      ...unique.map((cat) => ({ id: cat, title: cat })),
    ];
  }, [channels]);

  // تصفية القنوات حسب التصنيف المختار
  const filteredChannels = useMemo(() => {
    if (selectedCategory === 'all') return channels;
    return channels.filter((ch) => (ch.category?.trim() || '') === selectedCategory);
  }, [channels, selectedCategory]);

  // ضبط حدود مؤشر القنوات عند تغيير التصنيف
  useEffect(() => {
    if (focusedIndex >= filteredChannels.length && filteredChannels.length > 0) {
      setFocusedIndex(0);
    }
  }, [filteredChannels.length, focusedIndex]);

  // التمرير التلقائي للقائمة العمودية عند تغيير القناة المحددة بالريموت
  useEffect(() => {
    if (focusedPane === 'channels' && filteredChannels.length > 0 && focusedIndex >= 0) {
      try {
        flatListRef.current?.scrollToIndex({
          index: focusedIndex,
          animated: true,
          viewPosition: 0.5,
        });
      } catch {
        flatListRef.current?.scrollToOffset({
          offset: Math.max(0, (focusedIndex - 2) * 82),
          animated: true,
        });
      }
    }
  }, [focusedPane, focusedIndex, filteredChannels.length]);

  // التمرير التلقائي لشريط التصنيفات عند التنقل به
  useEffect(() => {
    if (focusedPane === 'categories' && categoriesScrollViewRef.current) {
      try {
        categoriesScrollViewRef.current.scrollTo({
          x: Math.max(0, focusedCategoryIndex * 90 - 40),
          animated: true,
        });
      } catch {
        // ignore
      }
    }
  }, [focusedPane, focusedCategoryIndex]);

  // تشغيل القناة والانتقال إلى مشغل الفيديو
  const handleOpenChannel = useCallback(
    (channel: PublicSimulatedChannel) => {
      if (!channel) return;

      // حفظ بيانات القناة والحلقات في المخزن المحلي لمنع تضخم الرابط وخطأ HTTP 413
      setActiveSimulatedChannel({
        id: channel.id,
        name: channel.name,
        logo: channel.logo || '',
        category: channel.category || 'مسلسلات 24/7',
        episodes: channel.episodes || [],
        createdAt: channel.createdAt ? String(channel.createdAt) : '',
        adRules: channel.adRules || [],
      });

      router.push({
        pathname: '/play/[id]',
        params: {
          id: channel.id,
          type: 'simulated247',
        },
      });
    },
    [router]
  );

  // التحكم بريموت التلفاز D-Pad (Up, Down, Left, Right, OK, Back)
  const handleUp = useCallback(() => {
    if (focusedPane === 'channels') {
      if (focusedIndex > 0) {
        setFocusedIndex((prev) => prev - 1);
      } else {
        setFocusedPane('categories');
      }
    }
  }, [focusedPane, focusedIndex]);

  const handleDown = useCallback(() => {
    if (focusedPane === 'categories') {
      setFocusedPane('channels');
      setFocusedIndex(0);
    } else if (focusedPane === 'channels') {
      if (focusedIndex < filteredChannels.length - 1) {
        setFocusedIndex((prev) => prev + 1);
      }
    }
  }, [focusedPane, focusedIndex, filteredChannels.length]);

  const handleLeft = useCallback(() => {
    if (focusedPane === 'categories') {
      if (focusedCategoryIndex < dynamicCategories.length - 1) {
        setFocusedCategoryIndex((prev) => prev + 1);
      }
    } else if (focusedPane === 'channels') {
      // الرجوع إلى القائمة الجانبية الرئيسية للتطبيق
      setIsSidebarFocused(true);
    }
  }, [focusedPane, focusedCategoryIndex, dynamicCategories.length, setIsSidebarFocused]);

  const handleRight = useCallback(() => {
    if (focusedPane === 'categories') {
      if (focusedCategoryIndex > 0) {
        setFocusedCategoryIndex((prev) => prev - 1);
      } else {
        setIsSidebarFocused(true);
      }
    } else if (focusedPane === 'channels') {
      // سهم لليمين أو للخلف يتيح الرجوع إلى القائمة الجانبية الرئيسية
      setIsSidebarFocused(true);
    }
  }, [focusedPane, focusedCategoryIndex, setIsSidebarFocused]);

  const handleSelect = useCallback(() => {
    if (focusedPane === 'categories') {
      const cat = dynamicCategories[focusedCategoryIndex];
      if (cat) {
        setSelectedCategory(cat.id);
        setFocusedPane('channels');
        setFocusedIndex(0);
      }
    } else if (focusedPane === 'channels' && filteredChannels[focusedIndex]) {
      handleOpenChannel(filteredChannels[focusedIndex]);
    }
  }, [focusedPane, dynamicCategories, focusedCategoryIndex, filteredChannels, focusedIndex, handleOpenChannel]);

  useTVRemoteNavigation({
    onArrowUp: handleUp,
    onArrowDown: handleDown,
    onArrowLeft: handleLeft,
    onArrowRight: handleRight,
    onEnter: handleSelect,
    onBack: () => {
      setIsSidebarFocused(true);
      return true;
    },
  });

  // عرض صف القناة في القائمة العمودية
  const renderChannelRow = useCallback(
    ({ item, index }: { item: PublicSimulatedChannel; index: number }) => {
      const isFocused = focusedPane === 'channels' && focusedIndex === index;
      const livePos = hasMounted ? getVirtualLivePosition(item?.episodes || [], item?.createdAt) : null;
      const currentEp = livePos?.currentEpisode;

      return (
        <Pressable
          key={item?.id || `sim-row-${index}`}
          hasTVPreferredFocus={focusedPane === 'channels' && (focusedIndex === index || (focusedIndex === -1 && index === 0))}
          focusable={true}
          accessible={true}
          onPress={() => {
            setFocusedIndex(index);
            setFocusedPane('channels');
            handleOpenChannel(item);
          }}
          style={({ focused }) => [
            styles.channelRow,
            (isFocused || focused) && styles.focusHighlight,
          ]}
        >
          {({ focused }) => {
            const itemFocused = isFocused || focused;
            return (
              <View style={styles.channelRowInner}>
                {/* 1. الجانب الأيمن (البداية RTL): شعار القناة */}
                <View style={[styles.logoContainer, itemFocused && styles.logoContainerFocused]}>
                  <ChannelLogo
                    uri={item?.logo || ''}
                    name={item?.name || 'قناة 24/7'}
                    size={42}
                    focused={itemFocused}
                    style={styles.channelLogo}
                  />
                </View>

                {/* 2. الوسط: بيانات القناة والمسلسل المعروض */}
                <View style={styles.channelInfoCol}>
                  {/* السطر الأول: اسم القناة + شارة مباشر + التصنيف */}
                  <View style={styles.firstLineRow}>
                    <Text
                      style={[styles.channelName, itemFocused && styles.channelNameFocused]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>

                    <View style={styles.liveBadge}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveBadgeText}>● مباشر</Text>
                    </View>

                    {item.category ? (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{item.category}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* السطر الثاني: الحلقة الحالية + إجمالي الحلقات في الدورة */}
                  <View style={styles.secondLineRow}>
                    <View style={styles.nowPlayingInline}>
                      <MaterialIcons name="play-circle-outline" size={15} color="#38bdf8" />
                      <Text style={styles.nowPlayingLabel}>يعرض الآن:</Text>
                      <Text
                        style={[styles.nowPlayingTitle, itemFocused && styles.nowPlayingTitleFocused]}
                        numberOfLines={1}
                      >
                        {hasMounted && currentEp ? currentEp.title : 'بث متواصل 24/7'}
                      </Text>
                    </View>

                    <View style={styles.dividerDot} />

                    <View style={styles.cycleInfo}>
                      <MaterialIcons name="queue" size={13} color="#64748b" />
                      <Text style={styles.cycleText}>
                        {item.episodes?.length || 0} حلقة في الدورة
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 3. الجانب الأيسر (النهاية RTL): زر ومؤشر المشاهدة الآن */}
                <View style={[styles.watchAction, itemFocused && styles.watchActionFocused]}>
                  <Text style={[styles.watchActionText, itemFocused && styles.watchActionTextFocused]}>
                    مشاهدة الآن
                  </Text>
                  <MaterialIcons
                    name="play-arrow"
                    size={18}
                    color={itemFocused ? '#070b14' : '#f59e0b'}
                  />
                </View>
              </View>
            );
          }}
        </Pressable>
      );
    },
    [focusedPane, focusedIndex, hasMounted, handleOpenChannel]
  );

  return (
    <View style={styles.container}>
      {/* ترويسة الصفحة */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.iconBadge}>
            <MaterialIcons name="ondemand-video" size={26} color="#f59e0b" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.titleWithBadge}>
              <Text style={styles.title}>بث المسلسلات 24/7</Text>
              <View style={styles.livePulseBadge}>
                <View style={styles.livePulseDot} />
                <Text style={styles.livePulseText}>مباشر 24 ساعة</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              قنوات تبث مسلسلاتك المفضلة حلقة تلو الأخرى على مدار الساعة بدقة ومزامنة حية لحظية.
            </Text>
          </View>
          {filteredChannels.length > 0 && (
            <View style={styles.headerCountBadge}>
              <MaterialIcons name="live-tv" size={16} color="#f59e0b" />
              <Text style={styles.headerCountText}>{filteredChannels.length} قناة</Text>
            </View>
          )}
        </View>
      </View>

      {/* شريط التصنيفات */}
      <View style={styles.categoriesBar}>
        <ScrollView
          ref={categoriesScrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          {dynamicCategories.map((cat, idx) => {
            const isSelected = selectedCategory === cat.id;
            const isFocused = focusedPane === 'categories' && focusedCategoryIndex === idx;
            return (
              <Pressable
                key={cat.id}
                hasTVPreferredFocus={focusedPane === 'categories' && focusedCategoryIndex === idx}
                focusable={true}
                accessible={true}
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipSelected,
                  isFocused && styles.categoryChipFocused,
                ]}
                onPress={() => {
                  setSelectedCategory(cat.id);
                  setFocusedCategoryIndex(idx);
                  setFocusedIndex(0);
                  setFocusedPane('channels');
                }}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected && styles.categoryChipTextSelected,
                    isFocused && styles.categoryChipTextFocused,
                  ]}
                >
                  {cat.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* محتوى القنوات العمودي */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>جاري تحميل قنوات المسلسلات 24/7...</Text>
        </View>
      ) : filteredChannels.length === 0 ? (
        <View style={styles.emptyBox}>
          <MaterialIcons name="tv-off" size={64} color="#64748b" />
          <Text style={styles.emptyTitle}>لا توجد قنوات مسلسلات 24/7 مضافة حالياً</Text>
          <Text style={styles.emptySubtitle}>
            يمكن لمدير النظام إضافة قنوات وباقات مسلسلات 24/7 بسهولة من لوحة الإدارة.
          </Text>
        </View>
      ) : (
        <FlatList<PublicSimulatedChannel>
          ref={flatListRef}
          data={filteredChannels}
          keyExtractor={(item, index) => item?.id || `sim-row-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.channelsListContent}
          initialNumToRender={15}
          maxToRenderPerBatch={20}
          windowSize={10}
          getItemLayout={(data, index) => ({
            length: 82,
            offset: 82 * index,
            index,
          })}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: Math.max(0, info.index * 82),
              animated: true,
            });
          }}
          renderItem={renderChannelRow}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
    padding: 24,
    ...(Platform.OS === 'web' ? ({ direction: 'rtl' } as any) : {}),
  },
  header: {
    marginBottom: 18,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
  },
  livePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  livePulseText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  headerCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  headerCountText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '700',
  },
  categoriesBar: {
    marginBottom: 16,
  },
  categoriesContent: {
    gap: 8,
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryChipSelected: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  categoryChipFocused: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.05 }],
  },
  categoryChipText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: '#000000',
    fontWeight: '700',
  },
  categoryChipTextFocused: {
    color: '#ffffff',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 15,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 400,
  },
  channelsListContent: {
    paddingBottom: 40,
  },
  channelRow: {
    minHeight: 74,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
    marginHorizontal: 2,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  focusHighlight: {
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#1e293b',
    transform: [{ scale: 1.01 }],
    shadowColor: '#f59e0b',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  channelRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  logoContainer: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  logoContainerFocused: {
    borderColor: '#f59e0b',
  },
  channelLogo: {
    width: 44,
    height: 44,
  },
  channelInfoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  firstLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  channelName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  channelNameFocused: {
    color: '#f59e0b',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveBadgeText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  categoryBadgeText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '600',
  },
  secondLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nowPlayingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  nowPlayingLabel: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  nowPlayingTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  nowPlayingTitleFocused: {
    color: '#f1f5f9',
  },
  dividerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#475569',
  },
  cycleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cycleText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  watchAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  watchActionFocused: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  watchActionText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
  },
  watchActionTextFocused: {
    color: '#070b14',
    fontWeight: '800',
  },
});
