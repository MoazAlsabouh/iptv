import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BACKEND_BASE_URL } from '../../context/AuthContext';

interface SubscriptionCode {
  id: number;
  code: string;
  durationDays: number;
  maxDevices: number;
  deviceCount: number;
  status: 'active' | 'unused' | 'expired' | 'suspended';
  note: string;
  createdAt: string;
  activatedAt?: string;
  expiresAt?: string;
  remainingDays: number;
  isExpired: boolean;
}

interface Stats {
  total: number;
  active: number;
  unused: number;
  expired: number;
  suspended: number;
}

const ADMIN_STORAGE_KEY = 'iptv_admin_key';

export default function AdminScreen(): React.JSX.Element {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [adminKey, setAdminKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    unused: 0,
    expired: 0,
    suspended: 0,
  });
  const [codes, setCodes] = useState<SubscriptionCode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // حالة نموذج التوليد
  const [genDuration, setGenDuration] = useState<number>(30);
  const [genMaxDevices, setGenMaxDevices] = useState<number>(1);
  const [genCount, setGenCount] = useState<number>(1);
  const [genNote, setGenNote] = useState<string>('');
  const [generatedBatch, setGeneratedBatch] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // حالة الفلترة والبحث
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'unused' | 'expired' | 'suspended'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // استرجاع المفتاح المحفوظ
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const saved = window.sessionStorage.getItem(ADMIN_STORAGE_KEY);
      if (saved) {
        setAdminKey(saved);
        setIsAuthenticated(true);
      }
    }
  }, []);

  // جلب قائمة الأكواد والإحصائيات
  const fetchAdminData = useCallback(async (keyToUse?: string) => {
    const key = keyToUse || adminKey;
    if (!key) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/codes`, {
        headers: {
          'X-Admin-Key': key,
        },
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        setAuthError('كلمة مرور الإدارة غير صحيحة');
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.sessionStorage.removeItem(ADMIN_STORAGE_KEY);
        }
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setStats(data.stats || { total: 0, active: 0, unused: 0, expired: 0, suspended: 0 });
        setCodes(data.codes || []);
        setIsAuthenticated(true);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.sessionStorage.setItem(ADMIN_STORAGE_KEY, key);
        }
      }
    } catch {
      setStatusMessage('تعذر الاتصال بالخادم');
    } finally {
      setIsLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (isAuthenticated && adminKey) {
      fetchAdminData();
    }
  }, [isAuthenticated, adminKey, fetchAdminData]);

  const handleAdminLogin = async () => {
    if (!keyInput.trim()) {
      setAuthError('يرجى إدخال كلمة مرور الإدارة');
      return;
    }
    setAuthError(null);
    setAdminKey(keyInput.trim());
    await fetchAdminData(keyInput.trim());
  };

  const handleAdminLogout = () => {
    setIsAuthenticated(false);
    setAdminKey('');
    setKeyInput('');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    }
  };

  // توليد أكواد جديدة
  const handleGenerateCodes = async () => {
    setActionLoading('generate');
    setStatusMessage(null);
    setGeneratedBatch([]);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify({
          durationDays: genDuration,
          maxDevices: genMaxDevices,
          count: genCount,
          note: genNote.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedBatch(data.codes || []);
        setStatusMessage(`تم توليد ${data.count} كود بنجاح!`);
        setGenNote('');
        fetchAdminData();
      } else {
        setStatusMessage(data.error || 'فشل توليد الأكواد');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء التوليد');
    } finally {
      setActionLoading(null);
    }
  };

  // نسخ كود للحافظة
  const copyToClipboard = (text: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => {
        setCopiedCode(null);
      }, 2500);
    }
  };

  // إجراءات سريعة على كود معين
  const handleUpdateCode = async (
    code: string,
    payload: { status?: string; addDays?: number; resetDevices?: boolean }
  ) => {
    setActionLoading(code);
    setStatusMessage(null);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/codes/${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(data.message || 'تم تحديث الكود بنجاح');
        fetchAdminData();
      } else {
        setStatusMessage(data.error || 'فشل تحديث الكود');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء التحديث');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCode = async (code: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`هل أنت متأكد من حذف الكود ${code} نهائياً؟`);
      if (!confirmed) return;
    }

    setActionLoading(code);
    setStatusMessage(null);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/codes/${encodeURIComponent(code)}`, {
        method: 'DELETE',
        headers: {
          'X-Admin-Key': adminKey,
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage('تم حذف الكود بنجاح');
        fetchAdminData();
      } else {
        setStatusMessage(data.error || 'فشل حذف الكود');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء الحذف');
    } finally {
      setActionLoading(null);
    }
  };

  // تصفية الأكواد
  const filteredCodes = useMemo(() => {
    let result = codes;
    if (filterTab !== 'all') {
      result = result.filter((c) => c.status === filterTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          (c.note && c.note.toLowerCase().includes(q))
      );
    }
    return result;
  }, [codes, filterTab, searchQuery]);

  // شاشة تسجيل دخول المشرف
  if (!isAuthenticated) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <View style={styles.loginIconCircle}>
            <MaterialIcons name="admin-panel-settings" size={44} color="#f59e0b" />
          </View>
          <Text style={styles.loginTitle}>لوحة إدارة الاشتراكات</Text>
          <Text style={styles.loginSub}>
            هذه الصفحة مخصصة لمدير المنصة فقط. يرجى إدخال مفتاح الإدارة للمتابعة.
          </Text>

          <View style={styles.loginInputWrapper}>
            <MaterialIcons name="lock" size={20} color="#94a3b8" />
            <TextInput
              style={styles.loginInput}
              secureTextEntry
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder="أدخل مفتاح الإدارة (ADMIN_SECRET)"
              placeholderTextColor="#64748b"
              onSubmitEditing={handleAdminLogin}
            />
          </View>

          {authError && <Text style={styles.loginErrorText}>{authError}</Text>}

          <Pressable
            onPress={handleAdminLogin}
            style={({ focused }) => [styles.loginBtn, focused && styles.btnFocused]}
          >
            <Text style={styles.loginBtnText}>دخول لوحة التحكم</Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/')}
            style={{ marginTop: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#64748b', fontSize: 13 }}>العودة للتطبيق الرئيسي</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.mainScroll} showsVerticalScrollIndicator={false}>
        {/* شريط الإدارة العلوي */}
        <View style={styles.topBar}>
          <View style={styles.topBarRight}>
            <MaterialIcons name="security" size={28} color="#38bdf8" />
            <View>
              <Text style={styles.dashboardTitle}>لوحة إدارة الاشتراكات</Text>
              <Text style={styles.dashboardSub}>نظام أكواد التفعيل المباشر (Cloudflare D1)</Text>
            </View>
          </View>

          <View style={styles.topBarActions}>
            <Pressable
              onPress={() => fetchAdminData()}
              style={({ focused }) => [styles.topActionBtn, focused && styles.btnFocused]}
            >
              <MaterialIcons name="refresh" size={18} color="#38bdf8" />
              <Text style={styles.topActionText}>تحديث</Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace('/')}
              style={({ focused }) => [styles.topActionBtn, focused && styles.btnFocused]}
            >
              <MaterialIcons name="home" size={18} color="#ffffff" />
              <Text style={styles.topActionText}>الرئيسية</Text>
            </Pressable>

            <Pressable
              onPress={handleAdminLogout}
              style={({ focused }) => [styles.logoutBtn, focused && styles.btnFocused]}
            >
              <MaterialIcons name="exit-to-app" size={18} color="#ef4444" />
              <Text style={[styles.topActionText, { color: '#ef4444' }]}>خروج</Text>
            </Pressable>
          </View>
        </View>

        {/* إشعار الحالة */}
        {statusMessage && (
          <View style={styles.statusBanner}>
            <MaterialIcons name="info" size={20} color="#38bdf8" />
            <Text style={styles.statusBannerText}>{statusMessage}</Text>
          </View>
        )}

        {/* 1. بطاقات الإحصائيات السريعة */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderLeftColor: '#38bdf8' }]}>
            <Text style={styles.statLabel}>إجمالي الأكواد</Text>
            <Text style={[styles.statValue, { color: '#38bdf8' }]}>{stats.total}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
            <Text style={styles.statLabel}>النشطة</Text>
            <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.active}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#6366f1' }]}>
            <Text style={styles.statLabel}>غير مستخدمة</Text>
            <Text style={[styles.statValue, { color: '#6366f1' }]}>{stats.unused}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#94a3b8' }]}>
            <Text style={styles.statLabel}>المنتهية</Text>
            <Text style={[styles.statValue, { color: '#94a3b8' }]}>{stats.expired}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={styles.statLabel}>الموقوفة</Text>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.suspended}</Text>
          </View>
        </View>

        {/* 2. قسم توليد أكواد جديدة */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="add-circle-outline" size={22} color="#10b981" />
            <Text style={styles.sectionTitle}>توليد أكواد اشتراك جديدة</Text>
          </View>

          <View style={styles.generatorRow}>
            {/* اختيار المدة */}
            <View style={styles.genCol}>
              <Text style={styles.fieldLabel}>المدة:</Text>
              <View style={styles.pillRow}>
                {[
                  { label: 'شهر (30)', days: 30 },
                  { label: '3 أشهر (90)', days: 90 },
                  { label: '6 أشهر (180)', days: 180 },
                  { label: 'سنة (365)', days: 365 },
                ].map((opt) => (
                  <Pressable
                    key={`dur-${opt.days}`}
                    onPress={() => setGenDuration(opt.days)}
                    style={[
                      styles.pillBtn,
                      genDuration === opt.days && styles.pillBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillBtnText,
                        genDuration === opt.days && styles.pillBtnTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* عدد الأجهزة */}
            <View style={styles.genCol}>
              <Text style={styles.fieldLabel}>أقصى عدد للأجهزة:</Text>
              <View style={styles.pillRow}>
                {[1, 2, 3, 5].map((num) => (
                  <Pressable
                    key={`dev-${num}`}
                    onPress={() => setGenMaxDevices(num)}
                    style={[
                      styles.pillBtn,
                      genMaxDevices === num && styles.pillBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillBtnText,
                        genMaxDevices === num && styles.pillBtnTextActive,
                      ]}
                    >
                      {num} {num === 1 ? 'جهاز' : 'أجهزة'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* عدد الأكواد وملاحظة المشترك */}
            <View style={styles.genInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>ملاحظة / اسم المشترك:</Text>
                <TextInput
                  style={styles.textInput}
                  value={genNote}
                  onChangeText={setGenNote}
                  placeholder="مثال: أحمد محمد - اشتراك سنوي"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={{ width: 110 }}>
                <Text style={styles.fieldLabel}>العدد:</Text>
                <TextInput
                  style={styles.textInput}
                  value={String(genCount)}
                  onChangeText={(t) => setGenCount(parseInt(t || '1', 10) || 1)}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={{ alignSelf: 'flex-end' }}>
                <Pressable
                  disabled={actionLoading === 'generate'}
                  onPress={handleGenerateCodes}
                  style={({ focused }) => [
                    styles.primaryBtn,
                    focused && styles.btnFocused,
                    actionLoading === 'generate' && { opacity: 0.6 },
                  ]}
                >
                  {actionLoading === 'generate' ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <MaterialIcons name="auto-fix-high" size={20} color="#000000" />
                      <Text style={styles.primaryBtnText}>توليد الأكواد</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>

          {/* صندوق الأكواد التي تم توليدها للتو مع زر نسخ سريع */}
          {generatedBatch.length > 0 && (
            <View style={styles.batchBox}>
              <View style={styles.batchHeader}>
                <Text style={styles.batchTitle}>
                  تم توليد الأكواد التالية (انقر للنسخ والإرسال):
                </Text>
                <Pressable
                  onPress={() => copyToClipboard(generatedBatch.join('\n'))}
                  style={styles.copyAllBtn}
                >
                  <MaterialIcons name="content-copy" size={16} color="#38bdf8" />
                  <Text style={styles.copyAllText}>نسخ كافة الأكواد</Text>
                </Pressable>
              </View>

              <View style={styles.batchList}>
                {generatedBatch.map((c) => {
                  const isCopied = copiedCode === c;
                  return (
                    <Pressable
                      key={`batch-${c}`}
                      onPress={() => copyToClipboard(c)}
                      style={[styles.batchChip, isCopied && styles.batchChipCopied]}
                    >
                      <Text style={[styles.batchCodeText, isCopied && { color: '#10b981' }]}>
                        {c}
                      </Text>
                      <MaterialIcons
                        name={isCopied ? 'check' : 'content-copy'}
                        size={16}
                        color={isCopied ? '#10b981' : '#94a3b8'}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* 3. شريط البحث والفلترة */}
        <View style={styles.filterSection}>
          <View style={styles.filterTabs}>
            {[
              { id: 'all', label: `الكل (${stats.total})` },
              { id: 'active', label: `النشطة (${stats.active})` },
              { id: 'unused', label: `غير المستخدمة (${stats.unused})` },
              { id: 'expired', label: `المنتهية (${stats.expired})` },
              { id: 'suspended', label: `الموقوفة (${stats.suspended})` },
            ].map((tab) => (
              <Pressable
                key={`tab-${tab.id}`}
                onPress={() => setFilterTab(tab.id as any)}
                style={[
                  styles.filterTabBtn,
                  filterTab === tab.id && styles.filterTabBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filterTab === tab.id && styles.filterTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="البحث بالكود أو اسم المشترك..."
              placeholderTextColor="#64748b"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={18} color="#94a3b8" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* 4. قائمة وجدول الأكواد */}
        <View style={styles.tableCard}>
          {isLoading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text style={{ color: '#94a3b8', marginTop: 12 }}>جاري تحميل الأكواد...</Text>
            </View>
          ) : filteredCodes.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <MaterialIcons name="inbox" size={48} color="#334155" />
              <Text style={{ color: '#64748b', marginTop: 12, fontSize: 16 }}>
                لا توجد أكواد مطابقة
              </Text>
            </View>
          ) : (
            filteredCodes.map((item) => {
              const isItemLoading = actionLoading === item.code;
              const isCopied = copiedCode === item.code;

              return (
                <View key={`code-row-${item.id}`} style={styles.codeRow}>
                  {/* معلومات الكود الأساسية */}
                  <View style={styles.codeMainInfo}>
                    <View style={styles.codeTitleRow}>
                      <Text style={styles.codeText}>{item.code}</Text>
                      <Pressable
                        onPress={() => copyToClipboard(item.code)}
                        style={styles.miniCopyBtn}
                      >
                        <MaterialIcons
                          name={isCopied ? 'check' : 'content-copy'}
                          size={15}
                          color={isCopied ? '#10b981' : '#38bdf8'}
                        />
                        <Text style={[styles.miniCopyText, isCopied && { color: '#10b981' }]}>
                          {isCopied ? 'تم النسخ' : 'نسخ'}
                        </Text>
                      </Pressable>

                      {/* شارة الحالة */}
                      <View
                        style={[
                          styles.statusBadge,
                          item.status === 'active' && styles.statusBadgeActive,
                          item.status === 'unused' && styles.statusBadgeUnused,
                          item.status === 'expired' && styles.statusBadgeExpired,
                          item.status === 'suspended' && styles.statusBadgeSuspended,
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>
                          {item.status === 'active'
                            ? 'نشط'
                            : item.status === 'unused'
                            ? 'غير مستخدم'
                            : item.status === 'expired'
                            ? 'منتهي'
                            : 'موقوف'}
                        </Text>
                      </View>
                    </View>

                    {item.note ? (
                      <Text style={styles.codeNoteText}>{item.note}</Text>
                    ) : null}

                    <View style={styles.codeMetaRow}>
                      <Text style={styles.codeMetaText}>
                        المدة: {item.durationDays} يوم
                      </Text>
                      <Text style={styles.codeMetaDivider}>•</Text>
                      <Text style={styles.codeMetaText}>
                        الأجهزة: {item.deviceCount} / {item.maxDevices}
                      </Text>
                      <Text style={styles.codeMetaDivider}>•</Text>
                      <Text
                        style={[
                          styles.codeMetaText,
                          item.remainingDays <= 5 && item.status === 'active'
                            ? { color: '#f59e0b', fontWeight: 'bold' }
                            : {},
                        ]}
                      >
                        {item.status === 'unused'
                          ? 'لم يُفعّل بعد'
                          : `المتبقي: ${item.remainingDays} يوم`}
                      </Text>
                    </View>
                  </View>

                  {/* أزرار الإجراءات السريعة */}
                  <View style={styles.actionsRow}>
                    {isItemLoading ? (
                      <ActivityIndicator size="small" color="#38bdf8" />
                    ) : (
                      <>
                        {/* تمديد +30 يوم */}
                        <Pressable
                          onPress={() => handleUpdateCode(item.code, { addDays: 30 })}
                          style={({ focused }) => [styles.actionBtn, focused && styles.btnFocused]}
                        >
                          <MaterialIcons name="more-time" size={16} color="#10b981" />
                          <Text style={[styles.actionBtnText, { color: '#10b981' }]}>
                            +30 يوم
                          </Text>
                        </Pressable>

                        {/* فك الأجهزة */}
                        <Pressable
                          onPress={() => handleUpdateCode(item.code, { resetDevices: true })}
                          style={({ focused }) => [styles.actionBtn, focused && styles.btnFocused]}
                        >
                          <MaterialIcons name="phonelink-erase" size={16} color="#38bdf8" />
                          <Text style={[styles.actionBtnText, { color: '#38bdf8' }]}>
                            فك الأجهزة
                          </Text>
                        </Pressable>

                        {/* إيقاف / تفعيل */}
                        <Pressable
                          onPress={() =>
                            handleUpdateCode(item.code, {
                              status: item.status === 'suspended' ? 'active' : 'suspended',
                            })
                          }
                          style={({ focused }) => [styles.actionBtn, focused && styles.btnFocused]}
                        >
                          <MaterialIcons
                            name={item.status === 'suspended' ? 'play-arrow' : 'pause'}
                            size={16}
                            color="#f59e0b"
                          />
                          <Text style={[styles.actionBtnText, { color: '#f59e0b' }]}>
                            {item.status === 'suspended' ? 'تفعيل' : 'إيقاف'}
                          </Text>
                        </Pressable>

                        {/* حذف الكود */}
                        <Pressable
                          onPress={() => handleDeleteCode(item.code)}
                          style={({ focused }) => [
                            styles.actionBtn,
                            styles.deleteBtn,
                            focused && styles.btnFocused,
                          ]}
                        >
                          <MaterialIcons name="delete-outline" size={16} color="#ef4444" />
                          <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>
                            حذف
                          </Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  mainScroll: {
    padding: 24,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  loginContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  loginIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  loginSub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  loginInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 14,
    paddingHorizontal: 14,
    width: '100%',
    marginBottom: 14,
  },
  loginInput: {
    flex: 1,
    height: 48,
    color: '#ffffff',
    fontSize: 15,
    paddingHorizontal: 8,
    textAlign: 'right',
  },
  loginErrorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  loginBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 16,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dashboardTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  dashboardSub: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  topActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statusBannerText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    borderLeftWidth: 4,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
  },
  sectionCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
  },
  generatorRow: {
    gap: 16,
  },
  genCol: {
    gap: 8,
  },
  fieldLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  pillBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  pillBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  pillBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  genInputsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  textInput: {
    backgroundColor: '#020617',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    height: 44,
    color: '#ffffff',
    paddingHorizontal: 14,
    fontSize: 14,
    textAlign: 'right',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#38bdf8',
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  btnFocused: {
    transform: [{ scale: 1.04 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  batchBox: {
    marginTop: 18,
    backgroundColor: 'rgba(2, 6, 23, 0.7)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  batchTitle: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '800',
  },
  copyAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  copyAllText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  batchList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  batchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  batchChipCopied: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  batchCodeText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  filterSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  filterTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterTabBtn: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  filterTabBtnActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  filterTabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  filterTabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 38,
    minWidth: 260,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    textAlign: 'right',
  },
  tableCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexWrap: 'wrap',
    gap: 14,
  },
  codeMainInfo: {
    flex: 1,
    minWidth: 260,
    gap: 6,
  },
  codeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    letterSpacing: 1,
  },
  miniCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  miniCopyText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusBadgeUnused: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  statusBadgeExpired: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  statusBadgeSuspended: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#cbd5e1',
  },
  codeNoteText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  codeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeMetaText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  codeMetaDivider: {
    color: '#334155',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
});
