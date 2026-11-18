import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
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

/**
 * شاشة لوحة التحكم الرئيسية بتصميم تلفاز داكن (#0f172a) واستجابة كاملة للريموت.
 */
export default function DashboardScreen(): React.JSX.Element {
  const router = useRouter();
  const { playlistUrl, setPlaylistUrl } = useAppStore();
  const [inputUrl, setInputUrl] = useState<string>('');
  const [inputFocused, setInputFocused] = useState<boolean>(false);

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

  // 1. حالة عدم وجود رابط
  if (!playlistUrl || playlistUrl.trim().length === 0) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.setupCard}>
          <MaterialIcons name="playlist-play" size={64} color="#38bdf8" />
          <Text style={styles.setupTitle}>إعداد قائمة التشغيل (M3U)</Text>
          <Text style={styles.setupDesc}>
            الصق رابط M3U أو اضغط على الزر أدناه لاستخدام خادم البث السحابي المدمج.
          </Text>

          <View style={[styles.inputWrapper, inputFocused && styles.inputWrapperFocused]}>
            <MaterialIcons name="link" size={22} color={inputFocused ? '#38bdf8' : '#64748b'} />
            <TextInput
              value={inputUrl}
              onChangeText={setInputUrl}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="https://example.com/playlist.m3u"
              placeholderTextColor="#64748b"
              style={styles.textInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Pressable
            hasTVPreferredFocus
            onPress={handleSaveUrl}
            style={({ focused }) => [styles.actionBtn, focused && styles.actionBtnFocused]}
          >
            {({ focused }) => (
              <View style={styles.btnContent}>
                <MaterialIcons name="check-circle" size={22} color={focused ? '#000000' : '#ffffff'} />
                <Text style={[styles.actionBtnText, focused && styles.actionBtnTextFocused]}>
                  حفظ وتحميل القنوات
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={handleUseDefaultUrl}
            style={({ focused }) => [styles.secondaryBtn, focused && styles.actionBtnFocused]}
          >
            {({ focused }) => (
              <View style={styles.btnContent}>
                <MaterialIcons name="cloud-download" size={20} color={focused ? '#000000' : '#38bdf8'} />
                <Text style={[styles.secondaryBtnText, focused && styles.actionBtnTextFocused]}>
                  استخدام الخادم السحابي المدمج
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  // 2. حالة التحميل
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.loadingTitle}>جاري تحميل وتجميع القنوات والأفلام...</Text>
        <Text style={styles.loadingSub}>يتم الاتصال بخادم Cloudflare Worker لجلب البث المباشر</Text>
      </View>
    );
  }

  // 3. حالة الخطأ
  if (isError) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorCard}>
          <MaterialIcons name="error-outline" size={60} color="#ef4444" />
          <Text style={styles.errorTitle}>تعذر تحميل قائمة القنوات</Text>
          <Text style={styles.errorDesc}>{error?.message || 'تأكد من الاتصال بالإنترنت'}</Text>

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

            <Pressable
              onPress={handleResetUrl}
              style={({ focused }) => [styles.resetBtn, focused && styles.actionBtnFocused]}
            >
              {({ focused }) => (
                <View style={styles.btnContent}>
                  <MaterialIcons name="link-off" size={20} color={focused ? '#000000' : '#f87171'} />
                  <Text style={[styles.resetBtnText, focused && styles.actionBtnTextFocused]}>
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

  // 4. حالة النجاح: شبكة التصنيفات
  return (
    <View style={styles.container}>
      {/* شريط الإحصائيات العلوي */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>لوحة التحكم والتصنيفات</Text>
          <Text style={styles.headerSubtitle}>
            إجمالي التصنيفات: {categories.length} • إجمالي المحتوى: {totalChannels} قناة وفيلم
          </Text>
        </View>

        <Pressable
          onPress={handleResetUrl}
          style={({ focused }) => [styles.headerBtn, focused && styles.headerBtnFocused]}
        >
          {({ focused }) => (
            <View style={styles.btnContent}>
              <MaterialIcons name="settings" size={18} color={focused ? '#000000' : '#94a3b8'} />
              <Text style={[styles.headerBtnText, focused && styles.headerBtnTextFocused]}>
                تغيير الرابط
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* شبكة التصنيفات المتجاوبة */}
      <FlatList<CategoryGroup>
        data={categories}
        keyExtractor={(item) => item.name}
        numColumns={3}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <View style={styles.gridItem}>
            <Pressable
              hasTVPreferredFocus={index === 0}
              onPress={() => {
                router.push({
                  pathname: '/category/[name]',
                  params: { name: item.name },
                });
              }}
              style={({ focused }) => [
                styles.categoryCard,
                focused && styles.categoryCardFocused,
              ]}
            >
              {({ focused }) => {
                const isMovieCategory = item.name.includes('أفلام');
                return (
                  <View style={styles.cardInner}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.iconCircle, focused && styles.iconCircleFocused]}>
                        <MaterialIcons
                          name={isMovieCategory ? 'movie' : 'live-tv'}
                          size={28}
                          color={focused ? '#0284c7' : '#38bdf8'}
                        />
                      </View>
                      <View style={[styles.countBadge, focused && styles.countBadgeFocused]}>
                        <Text style={[styles.countText, focused && styles.countTextFocused]}>
                          {item.count} {isMovieCategory ? 'فيلم' : 'قناة'}
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
                );
              }}
            </Pressable>
          </View>
        )}
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
  headerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerBtnFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.08 }],
  },
  headerBtnText: {
    fontSize: 13,
    color: '#94a3b8',
    marginLeft: 6,
    fontWeight: '600',
  },
  headerBtnTextFocused: {
    color: '#000000',
    fontWeight: 'bold',
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
  setupCard: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  setupTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
  },
  setupDesc: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 16,
    lineHeight: 22,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
    marginBottom: 16,
  },
  inputWrapperFocused: {
    borderColor: '#38bdf8',
    backgroundColor: '#0b1120',
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    marginLeft: 10,
    outlineWidth: 0,
  },
  actionBtn: {
    width: '100%',
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
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
  secondaryBtn: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#38bdf8',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
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
    gap: 12,
  },
  resetBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  resetBtnText: {
    color: '#f87171',
    fontWeight: '600',
    marginLeft: 6,
  },
});
