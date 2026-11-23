import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ChannelLogo } from '../../components/ChannelLogo';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { useAppStore } from '../../store/useAppStore';
import { getVirtualLivePosition, VirtualLiveEpisode } from '../../utils/virtualLive';

const BACKEND_BASE_URL = 'https://iptv-backend.moaznsm.workers.dev';

export interface PublicSimulatedChannel {
  id: string;
  name: string;
  logo: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
  episodes: VirtualLiveEpisode[];
}

const CATEGORIES = [
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
  const { width } = useWindowDimensions();

  const [channels, setChannels] = useState<PublicSimulatedChannel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [focusedPane, setFocusedPane] = useState<'categories' | 'channels'>('channels');
  const [tickerTime, setTickerTime] = useState<number>(Date.now());

  const setIsSidebarFocused = useAppStore((state) => state.setIsSidebarFocused);

  // تحديث دوري كل 15 ثانية لمزامنة بيانات "يعرض الآن"
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerTime(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // جلب قنوات البث 24/7 من السيرفر
  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/simulated-channels`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.channels)) {
          setChannels(data.channels);
        }
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

  // تجميع التصنيفات ديناميكياً من القنوات المضافة فعلياً (بما فيها أي تصنيف مخصص "آخر")
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

  // تصفية القنوات حسب التصنيف
  const filteredChannels = useMemo(() => {
    if (selectedCategory === 'all') return channels;
    return channels.filter((ch) => (ch.category?.trim() || '') === selectedCategory);
  }, [channels, selectedCategory]);

  const numColumns = useMemo(() => {
    if (width >= 1200) return 4;
    if (width >= 800) return 3;
    if (width >= 500) return 2;
    return 1;
  }, [width]);

  // تشغيل القناة والانتقال إلى مشغل الفيديو
  const handleOpenChannel = useCallback(
    (channel: PublicSimulatedChannel) => {
      if (!channel) return;
      router.push({
        pathname: '/play/[id]',
        params: {
          id: channel.id,
          title: encodeURIComponent(channel.name),
          logo: encodeURIComponent(channel.logo || ''),
          type: 'simulated247',
          category: encodeURIComponent(channel.category || 'مسلسلات 24/7'),
          episodes: encodeURIComponent(JSON.stringify(channel.episodes || [])),
        },
      });
    },
    [router]
  );

  // التحكم بالريموت كنترول D-Pad
  const handleUp = useCallback(() => {
    if (focusedPane === 'channels') {
      if (focusedIndex >= numColumns) {
        setFocusedIndex((prev) => prev - numColumns);
      } else {
        setFocusedPane('categories');
      }
    }
  }, [focusedPane, focusedIndex, numColumns]);

  const handleDown = useCallback(() => {
    if (focusedPane === 'categories') {
      setFocusedPane('channels');
      setFocusedIndex(0);
    } else if (focusedPane === 'channels') {
      if (focusedIndex + numColumns < filteredChannels.length) {
        setFocusedIndex((prev) => prev + numColumns);
      }
    }
  }, [focusedPane, focusedIndex, numColumns, filteredChannels.length]);

  const handleLeft = useCallback(() => {
    if (focusedPane === 'categories') {
      // الانتقال إلى الشريط الجانبي
      setIsSidebarFocused(true);
    } else if (focusedPane === 'channels') {
      if (focusedIndex % numColumns === 0) {
        setIsSidebarFocused(true);
      } else {
        setFocusedIndex((prev) => Math.max(0, prev - 1));
      }
    }
  }, [focusedPane, focusedIndex, numColumns, setIsSidebarFocused]);

  const handleRight = useCallback(() => {
    if (focusedPane === 'channels') {
      if (focusedIndex + 1 < filteredChannels.length && (focusedIndex + 1) % numColumns !== 0) {
        setFocusedIndex((prev) => prev + 1);
      }
    }
  }, [focusedPane, focusedIndex, filteredChannels.length, numColumns]);

  const handleSelect = useCallback(() => {
    if (focusedPane === 'channels' && filteredChannels[focusedIndex]) {
      handleOpenChannel(filteredChannels[focusedIndex]);
    }
  }, [focusedPane, filteredChannels, focusedIndex, handleOpenChannel]);

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

  return (
    <View style={styles.container}>
      {/* ترويسة الصفحة */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.iconBadge}>
            <MaterialIcons name="ondemand-video" size={26} color="#f59e0b" />
          </View>
          <View>
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
        </View>
      </View>

      {/* شريط التصنيفات */}
      <View style={styles.categoriesBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContent}>
          {dynamicCategories.map((cat, idx) => {
            const isSelected = selectedCategory === cat.id;
            const isFocused = focusedPane === 'categories' && selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipSelected,
                  isFocused && styles.categoryChipFocused,
                ]}
                onPress={() => {
                  setSelectedCategory(cat.id);
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

        {/* محتوى القنوات */}
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
          <ScrollView
            style={styles.channelsScroll}
            contentContainerStyle={styles.channelsGrid}
            showsVerticalScrollIndicator={false}
          >
            {filteredChannels.map((channel, index) => {
              const isFocused = focusedPane === 'channels' && focusedIndex === index;
              const livePos = getVirtualLivePosition(channel.episodes);
              const currentEp = livePos.currentEpisode;

              return (
                <Pressable
                  key={channel.id}
                  style={[
                    styles.channelCard,
                    { width: `${100 / numColumns - 2}%` },
                    isFocused && styles.channelCardFocused,
                  ]}
                  onPress={() => handleOpenChannel(channel)}
                >
                  {/* شارة مباشر والشعار */}
                  <View style={styles.cardHeader}>
                    <View style={styles.logoWrapper}>
                      <ChannelLogo
                        uri={channel.logo}
                        name={channel.name}
                        size={48}
                        style={styles.channelLogo}
                      />
                    </View>
                    <View style={styles.cardHeaderBadges}>
                      <View style={styles.liveBadgeSmall}>
                        <View style={styles.liveDotSmall} />
                        <Text style={styles.liveBadgeTextSmall}>مباشر</Text>
                      </View>
                      {channel.category ? (
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>{channel.category}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* اسم القناة */}
                  <Text style={styles.channelName} numberOfLines={1}>
                    {channel.name}
                  </Text>

                  {/* معلومات الحلقة الحالية المعروضة */}
                  <View style={styles.nowPlayingBox}>
                    <View style={styles.nowPlayingHeader}>
                      <MaterialIcons name="play-circle-outline" size={14} color="#38bdf8" />
                      <Text style={styles.nowPlayingLabel}>يعرض الآن:</Text>
                    </View>
                    <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                      {currentEp ? currentEp.title : 'بث متواصل'}
                    </Text>
                  </View>

                  {/* إجمالي الحلقات ودليل العرض */}
                  <View style={styles.cardFooter}>
                    <View style={styles.footerInfoRow}>
                      <MaterialIcons name="queue" size={14} color="#94a3b8" />
                      <Text style={styles.footerInfoText}>
                        {channel.episodes?.length || 0} حلقة في الدورة
                      </Text>
                    </View>
                    <View style={styles.actionBtn}>
                      <Text style={styles.actionBtnText}>مشاهدة الآن</Text>
                      <MaterialIcons name="arrow-forward" size={14} color="#f59e0b" />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
    padding: 24,
  },
  header: {
    marginBottom: 20,
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
  channelsScroll: {
    flex: 1,
  },
  channelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingBottom: 40,
  },
  channelCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  channelCardFocused: {
    borderColor: '#f59e0b',
    backgroundColor: '#1e293b',
    transform: [{ scale: 1.02 }],
    shadowColor: '#f59e0b',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoWrapper: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  channelLogo: {
    width: 48,
    height: 48,
  },
  cardHeaderBadges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  liveBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveBadgeTextSmall: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '600',
  },
  channelName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  nowPlayingBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
    gap: 4,
  },
  nowPlayingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nowPlayingLabel: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  nowPlayingTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  footerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerInfoText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtnText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
  },
});
