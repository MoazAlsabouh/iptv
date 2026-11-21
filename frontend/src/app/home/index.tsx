import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useMediaData, CategoryGroup } from '../../hooks/useMediaData';
import { ChannelLogo } from '../../components/ChannelLogo';
import { TVPlayer } from '../../components/player/TVPlayer';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import { MediaItem } from '../../types/media';
import { DEFAULT_BACKEND_M3U_URL } from '../../utils/m3uParser';

type GroupType = 'favorites' | 'all' | 'network' | 'country' | 'category';

interface NavGroupItem {
  id: string;
  type: GroupType;
  name: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  count: number;
  channels?: MediaItem[];
}

/**
 * شاشة القنوات التلفزيونية بتخطيط IPTV احترافي من 3 أعمدة (RTL) متوافق 100% مع الريموت:
 * 1. العمود الأيمن (~22%): الأقسام، الدول، السلاسل، والمفضلة.
 * 2. العمود الأوسط (~40%): قائمة القنوات المدمجة (Compact Rows ~56px) مع رقم القناة وشعارها.
 * 3. العمود الأيسر (~38%): نافذة المعاينة المباشرة (16:9) مع إمكانية التكبير لملء الشاشة بضغطة ثانية.
 */
export default function DashboardScreen(): React.JSX.Element {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const {
    playlistUrl,
    setPlaylistUrl,
    favoriteIds,
    toggleFavorite,
  } = useAppStore();

  useEffect(() => {
    if (!playlistUrl || playlistUrl.trim().length === 0) {
      setPlaylistUrl(DEFAULT_BACKEND_M3U_URL);
    }
  }, [playlistUrl, setPlaylistUrl]);

  const {
    channels,
    categories,
    countries,
    networks,
    totalChannels,
    isLoading,
    isError,
    error,
    refetch,
  } = useMediaData();

  // الحالة النشطة للأعمدة والتحديد
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewChannel, setPreviewChannel] = useState<MediaItem | null>(null);
  const [mobileTab, setMobileTab] = useState<'groups' | 'channels' | 'preview'>('channels');

  // مراجع القوائم للتمرير التلقائي بالريموت
  const channelsFlatListRef = useRef<FlatList<MediaItem> | null>(null);

  // 1. تجميع قائمة المجموعات والأقسام في العمود الأيمن
  const navGroups = useMemo<NavGroupItem[]>(() => {
    const list: NavGroupItem[] = [];

    // المفضلة
    const favCount = favoriteIds.length;
    list.push({
      id: 'favorites',
      type: 'favorites',
      name: 'المفضلة',
      icon: 'star',
      count: favCount,
    });

    // الكل
    list.push({
      id: 'all',
      type: 'all',
      name: 'جميع القنوات',
      icon: 'live-tv',
      count: totalChannels,
    });

    // سلاسل القنوات (Networks)
    if (networks && networks.length > 0) {
      networks.forEach((net) => {
        list.push({
          id: `net-${net.name}`,
          type: 'network',
          name: net.name,
          icon: 'hub',
          count: net.count,
          channels: net.channels,
        });
      });
    }

    // البلدان (Countries)
    if (countries && countries.length > 0) {
      countries.forEach((country) => {
        if (country.name && country.name !== 'أفلام عالمية' && country.name !== 'أفلام رائجة') {
          list.push({
            id: `country-${country.name}`,
            type: 'country',
            name: country.name,
            icon: 'flag',
            count: country.count,
          });
        }
      });
    }

    // باقي التصنيفات (Categories)
    if (categories && categories.length > 0) {
      categories.forEach((cat) => {
        if (cat.name && cat.name !== 'أفلام عالمية' && cat.name !== 'أفلام رائجة') {
          list.push({
            id: `cat-${cat.name}`,
            type: 'category',
            name: cat.name,
            icon: 'folder',
            count: cat.count,
          });
        }
      });
    }

    return list;
  }, [favoriteIds.length, totalChannels, networks, countries, categories]);

  // المجموعة المختارة حالياً
  const selectedGroup = useMemo<NavGroupItem>(() => {
    return navGroups.find((g) => g.id === selectedGroupId) || navGroups[1] || {
      id: 'all',
      type: 'all',
      name: 'جميع القنوات',
      icon: 'live-tv',
      count: totalChannels,
    };
  }, [navGroups, selectedGroupId, totalChannels]);

  // 2. تصفية القنوات حسب المجموعة المختارة والبحث
  const activeChannels = useMemo<MediaItem[]>(() => {
    if (!channels || channels.length === 0) return [];

    let list: MediaItem[] = [];

    if (selectedGroup.type === 'favorites') {
      list = channels.filter((ch) => favoriteIds.includes(ch.id));
    } else if (selectedGroup.type === 'all') {
      list = channels;
    } else if (selectedGroup.type === 'network') {
      list = selectedGroup.channels || [];
    } else if (selectedGroup.type === 'country') {
      list = channels.filter(
        (ch) => (ch.country ? ch.country.trim() : 'قنوات عامة') === selectedGroup.name
      );
    } else if (selectedGroup.type === 'category') {
      list = channels.filter(
        (ch) => (ch.groupTitle ? ch.groupTitle.trim() : 'قنوات عامة ومنوعة') === selectedGroup.name
      );
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((ch) => ch.name.toLowerCase().includes(q));
    }

    return list;
  }, [channels, selectedGroup, favoriteIds, searchQuery]);

  // عند تحميل القنوات لأول مرة، ضبط القناة الأولى للمعاينة إن لم تكن محددة
  useEffect(() => {
    if (!previewChannel && activeChannels.length > 0) {
      setPreviewChannel(activeChannels[0]);
    }
  }, [activeChannels, previewChannel]);

  // فتح القناة بملء الشاشة
  const handleOpenFullScreen = useCallback((channel: MediaItem) => {
    router.push({
      pathname: '/play/[id]',
      params: {
        id: channel.id,
        url: encodeURIComponent(channel.streamUrl),
        title: encodeURIComponent(channel.name),
        logo: encodeURIComponent(channel.logo || ''),
        type: 'channel',
        category: encodeURIComponent(selectedGroup.name),
      },
    });
  }, [router, selectedGroup.name]);

  // سلوك الضغط بالريموت أو النقر على القناة:
  // الضغطة الأولى: معاينة مباشرة في العمود الأيسر.
  // الضغطة الثانية (على نفس القناة): فتح ملء الشاشة.
  const handleChannelPress = useCallback((channel: MediaItem) => {
    if (previewChannel?.id === channel.id) {
      handleOpenFullScreen(channel);
    } else {
      setPreviewChannel(channel);
      if (!isWide) {
        setMobileTab('preview');
      }
    }
  }, [previewChannel, handleOpenFullScreen, isWide]);

  // التنقل السريع بريموت التلفاز
  useTVRemoteNavigation({
    onBack: () => {
      if (!isWide && mobileTab !== 'groups') {
        setMobileTab('groups');
        return true;
      }
      return false;
    },
  });

  // حالة التحميل
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingTitle}>جاري تحميل وتنسيق دليل القنوات التلفزيونية...</Text>
        <Text style={styles.loadingSub}>الاتصال بالخادم المركزي وتحديث قائمة البث المباشر...</Text>
      </View>
    );
  }

  // حالة الخطأ
  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={60} color="#ef4444" />
        <Text style={styles.errorTitle}>تعذر تحميل قائمة القنوات</Text>
        <Text style={styles.errorDesc}>{error?.message || 'يرجى التأكد من اتصال الإنترنت'}</Text>
        <Pressable
          hasTVPreferredFocus
          style={({ focused }) => [styles.retryBtn, focused && styles.focusHighlight]}
          onPress={() => refetch()}
        >
          <MaterialIcons name="refresh" size={20} color="#070b14" />
          <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      {/* شريط تبويب للهواتف والشاشات الصغيرة */}
      {!isWide && (
        <View style={styles.mobileTabBar}>
          <Pressable
            style={[styles.mobileTabBtn, mobileTab === 'groups' && styles.mobileTabBtnActive]}
            onPress={() => setMobileTab('groups')}
          >
            <MaterialIcons name="category" size={18} color={mobileTab === 'groups' ? '#38bdf8' : '#94a3b8'} />
            <Text style={[styles.mobileTabBtnText, mobileTab === 'groups' && styles.mobileTabBtnTextActive]}>
              الأقسام ({navGroups.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.mobileTabBtn, mobileTab === 'channels' && styles.mobileTabBtnActive]}
            onPress={() => setMobileTab('channels')}
          >
            <MaterialIcons name="live-tv" size={18} color={mobileTab === 'channels' ? '#38bdf8' : '#94a3b8'} />
            <Text style={[styles.mobileTabBtnText, mobileTab === 'channels' && styles.mobileTabBtnTextActive]}>
              القنوات ({activeChannels.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.mobileTabBtn, mobileTab === 'preview' && styles.mobileTabBtnActive]}
            onPress={() => setMobileTab('preview')}
          >
            <MaterialIcons name="play-circle-outline" size={18} color={mobileTab === 'preview' ? '#38bdf8' : '#94a3b8'} />
            <Text style={[styles.mobileTabBtnText, mobileTab === 'preview' && styles.mobileTabBtnTextActive]}>
              المعاينة المباشرة
            </Text>
          </Pressable>
        </View>
      )}

      {/* التخطيط الثلاثي الاحترافي (RTL: اليمين: الأقسام، الوسط: القنوات، اليسار: المعاينة) */}
      <View style={styles.columnsWrapper}>
        {/* ========================================================
            العمود الأيمن (~22%): الأقسام، البلدان، السلاسل، والمفضلة
            ======================================================== */}
        {(isWide || mobileTab === 'groups') && (
          <View style={[styles.column, styles.groupsColumn]}>
            <View style={styles.columnHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="dashboard" size={20} color="#38bdf8" />
                <Text style={styles.columnHeaderTitle}>الأقسام والباقات</Text>
              </View>
              <Text style={styles.columnHeaderSub}>{totalChannels} قناة متوفرة</Text>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 6 }}
            >
              {navGroups.map((group, index) => {
                const isSelected = selectedGroupId === group.id;
                return (
                  <Pressable
                    key={group.id}
                    focusable={true}
                    accessible={true}
                    hasTVPreferredFocus={index === 0 && !previewChannel}
                    style={({ focused }) => [
                      styles.groupItemRow,
                      isSelected && styles.groupItemRowSelected,
                      focused && styles.focusHighlight,
                    ]}
                    onPress={() => {
                      setSelectedGroupId(group.id);
                      if (!isWide) {
                        setMobileTab('channels');
                      }
                    }}
                  >
                    {({ focused }) => (
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                        <MaterialIcons
                          name={group.icon}
                          size={20}
                          color={
                            focused
                              ? '#38bdf8'
                              : isSelected
                              ? '#38bdf8'
                              : group.type === 'favorites'
                              ? '#eab308'
                              : '#94a3b8'
                          }
                        />
                        <Text
                          style={[
                            styles.groupItemName,
                            isSelected && styles.groupItemNameSelected,
                            focused && styles.textFocused,
                          ]}
                          numberOfLines={1}
                        >
                          {group.name}
                        </Text>
                        <View
                          style={[
                            styles.groupItemBadge,
                            isSelected && { backgroundColor: 'rgba(56, 189, 248, 0.25)' },
                            focused && { backgroundColor: '#38bdf8' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.groupItemBadgeText,
                              focused && { color: '#070b14', fontWeight: '800' },
                            ]}
                          >
                            {group.count}
                          </Text>
                        </View>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ========================================================
            العمود الأوسط (~40%): قائمة القنوات المدمجة (Compact Rows)
            ======================================================== */}
        {(isWide || mobileTab === 'channels') && (
          <View style={[styles.column, styles.channelsColumn]}>
            {/* رأس عمود القنوات مع شريط بحث مدمج */}
            <View style={styles.columnHeader}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="live-tv" size={20} color="#38bdf8" />
                  <Text style={styles.columnHeaderTitle}>{selectedGroup.name}</Text>
                </View>
                <Text style={styles.columnHeaderSub}>{activeChannels.length} قناة</Text>
              </View>

              {/* حقل البحث السريع */}
              <View style={styles.searchBar}>
                <MaterialIcons name="search" size={18} color="#64748b" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="ابحث عن قناة في هذا القسم..."
                  placeholderTextColor="#64748b"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <MaterialIcons name="close" size={18} color="#94a3b8" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* قائمة القنوات المدمجة */}
            {activeChannels.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="tv-off" size={48} color="#334155" />
                <Text style={styles.emptyText}>لا توجد قنوات في هذا القسم</Text>
              </View>
            ) : (
              <FlatList<MediaItem>
                ref={channelsFlatListRef}
                data={activeChannels}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}
                initialNumToRender={20}
                maxToRenderPerBatch={25}
                windowSize={15}
                renderItem={({ item, index }) => {
                  const isPreviewing = previewChannel?.id === item.id;
                  const isFav = favoriteIds.includes(item.id);
                  const channelNum = String(index + 1).padStart(3, '0');

                  return (
                    <Pressable
                      focusable={true}
                      accessible={true}
                      hasTVPreferredFocus={index === 0}
                      onPress={() => handleChannelPress(item)}
                      style={({ focused }) => [
                        styles.channelRow,
                        isPreviewing && styles.channelRowPreviewing,
                        focused && styles.focusHighlight,
                      ]}
                    >
                      {({ focused }) => (
                        <View style={styles.channelRowContent}>
                          {/* رقم القناة التسلسلي */}
                          <Text style={[styles.channelNumber, focused && styles.textFocused]}>
                            {channelNum}
                          </Text>

                          {/* شعار القناة */}
                          <View style={styles.logoContainer}>
                            <ChannelLogo
                              uri={item.logo}
                              name={item.name}
                              size={38}
                              focused={focused}
                              style={styles.channelLogo}
                            />
                          </View>

                          {/* اسم القناة */}
                          <View style={{ flex: 1, paddingHorizontal: 6 }}>
                            <Text
                              style={[
                                styles.channelName,
                                isPreviewing && styles.channelNamePreviewing,
                                focused && styles.textFocused,
                              ]}
                              numberOfLines={1}
                            >
                              {item.name}
                            </Text>
                            {item.groupTitle && (
                              <Text style={styles.channelCategorySmall} numberOfLines={1}>
                                {item.groupTitle}
                              </Text>
                            )}
                          </View>

                          {/* شارة التشغيل المباشر أو المفضلة */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {isPreviewing && (
                              <View style={styles.nowPlayingBadge}>
                                <View style={styles.greenPulseDot} />
                                <Text style={styles.nowPlayingText}>يعمل الآن</Text>
                              </View>
                            )}

                            {isFav && (
                              <MaterialIcons name="star" size={16} color="#eab308" />
                            )}
                          </View>
                        </View>
                      )}
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        )}

        {/* ========================================================
            العمود الأيسر (~38%): نافذة المعاينة المباشرة (Live Preview)
            ======================================================== */}
        {(isWide || mobileTab === 'preview') && (
          <View style={[styles.column, styles.previewColumn]}>
            {previewChannel ? (
              <View style={styles.previewContainer}>
                {/* 1. نافذة مشغل الفيديو المباشر المصغرة (16:9) */}
                <View style={styles.videoPlayerBox}>
                  <TVPlayer
                    streamUrl={previewChannel.streamUrl}
                    streamType={previewChannel.streamType || 'auto'}
                    style={styles.playerInner}
                  />

                  {/* تلميح الضغط المزدوج للشاشات */}
                  <View style={styles.playerOverlayHint}>
                    <Text style={styles.playerOverlayHintText}>معاينة حية • اضغط OK للتكبير</Text>
                  </View>
                </View>

                {/* 2. بيانات القناة الحالية المشغلة */}
                <View style={styles.previewInfoCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <ChannelLogo
                      uri={previewChannel.logo}
                      name={previewChannel.name}
                      size={54}
                      style={{ borderRadius: 8, backgroundColor: '#1e293b' }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewChannelTitle} numberOfLines={2}>
                        {previewChannel.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        {previewChannel.country ? (
                          <View style={styles.countryTag}>
                            <MaterialIcons name="flag" size={12} color="#38bdf8" />
                            <Text style={styles.countryTagText}>{previewChannel.country}</Text>
                          </View>
                        ) : null}
                        <View style={styles.categoryTag}>
                          <Text style={styles.categoryTagText}>
                            {previewChannel.groupTitle || 'بث مباشر'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* 3. أزرار التحكم السريعة (ملء الشاشة، المفضلة) */}
                  <View style={styles.previewActionsRow}>
                    <Pressable
                      focusable={true}
                      accessible={true}
                      style={({ focused }) => [
                        styles.fullscreenBtn,
                        focused && styles.focusHighlight,
                      ]}
                      onPress={() => handleOpenFullScreen(previewChannel)}
                    >
                      <MaterialIcons name="fullscreen" size={22} color="#070b14" />
                      <Text style={styles.fullscreenBtnText}>مشاهدة بملء الشاشة</Text>
                    </Pressable>

                    <Pressable
                      focusable={true}
                      accessible={true}
                      style={({ focused }) => [
                        styles.favToggleBtn,
                        favoriteIds.includes(previewChannel.id) && styles.favToggleBtnActive,
                        focused && styles.focusHighlight,
                      ]}
                      onPress={() => toggleFavorite(previewChannel.id)}
                    >
                      <MaterialIcons
                        name={favoriteIds.includes(previewChannel.id) ? 'star' : 'star-border'}
                        size={20}
                        color={favoriteIds.includes(previewChannel.id) ? '#eab308' : '#94a3b8'}
                      />
                      <Text
                        style={[
                          styles.favToggleBtnText,
                          favoriteIds.includes(previewChannel.id) && { color: '#eab308', fontWeight: '700' },
                        ]}
                      >
                        {favoriteIds.includes(previewChannel.id) ? 'في المفضلة' : 'إضافة للمفضلة'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* إرشادات التحكم بالريموت */}
                  <View style={styles.remoteTipsBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialIcons name="settings-remote" size={16} color="#38bdf8" />
                      <Text style={styles.remoteTipsTitle}>إرشادات ريموت التلفاز:</Text>
                    </View>
                    <Text style={styles.remoteTipsDesc}>
                      • اضغط <Text style={{ color: '#38bdf8', fontWeight: '700' }}>OK</Text> مرة لتشغيل المعاينة، ومرتين لملء الشاشة.
                    </Text>
                    <Text style={styles.remoteTipsDesc}>
                      • سهم <Text style={{ color: '#38bdf8', fontWeight: '700' }}>اليمين</Text> يرجع للأقسام، وسهم <Text style={{ color: '#38bdf8', fontWeight: '700' }}>اليسار</Text> ينتقل لزر ملء الشاشة.
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="tv" size={60} color="#1e293b" />
                <Text style={styles.emptyText}>اختر قناة لبدء المعاينة المباشرة</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#070b14',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#070b14',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 16,
  },
  loadingSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ef4444',
    marginTop: 14,
  },
  errorDesc: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#38bdf8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryBtnText: {
    color: '#070b14',
    fontWeight: '800',
    fontSize: 14,
  },

  // أزرار الهاتف
  mobileTabBar: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  mobileTabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  mobileTabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  mobileTabBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  mobileTabBtnTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },

  // غلاف الأعمدة الثلاثة
  columnsWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  column: {
    height: '100%',
    borderLeftWidth: 1,
    borderLeftColor: '#1e293b',
  },

  // 1. عمود الأقسام (~22%)
  groupsColumn: {
    width: '22%',
    backgroundColor: '#0b1120',
  },
  columnHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  columnHeaderTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  columnHeaderSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  groupItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 6,
    marginHorizontal: 6,
    marginVertical: 2,
  },
  groupItemRowSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
  },
  groupItemName: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  groupItemNameSelected: {
    color: '#38bdf8',
    fontWeight: '800',
  },
  groupItemBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  groupItemBadgeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },

  // 2. عمود القنوات (~40%)
  channelsColumn: {
    width: '40%',
    backgroundColor: '#070b14',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1120',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 10,
    height: 36,
    marginTop: 8,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 12,
    paddingVertical: 0,
    textAlign: 'right',
  },
  channelRow: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    borderRadius: 8,
    marginHorizontal: 6,
    marginVertical: 2,
  },
  channelRowPreviewing: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
  },
  channelRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelNumber: {
    width: 32,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  logoContainer: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  channelLogo: {
    width: 38,
    height: 38,
  },
  channelName: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  channelNamePreviewing: {
    color: '#10b981',
  },
  channelCategorySmall: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
  },
  nowPlayingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  nowPlayingText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
  },

  // 3. عمود المعاينة المباشرة (~38%)
  previewColumn: {
    width: '38%',
    backgroundColor: '#0b1120',
  },
  previewContainer: {
    flex: 1,
  },
  videoPlayerBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  playerInner: {
    width: '100%',
    height: '100%',
  },
  playerOverlayHint: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  playerOverlayHintText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '600',
  },
  previewInfoCard: {
    padding: 16,
  },
  previewChannelTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
  },
  countryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  countryTagText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryTag: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryTagText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
  },
  previewActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  fullscreenBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#38bdf8',
    paddingVertical: 12,
    borderRadius: 8,
  },
  fullscreenBtnText: {
    color: '#070b14',
    fontSize: 13,
    fontWeight: '800',
  },
  favToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  favToggleBtnActive: {
    borderColor: '#eab308',
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
  },
  favToggleBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  remoteTipsBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 4,
  },
  remoteTipsTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  remoteTipsDesc: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
  },

  // حالات الفراغ
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 8,
  },

  // نظام التركيز الموحد بالريموت (D-Pad Focus)
  focusHighlight: {
    borderWidth: 2.5,
    borderColor: '#38bdf8',
    backgroundColor: '#1e293b',
    transform: [{ scale: 1.02 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  textFocused: {
    color: '#38bdf8',
    fontWeight: '800',
  },
});
