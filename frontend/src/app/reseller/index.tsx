import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BACKEND_BASE_URL } from '../../context/AuthContext';
import {
  getRemainingDays,
  formatRemainingDaysArabic,
  formatDateStandard,
} from '../../utils/dateFormat';

interface ResellerInfo {
  id: number;
  name: string;
  username: string;
  email?: string | null;
  note?: string;
}

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

const RESELLER_TOKEN_KEY = 'iptv_reseller_token';

export default function ResellerPortalScreen(): React.JSX.Element {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 960;

  // حالة المصادقة
  const [token, setToken] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [reseller, setReseller] = useState<ResellerInfo | null>(null);

  const [identifierInput, setIdentifierInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // بيانات لوحة الموزع
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

  // نموذج التوليد
  const [genDuration, setGenDuration] = useState<number>(30);
  const [genMaxDevices, setGenMaxDevices] = useState<number>(1);
  const [genCount, setGenCount] = useState<number>(1);
  const [genNote, setGenNote] = useState<string>('');
  const [generatedBatch, setGeneratedBatch] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // البحث والفلترة
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'unused' | 'expired' | 'suspended'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // مودال تعديل ملاحظة الكود
  const [editingCode, setEditingCode] = useState<SubscriptionCode | null>(null);
  const [editNoteValue, setEditNoteValue] = useState<string>('');

  // استرجاع جلسة الموزع المحفوظة
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const saved = window.sessionStorage.getItem(RESELLER_TOKEN_KEY);
      if (saved) {
        setToken(saved);
        setIsAuthenticated(true);
      }
    }
  }, []);

  // جلب أكواد وإحصائيات الموزع
  const fetchResellerData = useCallback(
    async (tokenToUse?: string) => {
      const authToken = tokenToUse || token;
      if (!authToken) return;

      setIsLoading(true);
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/api/reseller/codes`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (res.status === 401 || res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          setIsAuthenticated(false);
          setAuthError(errData.error || 'انتهت صلاحية جلسة الموزع، يرجى تسجيل الدخول مجدداً');
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.sessionStorage.removeItem(RESELLER_TOKEN_KEY);
          }
          return;
        }

        const data = await res.json();
        if (res.ok) {
          setStats(data.stats || { total: 0, active: 0, unused: 0, expired: 0, suspended: 0 });
          setCodes(data.codes || []);
          if (data.reseller) {
            setReseller(data.reseller);
          }
        }
      } catch {
        setStatusMessage('تعذر الاتصال بالخادم لجلب بيانات الأكواد');
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchResellerData();
    }
  }, [isAuthenticated, token, fetchResellerData]);

  // تسجيل الدخول لبوابة الموزع
  const handleLoginSubmit = async () => {
    const ident = identifierInput.trim();
    const pass = passwordInput.trim();

    if (!ident || !pass) {
      setAuthError('يرجى إدخال اسم المستخدم/البريد وكلمة المرور');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/reseller/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: ident, password: pass }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        setReseller(data.reseller);
        setIsAuthenticated(true);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.sessionStorage.setItem(RESELLER_TOKEN_KEY, data.token);
        }
        fetchResellerData(data.token);
      } else {
        setAuthError(data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } catch {
      setAuthError('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setToken('');
    setReseller(null);
    setPasswordInput('');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(RESELLER_TOKEN_KEY);
    }
  };

  // توليد أكواد لحساب الموزع
  const handleGenerateCodes = async () => {
    setActionLoading('generate');
    setStatusMessage(null);
    setGeneratedBatch([]);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/reseller/codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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
        setStatusMessage(`تم توليد ${data.count} كود بنجاح لحسابك!`);
        setGenNote('');
        fetchResellerData();
      } else {
        setStatusMessage(data.error || 'فشل توليد الأكواد');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء توليد الأكواد');
    } finally {
      setActionLoading(null);
    }
  };

  // نسخ كود
  const copyToClipboard = (text: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCode(text);
      setTimeout(() => setCopiedCode(null), 2500);
    }
  };

  // تحديث كود (تمديد، إيقاف/تفعيل، تصفير أجهزة، تعديل ملاحظة)
  const handleUpdateCode = async (
    code: string,
    payload: { status?: string; addDays?: number; resetDevices?: boolean; note?: string }
  ) => {
    setActionLoading(code);
    setStatusMessage(null);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/reseller/codes/${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(data.message || 'تم تحديث الكود بنجاح');
        fetchResellerData();
      } else {
        setStatusMessage(data.error || 'فشل تحديث الكود');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء التحديث');
    } finally {
      setActionLoading(null);
    }
  };

  // تصفية الأكواد بالبحث والحالة
  const filteredCodes = useMemo(() => {
    let result = codes;
    if (filterStatus !== 'all') {
      result = result.filter((c) => c.status === filterStatus);
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
  }, [codes, filterStatus, searchQuery]);

  // ==========================================
  // شاشة تسجيل دخول الموزع
  // ==========================================
  if (!isAuthenticated) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <Image
            source={{ uri: '/icon.png' }}
            style={{ width: 64, height: 64, borderRadius: 14, alignSelf: 'center', marginBottom: 14 }}
            resizeMode="contain"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff' }}>تلفازي</Text>
            <Text style={{ fontSize: 18, color: '#0EA5E9', fontWeight: '400' }}>|</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#94a3b8' }}>Telfazi</Text>
          </View>
          <Text style={styles.loginTitle}>بوابة الموزعين المعتمدين</Text>
          <Text style={styles.loginSub}>
            مرحباً بك في لوحة تحكم الوكيل. يرجى تسجيل الدخول للوصول إلى إدارة أكوادك ومتابعة
            مشتركيك.
          </Text>

          <View style={styles.loginInputWrapper}>
            <MaterialIcons name="person" size={20} color="#94a3b8" />
            <TextInput
              style={styles.loginInput}
              value={identifierInput}
              onChangeText={setIdentifierInput}
              placeholder="اسم المستخدم أو البريد الإلكتروني"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.loginInputWrapper, { marginTop: 12 }]}>
            <MaterialIcons name="lock" size={20} color="#94a3b8" />
            <TextInput
              style={styles.loginInput}
              secureTextEntry
              value={passwordInput}
              onChangeText={setPasswordInput}
              placeholder="كلمة المرور"
              placeholderTextColor="#64748b"
              onSubmitEditing={handleLoginSubmit}
            />
          </View>

          {authError && (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [styles.loginButton, pressed && { opacity: 0.85 }]}
            onPress={handleLoginSubmit}
            disabled={authLoading}
          >
            {authLoading ? (
              <ActivityIndicator color="#070b14" size="small" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>دخول لبوابة الموزع</Text>
                <MaterialIcons name="arrow-back" size={20} color="#070b14" />
              </>
            )}
          </Pressable>

          <Pressable style={styles.backToHomeBtn} onPress={() => router.replace('/')}>
            <MaterialIcons name="home" size={18} color="#94a3b8" />
            <Text style={styles.backToHomeText}>العودة للواجهة الرئيسية</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ==========================================
  // لوحة تحكم الموزع
  // ==========================================
  return (
    <View style={styles.container}>
      {/* الشريط العلوي */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Image
            source={{ uri: '/icon.png' }}
            style={{ width: 44, height: 44, borderRadius: 10 }}
            resizeMode="contain"
          />
          <View style={styles.headerTitleRow}>
            <View style={styles.headerBadge}>
              <MaterialIcons name="verified" size={16} color="#0EA5E9" />
              <Text style={styles.headerBadgeText}>تلفازي | موزع معتمد</Text>
            </View>
            <Text style={styles.headerMainTitle}>
              لوحة الموزع: {reseller?.name || 'موزع معتمد'}
            </Text>
            {reseller?.username && (
              <Text style={styles.headerSubUsername}>@{reseller.username}</Text>
            )}
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.refreshBtn} onPress={() => fetchResellerData()}>
            <MaterialIcons name="refresh" size={18} color="#38bdf8" />
            <Text style={styles.refreshBtnText}>تحديث</Text>
          </Pressable>

          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialIcons name="logout" size={18} color="#ef4444" />
            <Text style={styles.logoutBtnText}>خروج</Text>
          </Pressable>
        </View>
      </View>

      {statusMessage && (
        <View style={styles.statusBar}>
          <MaterialIcons name="info" size={18} color="#38bdf8" />
          <Text style={styles.statusBarText}>{statusMessage}</Text>
          <Pressable onPress={() => setStatusMessage(null)}>
            <MaterialIcons name="close" size={18} color="#94a3b8" />
          </Pressable>
        </View>
      )}

      {/* المحتوى القابل للتمرير */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* بطاقات إحصائيات الموزع */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderTopColor: '#38bdf8' }]}>
            <Text style={styles.statLabel}>إجمالي أكوادك</Text>
            <Text style={[styles.statValue, { color: '#38bdf8' }]}>{stats.total}</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: '#10b981' }]}>
            <Text style={styles.statLabel}>اشتراكات جارية</Text>
            <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.active}</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: '#f59e0b' }]}>
            <Text style={styles.statLabel}>أكواد جاهزة للبيع</Text>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.unused}</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: '#64748b' }]}>
            <Text style={styles.statLabel}>اشتراكات منتهية</Text>
            <Text style={[styles.statValue, { color: '#64748b' }]}>{stats.expired}</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: '#ef4444' }]}>
            <Text style={styles.statLabel}>موقوفة مؤقتاً</Text>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.suspended}</Text>
          </View>
        </View>

        {/* نموذج توليد أكواد لحساب الموزع */}
        <View style={styles.cardSection}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="add-circle-outline" size={22} color="#38bdf8" />
            <Text style={styles.cardTitle}>توليد أكواد اشتراك جديدة لعملائك</Text>
          </View>

          <View style={isWide ? styles.formGridWide : styles.formGridCol}>
            {/* الجهة المالكة للكود (تلقائية للقراءة فقط من الجلسة) */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>الجهة المالكة للكود (تلقائي):</Text>
              <View style={styles.ownerAutoBadge}>
                <MaterialIcons name="store" size={20} color="#10b981" />
                <Text style={styles.ownerAutoBadgeText}>
                  {reseller?.name ? `الموزع: ${reseller.name}` : 'حساب الموزع المعتمد'}
                </Text>
                <View style={styles.autoTag}>
                  <Text style={styles.autoTagText}>تلقائي من الجلسة</Text>
                </View>
              </View>
            </View>

            {/* مدة الاشتراك */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>مدة الاشتراك:</Text>
              <View style={styles.pillsRow}>
                {[
                  { label: 'شهر (30 يوم)', val: 30 },
                  { label: '3 أشهر (90 يوم)', val: 90 },
                  { label: '6 أشهر (180 يوم)', val: 180 },
                  { label: 'سنة (365 يوم)', val: 365 },
                ].map((item) => (
                  <Pressable
                    key={item.val}
                    style={[
                      styles.selectorPill,
                      genDuration === item.val && styles.selectorPillActive,
                    ]}
                    onPress={() => setGenDuration(item.val)}
                  >
                    <Text
                      style={[
                        styles.selectorPillText,
                        genDuration === item.val && styles.selectorPillTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* عدد الأجهزة والكمية */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>الحد الأقصى للأجهزة المتزامنة:</Text>
              <View style={styles.pillsRow}>
                {[1, 2, 3, 4, 5].map((num) => (
                  <Pressable
                    key={num}
                    style={[
                      styles.selectorPillSmall,
                      genMaxDevices === num && styles.selectorPillActive,
                    ]}
                    onPress={() => setGenMaxDevices(num)}
                  >
                    <Text
                      style={[
                        styles.selectorPillText,
                        genMaxDevices === num && styles.selectorPillTextActive,
                      ]}
                    >
                      {num} {num === 1 ? 'جهاز' : 'أجهزة'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>الكمية المراد توليدها:</Text>
              <View style={styles.pillsRow}>
                {[1, 5, 10, 20].map((num) => (
                  <Pressable
                    key={num}
                    style={[
                      styles.selectorPillSmall,
                      genCount === num && styles.selectorPillActive,
                    ]}
                    onPress={() => setGenCount(num)}
                  >
                    <Text
                      style={[
                        styles.selectorPillText,
                        genCount === num && styles.selectorPillTextActive,
                      ]}
                    >
                      {num} كود
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>اسم العميل / ملاحظة (اختياري):</Text>
              <TextInput
                style={styles.textInput}
                value={genNote}
                onChangeText={setGenNote}
                placeholder="مثال: اشتراك للأخ أحمد أو هاتف العميل"
                placeholderTextColor="#64748b"
              />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.generateButton,
              pressed && { opacity: 0.85 },
              actionLoading === 'generate' && { opacity: 0.6 },
            ]}
            onPress={handleGenerateCodes}
            disabled={actionLoading === 'generate'}
          >
            {actionLoading === 'generate' ? (
              <ActivityIndicator color="#070b14" size="small" />
            ) : (
              <>
                <MaterialIcons name="auto-awesome" size={20} color="#070b14" />
                <Text style={styles.generateButtonText}>
                  توليد {genCount} كود الآن ({genDuration} يوم)
                </Text>
              </>
            )}
          </Pressable>

          {/* الأكواد المولدة حديثاً مع زر نسخ فوري */}
          {generatedBatch.length > 0 && (
            <View style={styles.batchContainer}>
              <Text style={styles.batchTitle}>
                تم توليد الأكواد بنجاح ({generatedBatch.length}) - يمكنك نسخها للعميل:
              </Text>
              <View style={styles.batchList}>
                {generatedBatch.map((code) => (
                  <View key={code} style={styles.batchItem}>
                    <Text style={styles.batchCodeText}>{code}</Text>
                    <Pressable
                      style={[
                        styles.copyPill,
                        copiedCode === code && styles.copyPillSuccess,
                      ]}
                      onPress={() => copyToClipboard(code)}
                    >
                      <MaterialIcons
                        name={copiedCode === code ? 'check' : 'content-copy'}
                        size={16}
                        color={copiedCode === code ? '#10b981' : '#38bdf8'}
                      />
                      <Text
                        style={[
                          styles.copyPillText,
                          copiedCode === code && styles.copyPillTextSuccess,
                        ]}
                      >
                        {copiedCode === code ? 'تم النسخ!' : 'نسخ الكود'}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* أدوات البحث والفلترة */}
        <View style={styles.filterSection}>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={20} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="ابحث في أكوادك برقم الكود أو الملاحظة..."
              placeholderTextColor="#64748b"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={18} color="#94a3b8" />
              </Pressable>
            )}
          </View>

          <View style={styles.statusTabs}>
            {[
              { key: 'all', label: 'كافة الأكواد' },
              { key: 'active', label: 'المفعلة والجارية' },
              { key: 'unused', label: 'غير المستخدمة' },
              { key: 'expired', label: 'المنتهية' },
              { key: 'suspended', label: 'الموقوفة' },
            ].map((t) => (
              <Pressable
                key={t.key}
                style={[
                  styles.statusTabPill,
                  filterStatus === t.key && styles.statusTabPillActive,
                ]}
                onPress={() => setFilterStatus(t.key as any)}
              >
                <Text
                  style={[
                    styles.statusTabPillText,
                    filterStatus === t.key && styles.statusTabPillTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* قائمة الأكواد */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.loadingText}>جاري تحميل أكوادك...</Text>
          </View>
        ) : filteredCodes.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialIcons name="inbox" size={48} color="#475569" />
            <Text style={styles.emptyText}>لا توجد أكواد مطابقة لخيارات البحث</Text>
          </View>
        ) : (
          <View style={styles.codesGrid}>
            {filteredCodes.map((item) => {
              const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                active: { bg: '#064e3b', text: '#34d399', label: 'نشط وجاري' },
                unused: { bg: '#451a03', text: '#fbbf24', label: 'جاهز للبيع' },
                expired: { bg: '#1e293b', text: '#94a3b8', label: 'منتهي الصلاحية' },
                suspended: { bg: '#450a0a', text: '#f87171', label: 'موقوف' },
              };
              const curStatus = statusColors[item.status] || statusColors.unused;

              return (
                <View key={item.id} style={styles.codeCard}>
                  <View style={styles.codeCardTop}>
                    <View style={styles.codeTypeBadge}>
                      <MaterialIcons name="vpn-key" size={14} color="#38bdf8" />
                      <Text style={styles.codeTypeBadgeText}>كود اشتراك</Text>
                    </View>

                    <View style={[styles.badge, { backgroundColor: curStatus.bg }]}>
                      <Text style={[styles.badgeText, { color: curStatus.text }]}>
                        {curStatus.label}
                      </Text>
                    </View>
                  </View>

                  {/* الكود والنسخ */}
                  <View style={styles.codeMainRow}>
                    <Text style={styles.codeValueText}>{item.code}</Text>
                    <Pressable
                      style={[
                        styles.copyIconBtn,
                        copiedCode === item.code && styles.copyIconBtnSuccess,
                      ]}
                      onPress={() => copyToClipboard(item.code)}
                    >
                      <MaterialIcons
                        name={copiedCode === item.code ? 'check' : 'content-copy'}
                        size={18}
                        color={copiedCode === item.code ? '#10b981' : '#38bdf8'}
                      />
                    </Pressable>
                  </View>

                  {/* التفاصيل */}
                  <View style={styles.codeDetails}>
                    <View style={styles.detailRow}>
                      <MaterialIcons name="timer" size={16} color="#94a3b8" />
                      <Text style={styles.detailLabel}>المدة:</Text>
                      <Text style={styles.detailVal}>{item.durationDays} يوم</Text>
                      {item.status === 'active' && (
                        <Text style={styles.remainingVal}>
                          ({formatRemainingDaysArabic(getRemainingDays(item.expiresAt) || item.remainingDays, item.expiresAt)})
                        </Text>
                      )}
                    </View>

                    <View style={styles.detailRow}>
                      <MaterialIcons name="devices" size={16} color="#94a3b8" />
                      <Text style={styles.detailLabel}>الأجهزة:</Text>
                      <Text style={styles.detailVal}>
                        {item.deviceCount} من {item.maxDevices} مسموح
                      </Text>
                    </View>

                    {item.note ? (
                      <View style={styles.detailRow}>
                        <MaterialIcons name="notes" size={16} color="#94a3b8" />
                        <Text style={styles.detailLabel}>ملاحظة:</Text>
                        <Text style={styles.detailVal}>{item.note}</Text>
                      </View>
                    ) : null}

                    {item.expiresAt ? (
                      <View style={styles.detailRow}>
                        <MaterialIcons name="event" size={16} color="#94a3b8" />
                        <Text style={styles.detailLabel}>الانتهاء:</Text>
                        <Text style={styles.detailVal}>
                          {formatDateStandard(item.expiresAt)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* أزرار الإجراءات للموزع (بدون حذف إطلاقاً) */}
                  <View style={styles.codeActions}>
                    <Pressable
                      style={styles.actionBtnSmall}
                      onPress={() => handleUpdateCode(item.code, { addDays: 30 })}
                      disabled={actionLoading === item.code}
                    >
                      <MaterialIcons name="add-alarm" size={14} color="#38bdf8" />
                      <Text style={styles.actionBtnSmallText}>+30 يوم</Text>
                    </Pressable>

                    {item.status === 'suspended' ? (
                      <Pressable
                        style={[styles.actionBtnSmall, { borderColor: '#10b981' }]}
                        onPress={() => handleUpdateCode(item.code, { status: 'active' })}
                        disabled={actionLoading === item.code}
                      >
                        <MaterialIcons name="play-arrow" size={14} color="#10b981" />
                        <Text style={[styles.actionBtnSmallText, { color: '#10b981' }]}>
                          تفعيل
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[styles.actionBtnSmall, { borderColor: '#ef4444' }]}
                        onPress={() => handleUpdateCode(item.code, { status: 'suspended' })}
                        disabled={actionLoading === item.code}
                      >
                        <MaterialIcons name="pause" size={14} color="#ef4444" />
                        <Text style={[styles.actionBtnSmallText, { color: '#ef4444' }]}>
                          إيقاف
                        </Text>
                      </Pressable>
                    )}

                    <Pressable
                      style={styles.actionBtnSmall}
                      onPress={() => {
                        setEditingCode(item);
                        setEditNoteValue(item.note || '');
                      }}
                      disabled={actionLoading === item.code}
                    >
                      <MaterialIcons name="edit-note" size={14} color="#e2e8f0" />
                      <Text style={styles.actionBtnSmallText}>تعديل الملاحظة</Text>
                    </Pressable>

                    <Pressable
                      style={styles.actionBtnSmall}
                      onPress={() => handleUpdateCode(item.code, { resetDevices: true })}
                      disabled={actionLoading === item.code}
                    >
                      <MaterialIcons name="device-reset" size={14} color="#f59e0b" />
                      <Text style={[styles.actionBtnSmallText, { color: '#f59e0b' }]}>
                        تصفير الأجهزة
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* مودال تعديل ملاحظة الكود */}
      <Modal visible={!!editingCode} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons name="edit" size={22} color="#38bdf8" />
                <Text style={styles.modalTitle}>تعديل ملاحظة الكود</Text>
              </View>
              <Pressable onPress={() => setEditingCode(null)}>
                <MaterialIcons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <Text style={{ color: '#cbd5e1', marginBottom: 12, fontSize: 13 }}>
              الكود: <Text style={{ color: '#ffffff', fontWeight: '800' }}>{editingCode?.code}</Text>
            </Text>

            <TextInput
              style={styles.modalInput}
              value={editNoteValue}
              onChangeText={setEditNoteValue}
              placeholder="اكتب ملاحظة أو اسم العميل الجديد..."
              placeholderTextColor="#64748b"
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setEditingCode(null)}>
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable
                style={styles.modalConfirmBtn}
                onPress={async () => {
                  if (editingCode) {
                    await handleUpdateCode(editingCode.code, { note: editNoteValue.trim() });
                    setEditingCode(null);
                  }
                }}
              >
                <Text style={styles.modalConfirmBtnText}>حفظ الملاحظة</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 64,
  },

  // شاشة تسجيل الدخول
  loginContainer: {
    flex: 1,
    backgroundColor: '#0B1120',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#131C31',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.25)',
    alignItems: 'center',
  },
  loginIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  loginSub: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  loginInputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 50,
  },
  loginInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingHorizontal: 10,
    textAlign: 'right',
  },
  loginButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  loginButtonText: {
    color: '#070b14',
    fontSize: 16,
    fontWeight: '700',
  },
  backToHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  backToHomeText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  errorBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },

  // الشريط العلوي
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerTitleRow: {
    alignItems: 'flex-start',
    gap: 4,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  headerBadgeText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  headerMainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubUsername: {
    fontSize: 13,
    color: '#94a3b8',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },

  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.25)',
  },
  statusBarText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },

  // شبكة الإحصائيات
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    borderTopWidth: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statLabel: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
    textAlign: 'right',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'right',
  },

  // نموذج التوليد
  cardSection: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  formGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  formGridCol: {
    flexDirection: 'column',
    gap: 14,
  },
  formGroup: {
    flex: 1,
    minWidth: 260,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
    textAlign: 'right',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ownerAutoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  ownerAutoBadgeText: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '700',
  },
  autoTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 4,
  },
  autoTagText: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: '600',
  },
  selectorPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectorPillSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectorPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  selectorPillText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  selectorPillTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 44,
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'right',
  },
  generateButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    height: 48,
    marginTop: 8,
  },
  generateButtonText: {
    color: '#070b14',
    fontSize: 15,
    fontWeight: '800',
  },

  // دفعة الأكواد
  batchContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  batchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38bdf8',
    marginBottom: 10,
    textAlign: 'right',
  },
  batchList: {
    gap: 8,
  },
  batchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
  },
  batchCodeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1.5,
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  copyPillSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  copyPillText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  copyPillTextSuccess: {
    color: '#10b981',
  },

  // الفلاتر
  filterSection: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingHorizontal: 8,
    textAlign: 'right',
  },
  statusTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusTabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  statusTabPillActive: {
    backgroundColor: '#38bdf8',
  },
  statusTabPillText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  statusTabPillTextActive: {
    color: '#070b14',
    fontWeight: '800',
  },

  // شبكة الأكواد
  codesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  codeCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  codeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  codeTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeTypeBadgeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  codeMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  codeValueText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  copyIconBtnSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  codeDetails: {
    gap: 6,
    marginBottom: 14,
    direction: 'rtl',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    direction: 'rtl',
    justifyContent: 'flex-start',
  },
  detailLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  detailVal: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  remainingVal: {
    fontSize: 12,
    color: '#34d399',
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  codeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 12,
  },
  actionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionBtnSmallText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },

  // المودال
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    height: 44,
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  modalCancelBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#38bdf8',
  },
  modalConfirmBtnText: {
    color: '#070b14',
    fontSize: 14,
    fontWeight: '800',
  },

  // عام
  loadingBox: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  emptyBox: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 15,
  },
});
