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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BACKEND_BASE_URL } from '../../context/AuthContext';
import {
  DEFAULT_NETWORKS,
  ChannelNetwork,
  getStoredCustomNetworks,
  saveCustomNetworks,
} from '../../config/networks';

interface SubscriptionCode {
  id: number;
  code: string;
  resellerId?: number | null;
  resellerName?: string | null;
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

interface ResellerStats {
  total: number;
  active: number;
  unused: number;
  suspended: number;
  expired: number;
  activated: number;
}

interface Reseller {
  id: number;
  name: string;
  username: string;
  email?: string | null;
  status: 'active' | 'suspended';
  note: string;
  createdAt: string;
  stats: ResellerStats;
}

interface Stats {
  total: number;
  active: number;
  unused: number;
  expired: number;
  suspended: number;
}

const ADMIN_TOKEN_KEY = 'iptv_admin_token';
const ADMIN_STORAGE_KEY = 'iptv_admin_key';

export default function AdminScreen(): React.JSX.Element {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 960;

  // المصادقة
  const [adminToken, setAdminToken] = useState<string>('');
  const [adminKey, setAdminKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [identifierInput, setIdentifierInput] = useState<string>('admin');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // التنقل بين التبويبات الرئيسية
  const [activeTab, setActiveTab] = useState<'codes' | 'resellers' | 'networks'>('codes');

  // إدارة سلاسل وباقات القنوات المخصصة
  const [customNetworks, setCustomNetworks] = useState<ChannelNetwork[]>([]);
  const [showAddNetworkModal, setShowAddNetworkModal] = useState<boolean>(false);
  const [newNetworkName, setNewNetworkName] = useState<string>('');
  const [newNetworkKeywords, setNewNetworkKeywords] = useState<string>('');
  const [newNetworkDesc, setNewNetworkDesc] = useState<string>('');

  // بيانات الأكواد
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

  // بيانات الموزعين
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [resellersLoading, setResellersLoading] = useState<boolean>(false);

  // فلاتر الأكواد
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'unused' | 'expired' | 'suspended'>('all');
  const [filterReseller, setFilterReseller] = useState<string>('all'); // 'all' | 'admin' | string(id)
  const [searchQuery, setSearchQuery] = useState<string>('');

  // نموذج توليد الأكواد
  const [genDuration, setGenDuration] = useState<number>(30);
  const [genMaxDevices, setGenMaxDevices] = useState<number>(1);
  const [genCount, setGenCount] = useState<number>(1);
  const [genNote, setGenNote] = useState<string>('');
  const [genTargetReseller, setGenTargetReseller] = useState<string>('admin');
  const [generatedBatch, setGeneratedBatch] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // نوافذ المودال للموزعين
  const [showAddResellerModal, setShowAddResellerModal] = useState<boolean>(false);
  const [showEditResellerModal, setShowEditResellerModal] = useState<boolean>(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);

  // حقول إضافة موزع جديد
  const [newResellerName, setNewResellerName] = useState<string>('');
  const [newResellerUsername, setNewResellerUsername] = useState<string>('');
  const [newResellerEmail, setNewResellerEmail] = useState<string>('');
  const [newResellerPassword, setNewResellerPassword] = useState<string>('');
  const [newResellerNote, setNewResellerNote] = useState<string>('');
  const [newResellerModalError, setNewResellerModalError] = useState<string | null>(null);

  // حقول تعديل موزع
  const [editResellerName, setEditResellerName] = useState<string>('');
  const [editResellerUsername, setEditResellerUsername] = useState<string>('');
  const [editResellerEmail, setEditResellerEmail] = useState<string>('');
  const [editResellerPassword, setEditResellerPassword] = useState<string>('');
  const [editResellerNote, setEditResellerNote] = useState<string>('');
  const [editResellerStatus, setEditResellerStatus] = useState<'active' | 'suspended'>('active');
  const [editResellerModalError, setEditResellerModalError] = useState<string | null>(null);

  // رؤوس الطلبات للمصادقة
  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    if (adminKey) {
      headers['X-Admin-Key'] = adminKey;
    }
    return headers;
  }, [adminToken, adminKey]);

