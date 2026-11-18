import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { useMediaData, CategoryGroup } from '../hooks/useMediaData';
import { DEFAULT_BACKEND_M3U_URL } from '../utils/m3uParser';

type TabType = 'category' | 'country';

/**
 * شاشة لوحة التحكم والتصنيفات المركزية بتصميم تلفاز داكن (#0f172a) واستجابة كاملة للريموت.
 * تدعم التبويب بين "حسب القسم" و "حسب الدولة".
 */
export default function DashboardScreen(): React.JSX.Element {
  const router = useRouter();
  const {
    playlistUrl,
    setPlaylistUrl,
    activeDashboardTab,
    setActiveDashboardTab,
  } = useAppStore();

  const activeTab = activeDashboardTab;
  const setActiveTab = setActiveDashboardTab;

  // التأكد من توجيه التطبيق دائماً للرابط المركزي السحابي الموحد
  useEffect(() => {
    if (!playlistUrl || playlistUrl.trim().length === 0) {
      setPlaylistUrl(DEFAULT_BACKEND_M3U_URL);
    }
  }, [playlistUrl, setPlaylistUrl]);

  const { categories, countries, totalChannels, isLoading, isError, error, refetch } =
    useMediaData();

  // 1. حالة التحميل
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingTitle}>جاري تحميل وتجميع القنوات التلفزيونية...</Text>
        <Text style={styles.loadingSub}>جاري الاتصال بالخادم لجلب القنوات...</Text>
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

          <View style={styles.errorActions}>
            <Pressable
              hasTVPreferredFocus
              onPress={() => refetch()}
              style={({ focused }) => [styles.actionBtn, focused && styles.actionBtnFocused]}
            >
              {({ focused }) => (
                <View style={styles.btnContent}>
                  <MaterialIcons name="refresh" size={20} color={focused ? '#000000' : '#ffffff'} />
                  <Text style={[styles.actionBtnText, focused && styles.actionBtnTextFocused]}>
                    إعادة المحاولة
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const currentList = activeTab === 'category' ? categories : countries;

  // 3. حالة النجاح: شبكة التصنيفات / الدول
  return (
    <View style={styles.container}>
      {/* شريط العنوان وشريط التبويب العلوي */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>القنوات التلفزيونية</Text>
          <Text style={styles.headerSubtitle}>
            {activeTab === 'category'
              ? `إجمالي الأقسام: ${categories.length} • إجمالي القنوات: ${totalChannels} قناة`
              : `إجمالي الدول: ${countries.length} • إجمالي القنوات: ${totalChannels} قناة`}
          </Text>
        </View>

        {/* أزرار التبويب: حسب القسم وحسب الدولة */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => setActiveTab('category')}
            style={({ focused }) => [
              styles.tabBtn,
              activeTab === 'category' && styles.tabBtnActive,
              focused && styles.tabBtnFocused,
            ]}
          >
            {({ focused }) => (
              <View style={styles.tabContent}>
                <MaterialIcons
                  name="category"
                  size={20}
                  color={
                    focused
                      ? '#000000'
                      : activeTab === 'category'
                      ? '#ffffff'
                      : '#94a3b8'
                  }
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'category' && styles.tabTextActive,
                    focused && styles.tabTextFocused,
                  ]}
                >
                  حسب القسم
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('country')}
            style={({ focused }) => [
              styles.tabBtn,
              activeTab === 'country' && styles.tabBtnActive,
              focused && styles.tabBtnFocused,
            ]}
          >
            {({ focused }) => (
              <View style={styles.tabContent}>
                <MaterialIcons
                  name="public"
                  size={20}
                  color={
                    focused
                      ? '#000000'
                      : activeTab === 'country'
                      ? '#ffffff'
                      : '#94a3b8'
                  }
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === 'country' && styles.tabTextActive,
                    focused && styles.tabTextFocused,
                  ]}
                >
                  حسب الدولة
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* شبكة البطاقات المتجاوبة */}
      <FlatList<CategoryGroup>
        data={currentList}
        keyExtractor={(item) => `${activeTab}-${item.name}`}
        numColumns={3}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const isMovie =
            item.name.includes('أفلام') || item.name === 'أفلام عالمية';

          let iconName: keyof typeof MaterialIcons.glyphMap = 'live-tv';
          if (isMovie) {
            iconName = 'movie';
          } else if (activeTab === 'country') {
            iconName = 'flag';
          }

          return (
            <View style={styles.gridItem}>
              <Pressable
                hasTVPreferredFocus={index === 0}
                onPress={() => {
                  if (activeTab === 'country') {
                    router.push({
                      pathname: '/category/[name]',
                      params: { name: item.name, filterBy: 'country' },
                    });
                  } else {
                    router.push({
                      pathname: '/category/[name]',
                      params: { name: item.name },
                    });
                  }
                }}
                style={({ focused }) => [
                  styles.categoryCard,
                  focused && styles.categoryCardFocused,
                ]}
              >
                {({ focused }) => (
                  <View style={styles.cardInner}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconCircle, focused && styles.iconCircleFocused]}>
                        <MaterialIcons
                          name={iconName}
                          size={28}
                          color={focused ? '#0284c7' : '#38bdf8'}
                        />
                      </View>
                      <View style={[styles.countBadge, focused && styles.countBadgeFocused]}>
                        <Text style={[styles.countText, focused && styles.countTextFocused]}>
                          {item.count} {isMovie ? 'فيلم' : 'قناة'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardBottom}>
                      <Text
                        numberOfLines={1}
                        style={[styles.categoryTitle, focused && styles.categoryTitleFocused]}
                      >
                        {item.name}
                      </Text>
                      <Text style={[styles.categorySub, focused && styles.categorySubFocused]}>
                        اضغط للاستعراض
                      </Text>
                    </View>
                  </View>
                )}
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexWrap: 'wrap',
    gap: 16,
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
    padding: 5,
    borderWidth: 1.5,
    borderColor: '#1e293b',
    gap: 8,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
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
    elevation: 8,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  tabTextFocused: {
    color: '#000000',
    fontWeight: '900',
  },
  gridContainer: {
    paddingBottom: 40,
  },
  gridItem: {
    flex: 1,
    padding: 10,
  },
  categoryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 20,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  categoryCardFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.06 }],
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 10,
  },
  cardInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleFocused: {
    backgroundColor: '#f1f5f9',
  },
  countBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  countBadgeFocused: {
    backgroundColor: '#e2e8f0',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  countTextFocused: {
    color: '#0f172a',
  },
  cardBottom: {
    marginTop: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  categoryTitleFocused: {
    color: '#000000',
    fontWeight: '900',
  },
  categorySub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  categorySubFocused: {
    color: '#475569',
  },
  actionBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnFocused: {
    backgroundColor: '#ffffff',
    transform: [{ scale: 1.05 }],
    shadowColor: '#ffffff',
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  actionBtnTextFocused: {
    color: '#000000',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 20,
  },
  loadingSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
  },
  errorCard: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: 480,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 16,
  },
  errorDesc: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  errorActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