  // استرجاع الجلسة المحفوظة عند التحميل
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const savedToken = window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
      const savedKey = window.sessionStorage.getItem(ADMIN_STORAGE_KEY);
      if (savedToken) {
        setAdminToken(savedToken);
        setIsAuthenticated(true);
      } else if (savedKey) {
        setAdminKey(savedKey);
        setIsAuthenticated(true);
      }
    }
  }, []);

  // جلب الأكواد
  const fetchCodes = useCallback(
    async (resellerParam?: string) => {
      if (!adminToken && !adminKey) return;
      setIsLoading(true);

      const targetReseller = resellerParam !== undefined ? resellerParam : filterReseller;
      const url = `${BACKEND_BASE_URL}/api/admin/codes?resellerId=${encodeURIComponent(targetReseller)}`;

      try {
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (res.status === 401) {
          setIsAuthenticated(false);
          setAuthError('انتهت صلاحية جلسة الإدارة، يرجى إعادة تسجيل الدخول');
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            window.sessionStorage.removeItem(ADMIN_STORAGE_KEY);
          }
          return;
        }

        const data = await res.json();
        if (res.ok) {
          setStats(data.stats || { total: 0, active: 0, unused: 0, expired: 0, suspended: 0 });
          setCodes(data.codes || []);
        }
      } catch {
        setStatusMessage('تعذر جلب الأكواد من الخادم');
      } finally {
        setIsLoading(false);
      }
    },
    [adminToken, adminKey, filterReseller, getAuthHeaders]
  );

  // جلب الموزعين
  const fetchResellers = useCallback(async () => {
    if (!adminToken && !adminKey) return;
    setResellersLoading(true);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/resellers`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        setResellers(data.resellers || []);
      }
    } catch {
      setStatusMessage('تعذر جلب قائمة الموزعين');
    } finally {
      setResellersLoading(false);
    }
  }, [adminToken, adminKey, getAuthHeaders]);

  // تحديث البيانات عند تسجيل الدخول أو تغيير التبويب
  useEffect(() => {
    getStoredCustomNetworks().then((nets) => {
      if (nets) setCustomNetworks(nets);
    });
  }, []);

  const handleCreateCustomNetwork = async () => {
    if (!newNetworkName.trim() || !newNetworkKeywords.trim()) {
      setStatusMessage('يرجى إدخال اسم الباقة والكلمات المفتاحية');
      return;
    }
    const keywords = newNetworkKeywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const newNet: ChannelNetwork = {
      id: `custom-${Date.now()}`,
      name: newNetworkName.trim(),
      keywords,
      description: newNetworkDesc.trim() || 'باقة مخصصة مضافة من لوحة الإدارة',
      icon: 'hub',
      isCustom: true,
    };

    const updated = [...customNetworks, newNet];
    setCustomNetworks(updated);
    await saveCustomNetworks(updated);

    setNewNetworkName('');
    setNewNetworkKeywords('');
    setNewNetworkDesc('');
    setShowAddNetworkModal(false);
    setStatusMessage(`تمت إضافة "${newNet.name}" بنجاح!`);
  };

  const handleDeleteCustomNetwork = async (id: string) => {
    const updated = customNetworks.filter((n) => n.id !== id);
    setCustomNetworks(updated);
    await saveCustomNetworks(updated);
    setStatusMessage('تم حذف الباقة بنجاح');
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'codes') {
        fetchCodes();
        fetchResellers(); // لجلب أسماء الموزعين في قائمة الاختيار
      } else if (activeTab === 'resellers') {
        fetchResellers();
      }
    }
  }, [isAuthenticated, activeTab, fetchCodes, fetchResellers]);

  // تسجيل الدخول للإدارة
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
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: ident, password: pass }),
      });

      const data = await res.json();
      if (res.ok && data.token) {
        setAdminToken(data.token);
        setIsAuthenticated(true);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        }
      } else {
        // فحص التوافق العكسي إذا كان المستخدم يدخل مفتاح ADMIN_SECRET القديم
        const fallbackRes = await fetch(`${BACKEND_BASE_URL}/api/admin/codes`, {
          headers: { 'X-Admin-Key': pass || ident },
        });
        if (fallbackRes.ok) {
          setAdminKey(pass || ident);
          setIsAuthenticated(true);
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.sessionStorage.setItem(ADMIN_STORAGE_KEY, pass || ident);
          }
        } else {
          setAuthError(data.error || 'فشل تسجيل الدخول: بيانات غير صحيحة');
        }
      }
    } catch {
      setAuthError('تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminToken('');
    setAdminKey('');
    setPasswordInput('');
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      window.sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    }
  };

  // توليد الأكواد
  const handleGenerateCodes = async () => {
    setActionLoading('generate');
    setStatusMessage(null);
    setGeneratedBatch([]);

    try {
      const targetResellerId =
        genTargetReseller === 'admin' ? null : parseInt(genTargetReseller, 10) || null;

      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/codes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          durationDays: genDuration,
          maxDevices: genMaxDevices,
          count: genCount,
          note: genNote.trim(),
          resellerId: targetResellerId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedBatch(data.codes || []);
        setStatusMessage(`تم توليد ${data.count} كود بنجاح!`);
        setGenNote('');
        fetchCodes();
        fetchResellers();
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

  // إجراءات تعديل كود
  const handleUpdateCode = async (
    code: string,
    payload: { status?: string; addDays?: number; resetDevices?: boolean; resellerId?: number | null }
  ) => {
    setActionLoading(code);
    setStatusMessage(null);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/codes/${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(data.message || 'تم تحديث الكود بنجاح');
        fetchCodes();
        fetchResellers();
      } else {
        setStatusMessage(data.error || 'فشل تحديث الكود');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء التحديث');
    } finally {
      setActionLoading(null);
    }
  };

  // حذف كود نهائياً
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
        headers: getAuthHeaders(),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage('تم حذف الكود بنجاح');
        fetchCodes();
        fetchResellers();
      } else {
        setStatusMessage(data.error || 'فشل حذف الكود');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء الحذف');
    } finally {
      setActionLoading(null);
    }
  };

  // إنشاء موزع جديد
  const handleCreateResellerSubmit = async () => {
    if (!newResellerName.trim() || !newResellerUsername.trim() || !newResellerPassword.trim()) {
      setNewResellerModalError('يرجى ملء الاسم واسم المستخدم وكلمة المرور');
      return;
    }
    if (newResellerPassword.length < 6) {
      setNewResellerModalError('كلمة المرور يجب أن لا تقل عن 6 أحرف');
      return;
    }

    setActionLoading('create_reseller');
    setNewResellerModalError(null);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/resellers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newResellerName.trim(),
          username: newResellerUsername.trim(),
          email: newResellerEmail.trim() || null,
          password: newResellerPassword.trim(),
          note: newResellerNote.trim(),
          status: 'active',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowAddResellerModal(false);
        setNewResellerName('');
        setNewResellerUsername('');
        setNewResellerEmail('');
        setNewResellerPassword('');
        setNewResellerNote('');
        setStatusMessage('تم إنشاء حساب الموزع بنجاح');
        fetchResellers();
      } else {
        setNewResellerModalError(data.error || 'فشل إنشاء الموزع');
      }
    } catch {
      setNewResellerModalError('حدث خطأ أثناء إنشاء حساب الموزع');
    } finally {
      setActionLoading(null);
    }
  };

  // حفظ تعديلات موزع
  const handleEditResellerSubmit = async () => {
    if (!editingReseller) return;
    if (!editResellerName.trim() || !editResellerUsername.trim()) {
      setEditResellerModalError('يرجى إدخال اسم الموزع واسم المستخدم');
      return;
    }

    setActionLoading('edit_reseller');
    setEditResellerModalError(null);

    try {
      const payload: any = {
        name: editResellerName.trim(),
        username: editResellerUsername.trim(),
        email: editResellerEmail.trim() || null,
        note: editResellerNote.trim(),
        status: editResellerStatus,
      };

      if (editResellerPassword.trim().length >= 6) {
        payload.password = editResellerPassword.trim();
      }

      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/resellers/${editingReseller.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowEditResellerModal(false);
        setEditingReseller(null);
        setStatusMessage('تم تحديث بيانات الموزع بنجاح');
        fetchResellers();
      } else {
        setEditResellerModalError(data.error || 'فشل تحديث بيانات الموزع');
      }
    } catch {
      setEditResellerModalError('حدث خطأ أثناء تحديث الموزع');
    } finally {
      setActionLoading(null);
    }
  };

  // تبديل حالة الموزع (نشط / موقوف)
  const handleToggleResellerStatus = async (reseller: Reseller) => {
    const newStatus = reseller.status === 'active' ? 'suspended' : 'active';
    const actionText = newStatus === 'suspended' ? 'إيقاف' : 'تفعيل';

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm(`هل أنت متأكد من ${actionText} حساب الموزع ${reseller.name}؟`);
      if (!confirmed) return;
    }

    setActionLoading(`toggle_reseller_${reseller.id}`);
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/admin/resellers/${reseller.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage(`تم ${actionText} حساب الموزع بنجاح`);
        fetchResellers();
      } else {
        setStatusMessage(data.error || 'فشل تغيير حالة الموزع');
      }
    } catch {
      setStatusMessage('حدث خطأ أثناء تعديل الحالة');
    } finally {
      setActionLoading(null);
    }
  };

  // تصفية الأكواد محلياً بالبحث والحالة
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
          (c.note && c.note.toLowerCase().includes(q)) ||
          (c.resellerName && c.resellerName.toLowerCase().includes(q))
      );
    }
    return result;
  }, [codes, filterStatus, searchQuery]);

  // الانتقال للأكواد مفلترة بموزع معين
  const viewResellerCodes = (resellerId: number) => {
    setFilterReseller(String(resellerId));
    setActiveTab('codes');
    fetchCodes(String(resellerId));
  };

  // ==========================================
  // شاشة تسجيل دخول المشرف
  // ==========================================
  if (!isAuthenticated) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.loginCard}>
          <View style={styles.loginIconCircle}>
            <MaterialIcons name="admin-panel-settings" size={44} color="#f59e0b" />
          </View>
          <Text style={styles.loginTitle}>لوحة إدارة المنصة</Text>
          <Text style={styles.loginSub}>
            إدارة الاشتراكات وأكواد التفعيل وشبكة الموزعين المعتمدين.
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
                <Text style={styles.loginButtonText}>تسجيل الدخول للإدارة</Text>
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
  // الشاشة الرئيسية للوحة الإدارة
  // ==========================================
  return (
    <View style={styles.container}>
      {/* الشريط العلوي */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerBadge}>
            <MaterialIcons name="verified-user" size={18} color="#f59e0b" />
            <Text style={styles.headerBadgeText}>لوحة تحكم المدير العام</Text>
          </View>
          <Text style={styles.headerMainTitle}>نظام إدارة المنصة والموزعين</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.refreshBtn}
            onPress={() => {
              if (activeTab === 'codes') fetchCodes();
              else fetchResellers();
            }}
          >
            <MaterialIcons name="refresh" size={18} color="#38bdf8" />
            <Text style={styles.refreshBtnText}>تحديث</Text>
          </Pressable>

          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialIcons name="logout" size={18} color="#ef4444" />
            <Text style={styles.logoutBtnText}>خروج</Text>
          </Pressable>
        </View>
      </View>

      {/* تبويبات التنقل الرئيسية */}
      <View style={styles.mainNavTabs}>
        <Pressable
          style={[styles.mainNavTab, activeTab === 'codes' && styles.mainNavTabActive]}
          onPress={() => setActiveTab('codes')}
        >
          <MaterialIcons
            name="vpn-key"
            size={20}
            color={activeTab === 'codes' ? '#38bdf8' : '#94a3b8'}
          />
          <Text
            style={[styles.mainNavTabText, activeTab === 'codes' && styles.mainNavTabTextActive]}
          >
            الأكواد والاشتراكات ({stats.total})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.mainNavTab, activeTab === 'resellers' && styles.mainNavTabActive]}
          onPress={() => setActiveTab('resellers')}
        >
          <MaterialIcons
            name="group"
            size={20}
            color={activeTab === 'resellers' ? '#f59e0b' : '#94a3b8'}
          />
          <Text
            style={[
              styles.mainNavTabText,
              activeTab === 'resellers' && styles.mainNavTabTextActive,
            ]}
          >
            شبكة الموزعين ({resellers.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.mainNavTab, activeTab === 'networks' && styles.mainNavTabActive]}
          onPress={() => setActiveTab('networks')}
        >
          <MaterialIcons
            name="hub"
            size={20}
            color={activeTab === 'networks' ? '#a855f7' : '#94a3b8'}
          />
          <Text
            style={[
              styles.mainNavTabText,
              activeTab === 'networks' && styles.mainNavTabTextActive,
            ]}
          >
            سلاسل وباقات القنوات ({DEFAULT_NETWORKS.length + customNetworks.length})
          </Text>
        </Pressable>
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

      {/* محتوى التبويب */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'codes' ? (
          <>
            {/* بطاقات الإحصائيات العامة للأكواد */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { borderTopColor: '#38bdf8' }]}>
                <Text style={styles.statLabel}>إجمالي الأكواد</Text>
                <Text style={[styles.statValue, { color: '#38bdf8' }]}>{stats.total}</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#10b981' }]}>
                <Text style={styles.statLabel}>اشتراكات جارية</Text>
                <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.active}</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#f59e0b' }]}>
                <Text style={styles.statLabel}>أكواد جديدة غير مستخدمة</Text>
                <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.unused}</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#64748b' }]}>
                <Text style={styles.statLabel}>اشتراكات منتهية</Text>
                <Text style={[styles.statValue, { color: '#64748b' }]}>{stats.expired}</Text>
              </View>
              <View style={[styles.statCard, { borderTopColor: '#ef4444' }]}>
                <Text style={styles.statLabel}>موقوفة إدارياً</Text>
                <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.suspended}</Text>
              </View>
            </View>

            {/* نموذج توليد أكواد جديدة */}
            <View style={styles.cardSection}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="add-circle-outline" size={22} color="#38bdf8" />
                <Text style={styles.cardTitle}>توليد أكواد اشتراك جديدة</Text>
              </View>

              <View style={isWide ? styles.formGridWide : styles.formGridCol}>
                {/* الجهة المالكة للكود */}
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>الجهة المالكة للكود:</Text>
                  <View style={styles.pillsRow}>
                    <Pressable
                      style={[
                        styles.selectorPill,
                        genTargetReseller === 'admin' && styles.selectorPillActive,
                      ]}
                      onPress={() => setGenTargetReseller('admin')}
                    >
                      <Text
                        style={[
                          styles.selectorPillText,
                          genTargetReseller === 'admin' && styles.selectorPillTextActive,
                        ]}
                      >
                        الإدارة المباشرة
                      </Text>
                    </Pressable>
                    {resellers.map((r) => (
                      <Pressable
                        key={r.id}
                        style={[
                          styles.selectorPill,
                          genTargetReseller === String(r.id) && styles.selectorPillActive,
                        ]}
                        onPress={() => setGenTargetReseller(String(r.id))}
                      >
                        <Text
                          style={[
                            styles.selectorPillText,
                            genTargetReseller === String(r.id) && styles.selectorPillTextActive,
                          ]}
                        >
                          {r.name}
                        </Text>
                      </Pressable>
                    ))}
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
                    {[1, 5, 10, 20, 50].map((num) => (
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
                  <Text style={styles.inputLabel}>ملاحظة / اسم المشترك (اختياري):</Text>
                  <TextInput
                    style={styles.textInput}
                    value={genNote}
                    onChangeText={setGenNote}
                    placeholder="مثال: اشتراك عائلي - أو اسم العميل"
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

              {/* الأكواد المولدة حديثاً */}
              {generatedBatch.length > 0 && (
                <View style={styles.batchContainer}>
                  <Text style={styles.batchTitle}>
                    الأكواد التي تم توليدها حديثاً ({generatedBatch.length}):
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
              {/* فلتر الموزع */}
              <View style={styles.resellerFilterBar}>
                <Text style={styles.filterHeaderLabel}>عرض أكواد:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Pressable
                    style={[
                      styles.resellerPill,
                      filterReseller === 'all' && styles.resellerPillActive,
                    ]}
                    onPress={() => {
                      setFilterReseller('all');
                      fetchCodes('all');
                    }}
                  >
                    <Text
                      style={[
                        styles.resellerPillText,
                        filterReseller === 'all' && styles.resellerPillTextActive,
                      ]}
                    >
                      كافة الأكواد
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.resellerPill,
                      filterReseller === 'admin' && styles.resellerPillActive,
                    ]}
                    onPress={() => {
                      setFilterReseller('admin');
                      fetchCodes('admin');
                    }}
                  >
                    <Text
                      style={[
                        styles.resellerPillText,
                        filterReseller === 'admin' && styles.resellerPillTextActive,
                      ]}
                    >
                      أكواد الإدارة فقط
                    </Text>
                  </Pressable>
                  {resellers.map((r) => (
                    <Pressable
                      key={r.id}
                      style={[
                        styles.resellerPill,
                        filterReseller === String(r.id) && styles.resellerPillActive,
                      ]}
                      onPress={() => {
                        setFilterReseller(String(r.id));
                        fetchCodes(String(r.id));
                      }}
                    >
                      <Text
                        style={[
                          styles.resellerPillText,
                          filterReseller === String(r.id) && styles.resellerPillTextActive,
                        ]}
                      >
                        {r.name} ({r.stats?.total || 0})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* شريط البحث */}
              <View style={styles.searchBar}>
                <MaterialIcons name="search" size={20} color="#94a3b8" />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="ابحث عن كود، ملاحظة، أو اسم موزع..."
                  placeholderTextColor="#64748b"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <MaterialIcons name="close" size={18} color="#94a3b8" />
                  </Pressable>
                )}
              </View>

              {/* تبويبات حالة الكود */}
              <View style={styles.statusTabs}>
                {[
                  { key: 'all', label: 'الكل' },
                  { key: 'active', label: 'جارية' },
                  { key: 'unused', label: 'غير مستخدمة' },
                  { key: 'expired', label: 'منتهية' },
                  { key: 'suspended', label: 'موقوفة' },
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
                <Text style={styles.loadingText}>جاري جلب الأكواد...</Text>
              </View>
            ) : filteredCodes.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons name="inbox" size={48} color="#475569" />
                <Text style={styles.emptyText}>لا توجد أكواد مطابقة لخيارات البحث الحالية</Text>
              </View>
            ) : (
              <View style={styles.codesGrid}>
                {filteredCodes.map((item) => {
                  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                    active: { bg: '#064e3b', text: '#34d399', label: 'نشط وجاري' },
                    unused: { bg: '#451a03', text: '#fbbf24', label: 'غير مستخدم' },
                    expired: { bg: '#1e293b', text: '#94a3b8', label: 'منتهي' },
                    suspended: { bg: '#450a0a', text: '#f87171', label: 'موقوف' },
                  };
                  const curStatus = statusColors[item.status] || statusColors.unused;

                  return (
                    <View key={item.id} style={styles.codeCard}>
                      <View style={styles.codeCardTop}>
                        {/* الموزع المالك */}
                        <View style={styles.ownerBadge}>
                          <MaterialIcons
                            name={item.resellerName ? 'store' : 'admin-panel-settings'}
                            size={14}
                            color={item.resellerName ? '#f59e0b' : '#38bdf8'}
                          />
                          <Text
                            style={[
                              styles.ownerBadgeText,
                              { color: item.resellerName ? '#f59e0b' : '#38bdf8' },
                            ]}
                          >
                            {item.resellerName ? `الموزع: ${item.resellerName}` : 'الإدارة'}
                          </Text>
                        </View>

                        {/* شارة الحالة */}
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
                              (متبقي {item.remainingDays} يوم)
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
                              {new Date(item.expiresAt).toLocaleDateString('ar-EG')}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* أزرار الإجراءات السريعة */}
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
                          onPress={() => handleUpdateCode(item.code, { resetDevices: true })}
                          disabled={actionLoading === item.code}
                        >
                          <MaterialIcons name="device-reset" size={14} color="#f59e0b" />
                          <Text style={[styles.actionBtnSmallText, { color: '#f59e0b' }]}>
                            تصفير الأجهزة
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[styles.actionBtnSmall, { borderColor: '#b91c1c' }]}
                          onPress={() => handleDeleteCode(item.code)}
                          disabled={actionLoading === item.code}
                        >
                          <MaterialIcons name="delete" size={14} color="#f87171" />
                          <Text style={[styles.actionBtnSmallText, { color: '#f87171' }]}>حذف</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : activeTab === 'resellers' ? (
          /* ==========================================
             تبويب شبكة الموزعين (Resellers)
             ========================================== */
          <View style={styles.resellersTabContainer}>
            <View style={styles.resellersHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>الموزعون والوكلاء المعتمدون</Text>
                <Text style={styles.sectionHeaderSub}>
                  إدارة صلاحيات الموزعين ومتابعة مبيعاتهم واستهلاك الأكواد لكل موزع لحظياً.
                </Text>
              </View>

              <Pressable
                style={styles.addResellerBtn}
                onPress={() => {
                  setNewResellerModalError(null);
                  setShowAddResellerModal(true);
                }}
              >
                <MaterialIcons name="person-add" size={20} color="#070b14" />
                <Text style={styles.addResellerBtnText}>إضافة موزع جديد</Text>
              </Pressable>
            </View>

            {resellersLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#f59e0b" />
                <Text style={styles.loadingText}>جاري تحميل شبكة الموزعين...</Text>
              </View>
            ) : resellers.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons name="group-off" size={48} color="#475569" />
                <Text style={styles.emptyText}>لم يتم إضافة أي موزع حتى الآن</Text>
                <Pressable
                  style={[styles.addResellerBtn, { marginTop: 16 }]}
                  onPress={() => setShowAddResellerModal(true)}
                >
                  <MaterialIcons name="person-add" size={20} color="#070b14" />
                  <Text style={styles.addResellerBtnText}>إضافة أول موزع</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.resellersGrid}>
                {resellers.map((r) => {
                  const isActive = r.status === 'active';
                  return (
                    <View key={r.id} style={styles.resellerCard}>
                      <View style={styles.resellerCardHeader}>
                        <View style={styles.resellerAvatar}>
                          <MaterialIcons name="storefront" size={28} color="#f59e0b" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.resellerNameRow}>
                            <Text style={styles.resellerNameText}>{r.name}</Text>
                            <View
                              style={[
                                styles.resellerStatusBadge,
                                { backgroundColor: isActive ? '#064e3b' : '#450a0a' },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.resellerStatusText,
                                  { color: isActive ? '#34d399' : '#f87171' },
                                ]}
                              >
                                {isActive ? 'نشط' : 'موقوف'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.resellerUsernameText}>@{r.username}</Text>
                          {r.email && <Text style={styles.resellerEmailText}>{r.email}</Text>}
                        </View>
                      </View>

                      {r.note ? (
                        <View style={styles.resellerNoteBox}>
                          <MaterialIcons name="info-outline" size={16} color="#94a3b8" />
                          <Text style={styles.resellerNoteText}>{r.note}</Text>
                        </View>
                      ) : null}

                      {/* إحصائيات الموزع */}
                      <View style={styles.resellerStatsBox}>
                        <View style={styles.resellerStatItem}>
                          <Text style={styles.resellerStatVal}>{r.stats?.total || 0}</Text>
                          <Text style={styles.resellerStatLbl}>إجمالي الأكواد</Text>
                        </View>
                        <View style={styles.resellerStatItem}>
                          <Text style={[styles.resellerStatVal, { color: '#10b981' }]}>
                            {r.stats?.active || 0}
                          </Text>
                          <Text style={styles.resellerStatLbl}>جارية</Text>
                        </View>
                        <View style={styles.resellerStatItem}>
                          <Text style={[styles.resellerStatVal, { color: '#fbbf24' }]}>
                            {r.stats?.unused || 0}
                          </Text>
                          <Text style={styles.resellerStatLbl}>غير مستخدمة</Text>
                        </View>
                        <View style={styles.resellerStatItem}>
                          <Text style={[styles.resellerStatVal, { color: '#94a3b8' }]}>
                            {r.stats?.expired || 0}
                          </Text>
                          <Text style={styles.resellerStatLbl}>منتهية</Text>
                        </View>
                        <View style={styles.resellerStatItem}>
                          <Text style={[styles.resellerStatVal, { color: '#f87171' }]}>
                            {r.stats?.suspended || 0}
                          </Text>
                          <Text style={styles.resellerStatLbl}>موقوفة</Text>
                        </View>
                      </View>

                      {/* أزرار الإجراءات على الموزع */}
                      <View style={styles.resellerActionsRow}>
                        <Pressable
                          style={styles.resellerActionBtnPrimary}
                          onPress={() => viewResellerCodes(r.id)}
                        >
                          <MaterialIcons name="list-alt" size={16} color="#38bdf8" />
                          <Text style={styles.resellerActionBtnPrimaryText}>عرض الأكواد</Text>
                        </Pressable>

                        <Pressable
                          style={styles.resellerActionBtnSecondary}
                          onPress={() => {
                            setEditingReseller(r);
                            setEditResellerName(r.name);
                            setEditResellerUsername(r.username);
                            setEditResellerEmail(r.email || '');
                            setEditResellerPassword('');
                            setEditResellerNote(r.note || '');
                            setEditResellerStatus(r.status);
                            setEditResellerModalError(null);
                            setShowEditResellerModal(true);
                          }}
                        >
                          <MaterialIcons name="edit" size={16} color="#e2e8f0" />
                          <Text style={styles.resellerActionBtnSecondaryText}>تعديل البيانات</Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.resellerActionBtnSecondary,
                            { borderColor: isActive ? '#ef4444' : '#10b981' },
                          ]}
                          onPress={() => handleToggleResellerStatus(r)}
                        >
                          <MaterialIcons
                            name={isActive ? 'block' : 'check-circle'}
                            size={16}
                            color={isActive ? '#f87171' : '#34d399'}
                          />
                          <Text
                            style={[
                              styles.resellerActionBtnSecondaryText,
                              { color: isActive ? '#f87171' : '#34d399' },
                            ]}
                          >
                            {isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          /* ==========================================
             تبويب سلاسل وباقات القنوات (Networks)
             ========================================== */
          <View style={styles.resellersTabContainer}>
            <View style={styles.resellersHeaderRow}>
              <View>
                <Text style={styles.sectionHeaderTitle}>سلاسل وباقات القنوات (Networks)</Text>
                <Text style={styles.sectionHeaderSub}>
                  إدارة وتخصيص باقات وسلاسل القنوات التي تظهر في قسم الأقسام (مثل MBC، روتانا، beIN، SSC، إلخ).
                </Text>
              </View>

              <Pressable
                style={[styles.primaryActionBtn, { backgroundColor: '#a855f7' }]}
                onPress={() => setShowAddNetworkModal(true)}
              >
                <MaterialIcons name="add-circle" size={20} color="#ffffff" />
                <Text style={styles.primaryActionBtnText}>إضافة باقة / قسم مخصص</Text>
              </Pressable>
            </View>

            {/* عرض الباقات المخصصة إن وجدت */}
            {customNetworks.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={[
                    styles.sectionHeaderTitle,
                    { fontSize: 18, color: '#c084fc', marginBottom: 12 },
                  ]}
                >
                  الباقات المخصصة المضافة حديثاً ({customNetworks.length})
                </Text>
                <View style={styles.resellersGrid}>
                  {customNetworks.map((net) => (
                    <View
                      key={net.id}
                      style={[styles.resellerCard, { borderColor: '#a855f7' }]}
                    >
                      <View style={styles.resellerCardHeader}>
                        <View style={styles.resellerInfo}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <MaterialIcons name="hub" size={22} color="#c084fc" />
                            <Text style={styles.resellerName}>{net.name}</Text>
                          </View>
                          <Text style={styles.resellerUsername}>
                            {net.description}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: '#a855f720' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              { color: '#c084fc' },
                            ]}
                          >
                            باقة مخصصة
                          </Text>
                        </View>
                      </View>

                      <View
                        style={{
                          marginVertical: 8,
                          padding: 10,
                          backgroundColor: '#070b14',
                          borderRadius: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: '#94a3b8',
                            fontSize: 13,
                            marginBottom: 4,
                          }}
                        >
                          الكلمات المفتاحية للمطابقة:
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 6,
                          }}
                        >
                          {net.keywords.map((kw, i) => (
                            <View
                              key={i}
                              style={{
                                backgroundColor: '#1e293b',
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                              }}
                            >
                              <Text style={{ color: '#e2e8f0', fontSize: 12 }}>
                                {kw}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      <View style={styles.resellerCardActions}>
                        <Pressable
                          style={[
                            styles.resellerActionBtnSecondary,
                            { borderColor: '#ef4444' },
                          ]}
                          onPress={() => handleDeleteCustomNetwork(net.id)}
                        >
                          <MaterialIcons
                            name="delete"
                            size={16}
                            color="#ef4444"
                          />
                          <Text
                            style={[
                              styles.resellerActionBtnSecondaryText,
                              { color: '#ef4444' },
                            ]}
                          >
                            حذف الباقة
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* عرض باقات النظام الأساسية */}
            <Text
              style={[
                styles.sectionHeaderTitle,
                { fontSize: 18, color: '#38bdf8', marginBottom: 12 },
              ]}
            >
              باقات النظام الافتراضية ({DEFAULT_NETWORKS.length})
            </Text>
            <View style={styles.resellersGrid}>
              {DEFAULT_NETWORKS.map((net) => (
                <View key={net.id} style={styles.resellerCard}>
                  <View style={styles.resellerCardHeader}>
                    <View style={styles.resellerInfo}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <MaterialIcons name="tv" size={22} color="#38bdf8" />
                        <Text style={styles.resellerName}>{net.name}</Text>
                      </View>
                      <Text style={styles.resellerUsername}>
                        {net.description}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: '#38bdf820' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: '#38bdf8' },
                        ]}
                      >
                        نظامية
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      marginVertical: 8,
                      padding: 10,
                      backgroundColor: '#070b14',
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: '#94a3b8',
                        fontSize: 13,
                        marginBottom: 4,
                      }}
                    >
                      الكلمات المفتاحية:
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      {net.keywords.map((kw, i) => (
                        <View
                          key={i}
                          style={{
                            backgroundColor: '#1e293b',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                            {kw}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ==========================================
          مودال إضافة موزع جديد
          ========================================== */}
      <Modal visible={showAddResellerModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons name="person-add" size={24} color="#f59e0b" />
                <Text style={styles.modalTitle}>إضافة موزع جديد</Text>
              </View>
              <Pressable onPress={() => setShowAddResellerModal(false)}>
                <MaterialIcons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>اسم الموزع / المحل:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newResellerName}
                  onChangeText={setNewResellerName}
                  placeholder="مثال: موزع الرياض الرقمي"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>اسم المستخدم لتسجيل الدخول:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newResellerUsername}
                  onChangeText={setNewResellerUsername}
                  placeholder="مثال: riyadh_dealer"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>البريد الإلكتروني (اختياري):</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newResellerEmail}
                  onChangeText={setNewResellerEmail}
                  placeholder="dealer@domain.com"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>كلمة المرور (6 أحرف فأكثر):</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newResellerPassword}
                  onChangeText={setNewResellerPassword}
                  placeholder="كلمة مرور الدخول لبوابة الموزع"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>ملاحظات إضافية عن الموزع:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newResellerNote}
                  onChangeText={setNewResellerNote}
                  placeholder="مثال: موزع معتمد في منطقة الرياض، هاتف: 05xxxx"
                  placeholderTextColor="#64748b"
                />
              </View>

              {newResellerModalError && (
                <View style={styles.modalErrorBox}>
                  <MaterialIcons name="error" size={16} color="#ef4444" />
                  <Text style={styles.modalErrorText}>{newResellerModalError}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowAddResellerModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable
                style={styles.modalConfirmBtn}
                onPress={handleCreateResellerSubmit}
                disabled={actionLoading === 'create_reseller'}
              >
                {actionLoading === 'create_reseller' ? (
                  <ActivityIndicator color="#070b14" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>إنشاء الموزع</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          مودال تعديل بيانات موزع
          ========================================== */}
      <Modal visible={showEditResellerModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons name="edit" size={24} color="#38bdf8" />
                <Text style={styles.modalTitle}>تعديل بيانات الموزع</Text>
              </View>
              <Pressable onPress={() => setShowEditResellerModal(false)}>
                <MaterialIcons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>اسم الموزع:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editResellerName}
                  onChangeText={setEditResellerName}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>اسم المستخدم:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editResellerUsername}
                  onChangeText={setEditResellerUsername}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>البريد الإلكتروني:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editResellerEmail}
                  onChangeText={setEditResellerEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية):</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editResellerPassword}
                  onChangeText={setEditResellerPassword}
                  placeholder="أدخل كلمة مرور جديدة للتغيير"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>حالة الحساب:</Text>
                <View style={styles.pillsRow}>
                  <Pressable
                    style={[
                      styles.selectorPill,
                      editResellerStatus === 'active' && styles.selectorPillActive,
                    ]}
                    onPress={() => setEditResellerStatus('active')}
                  >
                    <Text
                      style={[
                        styles.selectorPillText,
                        editResellerStatus === 'active' && styles.selectorPillTextActive,
                      ]}
                    >
                      حساب نشط
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.selectorPill,
                      editResellerStatus === 'suspended' && [
                        styles.selectorPillActive,
                        { borderColor: '#ef4444', backgroundColor: '#450a0a' },
                      ],
                    ]}
                    onPress={() => setEditResellerStatus('suspended')}
                  >
                    <Text
                      style={[
                        styles.selectorPillText,
                        editResellerStatus === 'suspended' && { color: '#f87171' },
                      ]}
                    >
                      حساب موقوف
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>الملاحظات:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editResellerNote}
                  onChangeText={setEditResellerNote}
                />
              </View>

              {editResellerModalError && (
                <View style={styles.modalErrorBox}>
                  <MaterialIcons name="error" size={16} color="#ef4444" />
                  <Text style={styles.modalErrorText}>{editResellerModalError}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowEditResellerModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable
                style={styles.modalConfirmBtn}
                onPress={handleEditResellerSubmit}
                disabled={actionLoading === 'edit_reseller'}
              >
                {actionLoading === 'edit_reseller' ? (
                  <ActivityIndicator color="#070b14" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>حفظ التعديلات</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==========================================
          مودال إضافة باقة أو قسم مخصص
          ========================================== */}
      <Modal visible={showAddNetworkModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialIcons name="hub" size={24} color="#a855f7" />
                <Text style={styles.modalTitle}>إضافة باقة أو قسم مخصص</Text>
              </View>
              <Pressable onPress={() => setShowAddNetworkModal(false)}>
                <MaterialIcons name="close" size={22} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>اسم الباقة (مثال: قنوات SSC الرياضية أو باقة شاهد):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="اسم الباقة..."
                  placeholderTextColor="#64748b"
                  value={newNetworkName}
                  onChangeText={setNewNetworkName}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>
                  الكلمات المفتاحية للمطابقة في اسم القناة (افصل بينها بفاصلة):
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="مثال: ssc, ssc 1, الرياضة السعودية"
                  placeholderTextColor="#64748b"
                  value={newNetworkKeywords}
                  onChangeText={setNewNetworkKeywords}
                />
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>الوصف (اختياري):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="وصف مختصر للباقة..."
                  placeholderTextColor="#64748b"
                  value={newNetworkDesc}
                  onChangeText={setNewNetworkDesc}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setShowAddNetworkModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable
                style={[styles.modalConfirmBtn, { backgroundColor: '#a855f7' }]}
                onPress={handleCreateCustomNetwork}
              >
                <Text style={styles.modalConfirmBtnText}>حفظ وإضافة الباقة</Text>
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
    backgroundColor: '#070b14',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 64,
  },

  // تسجيل الدخول
  loginContainer: {
    flex: 1,
    backgroundColor: '#070b14',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    alignItems: 'center',
  },
  loginIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  headerBadgeText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
  },
  headerMainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
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

  // تبويبات التنقل
  mainNavTabs: {
    flexDirection: 'row',
    backgroundColor: '#0b1120',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingHorizontal: 24,
    gap: 12,
  },
  mainNavTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  mainNavTabActive: {
    borderBottomColor: '#38bdf8',
  },
  mainNavTabText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94a3b8',
  },
  mainNavTabTextActive: {
    color: '#ffffff',
  },

  // شريط الحالة
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

  // قسم النموذج
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
  resellerFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterHeaderLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '700',
  },
  resellerPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  resellerPillActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
  },
  resellerPillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  resellerPillTextActive: {
    color: '#f59e0b',
    fontWeight: '700',
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
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ownerBadgeText: {
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
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  detailVal: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  remainingVal: {
    fontSize: 12,
    color: '#34d399',
    fontWeight: '700',
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

  // تبويب الموزعين
  resellersTabContainer: {
    gap: 20,
  },
  resellersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  sectionHeaderSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  addResellerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addResellerBtnText: {
    color: '#070b14',
    fontSize: 14,
    fontWeight: '800',
  },
  resellersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  resellerCard: {
    flex: 1,
    minWidth: 340,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 14,
  },
  resellerCardHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  resellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resellerNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  resellerStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  resellerStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  resellerUsernameText: {
    fontSize: 13,
    color: '#38bdf8',
    fontWeight: '600',
  },
  resellerEmailText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  resellerNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    padding: 8,
    borderRadius: 8,
  },
  resellerNoteText: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
    textAlign: 'right',
  },
  resellerStatsBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
  },
  resellerStatItem: {
    alignItems: 'center',
  },
  resellerStatVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  resellerStatLbl: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  resellerActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  resellerActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  resellerActionBtnPrimaryText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  resellerActionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  resellerActionBtnSecondaryText: {
    color: '#e2e8f0',
    fontSize: 12,
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
    maxWidth: 500,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalFieldGroup: {
    marginBottom: 14,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 6,
    textAlign: 'right',
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
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  modalErrorText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 16,
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
    paddingHorizontal: 20,
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
