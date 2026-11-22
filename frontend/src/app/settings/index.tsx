import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { useAuth } from '../../context/AuthContext';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';
import {
  getRemainingDays,
  formatRemainingDaysArabic,
  formatDateStandard,
} from '../../utils/dateFormat';

/**
 * شاشة الإعدادات ومعلومات الاشتراك والرقابة الأبوية بتصميم تلفاز داكن (#0f172a).
 */
export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const { isChildMode, pinCode, setChildMode, setPinCode } = useAppStore();
  const { subscription, logout } = useAuth();

  const [inputPin, setInputPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [focusedElement, setFocusedElement] = useState<'copy' | 'logout' | 'pin' | 'toggleChild'>('logout');
  const pinInputRef = useRef<any>(null);

  const isSidebarFocused = useAppStore((state) => state.isSidebarFocused);
  const setIsSidebarFocused = useAppStore((state) => state.setIsSidebarFocused);
  const setFocusedSidebarIndex = useAppStore((state) => state.setFocusedSidebarIndex);

  const handleCopyCode = useCallback(async () => {
    if (!subscription?.code) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(subscription.code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2500);
      }
    } catch {
      // ignore
    }
  }, [subscription?.code]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/activate');
  }, [logout, router]);

  const handleToggleChildMode = useCallback(() => {
    setErrorMessage('');
    setSuccessMessage('');

    if (inputPin.trim().length !== 4 || !/^\d{4}$/.test(inputPin.trim())) {
      setErrorMessage('يرجى إدخال رمز PIN صالح مكون من 4 أرقام بالضبط');
      return;
    }

    const cleanPin = inputPin.trim();

    if (isChildMode) {
      if (cleanPin !== pinCode) {
        setErrorMessage('رمز PIN غير صحيح! لا يمكن إلغاء قفل وضع الطفل');
        return;
      }

      setChildMode(false);
      setInputPin('');
      setSuccessMessage('تم إيقاف وضع الطفل بنجاح، وعرض كافة القنوات والتصنيفات');
    } else {
      setPinCode(cleanPin);
      setChildMode(true);
      setInputPin('');
      setSuccessMessage('تم تفعيل وضع الطفل بنجاح! تم حجب المحتوى غير المناسب');
    }
  }, [inputPin, isChildMode, pinCode, setChildMode, setPinCode]);

  const handleArrowRight = useCallback(() => {
    // في واجهة RTL: الرجوع للشريط الجانبي عند الضغط على سهم اليمين
    setIsSidebarFocused(true);
    setFocusedSidebarIndex(3); // الإعدادات هي العنصر 3
  }, [setIsSidebarFocused, setFocusedSidebarIndex]);

  const handleArrowDown = useCallback(() => {
    if (focusedElement === 'copy') {
      setFocusedElement('logout');
    } else if (focusedElement === 'logout') {
      setFocusedElement('pin');
    } else if (focusedElement === 'pin') {
      setFocusedElement('toggleChild');
    }
  }, [focusedElement]);

  const handleArrowUp = useCallback(() => {
    if (focusedElement === 'toggleChild') {
      setFocusedElement('pin');
    } else if (focusedElement === 'pin') {
      setFocusedElement('logout');
    } else if (focusedElement === 'logout' && subscription?.code) {
      setFocusedElement('copy');
    }
  }, [focusedElement, subscription?.code]);

  const handleArrowLeft = useCallback(() => {
    if (focusedElement === 'copy') {
      setFocusedElement('logout');
    } else if (focusedElement === 'logout') {
      setFocusedElement('pin');
    }
  }, [focusedElement]);

  const handleEnterKey = useCallback(() => {
    if (focusedElement === 'copy') {
      handleCopyCode();
    } else if (focusedElement === 'logout') {
      handleLogout();
    } else if (focusedElement === 'pin') {
      pinInputRef.current?.focus();
    } else if (focusedElement === 'toggleChild') {
      handleToggleChildMode();
    }
  }, [focusedElement, handleCopyCode, handleLogout, handleToggleChildMode]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (isSidebarFocused) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInput) {
        if (e.key === 'Escape' || e.key === 'ArrowDown') {
          (activeEl as HTMLElement).blur();
          setFocusedElement('toggleChild');
          e.preventDefault();
        } else if (e.key === 'ArrowRight') {
          (activeEl as HTMLElement).blur();
          setIsSidebarFocused(true);
          setFocusedSidebarIndex(3);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleArrowUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleArrowDown();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleArrowRight();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleArrowLeft();
          break;
        case 'Enter':
        case 'NumpadEnter':
        case ' ':
        case 'Select':
          e.preventDefault();
          handleEnterKey();
          break;
        case 'Escape':
        case 'Back':
          e.preventDefault();
          setIsSidebarFocused(true);
          setFocusedSidebarIndex(3);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isSidebarFocused,
    handleArrowUp,
    handleArrowDown,
    handleArrowRight,
    handleArrowLeft,
    handleEnterKey,
    setIsSidebarFocused,
    setFocusedSidebarIndex,
  ]);

  useTVRemoteNavigation({
    onArrowUp: handleArrowUp,
    onArrowDown: handleArrowDown,
    onArrowRight: handleArrowRight,
    onArrowLeft: handleArrowLeft,
    onEnter: handleEnterKey,
    onBack: () => {
      setIsSidebarFocused(true);
      setFocusedSidebarIndex(3);
      return true;
    },
  });

  return (
    <View style={styles.container}>
      {/* عنوان الشاشة */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>إعدادات التطبيق</Text>
        <Text style={styles.headerSub}>
          إدارة معلومات الاشتراك، الرقابة الأبوية، وتخصيص تجربة التلفاز
        </Text>
      </View>

      {/* بطاقة معلومات الاشتراك */}
      <View style={styles.subInfoCard}>
        <View style={styles.subInfoHeader}>
          <View style={styles.subInfoTitleGroup}>
            <View style={styles.subIconWrapper}>
              <MaterialIcons name="workspace-premium" size={28} color="#38bdf8" />
            </View>
            <View>
              <Text style={styles.subInfoMainTitle}>معلومات الاشتراك</Text>
              <Text style={styles.subInfoSubTitle}>تفاصيل كود التفعيل وصلاحية الحساب الحالية</Text>
            </View>
          </View>

          {(() => {
            const isSubExpired = Boolean(
              subscription &&
                (subscription.status === 'expired' || (subscription.remainingDays !== undefined && subscription.remainingDays <= 0))
            );
            return (
              <View
                style={[
                  styles.subStatusPill,
                  isSubExpired ? styles.subStatusExpired : styles.subStatusActive,
                ]}
              >
                <View
                  style={[
                    styles.subStatusDot,
                    isSubExpired
                      ? { backgroundColor: '#ef4444' }
                      : { backgroundColor: '#10b981' },
                  ]}
                />
                <Text
                  style={[
                    styles.subStatusPillText,
                    isSubExpired ? { color: '#ef4444' } : { color: '#10b981' },
                  ]}
                >
                  {subscription ? (isSubExpired ? 'منتهي الصلاحية' : 'اشتراك نشط') : 'غير مفعل'}
                </Text>
              </View>
            );
          })()}
        </View>

        <View style={styles.subDetailsRow}>
          {/* كود الاشتراك */}
          <View style={styles.subDetailBox}>
            <Text style={styles.subDetailLabel}>كود التفعيل الحالي:</Text>
            <View style={styles.subCodeRow}>
              <Text style={styles.subCodeVal}>{subscription?.code || '—'}</Text>
              {subscription?.code && (
                <Pressable
                  onPress={handleCopyCode}
                  style={({ focused }) => [
                    styles.copyBtn,
                    (focusedElement === 'copy' || focused) && styles.copyBtnFocused,
                  ]}
                >
                  <MaterialIcons
                    name={copiedCode ? 'check' : 'content-copy'}
                    size={16}
                    color={copiedCode ? '#10b981' : '#38bdf8'}
                  />
                  <Text style={[styles.copyBtnText, copiedCode && { color: '#10b981' }]}>
                    {copiedCode ? 'تم النسخ!' : 'نسخ الكود'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* المدة المتبقية */}
          <View style={styles.subDetailBox}>
            <Text style={styles.subDetailLabel}>المدة المتبقية:</Text>
            <Text style={styles.subHighlightVal}>
              {subscription
                ? formatRemainingDaysArabic(
                    getRemainingDays(subscription.expiresAt) || subscription.remainingDays,
                    subscription.expiresAt
                  )
                : '—'}
            </Text>
          </View>

          {/* تاريخ الانتهاء */}
          <View style={styles.subDetailBox}>
            <Text style={styles.subDetailLabel}>تاريخ الانتهاء:</Text>
            <Text style={styles.subDetailText}>
              {formatDateStandard(subscription?.expiresAt)}
            </Text>
          </View>

          {/* زر تغيير الكود / تسجيل الخروج */}
          <View style={styles.subActionBox}>
            <Pressable
              onPress={handleLogout}
              style={({ focused }) => [
                styles.subLogoutBtn,
                (focusedElement === 'logout' || focused) && styles.subLogoutBtnFocused,
              ]}
            >
              <MaterialIcons name="logout" size={18} color="#ef4444" />
              <Text style={styles.subLogoutBtnText}>تغيير الكود / خروج</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.gridRow}>
        {/* 1. قسم وضع الطفل والرقابة الأبوية */}
        <View style={styles.card}>
          <View>
            <View style={styles.cardTopRow}>
              <View style={styles.cardHeaderInfo}>
                <View style={[styles.cardIconBox, isChildMode && styles.cardIconBoxActive]}>
                  <MaterialIcons
                    name={isChildMode ? 'child-care' : 'family-restroom'}
                    size={28}
                    color={isChildMode ? '#f59e0b' : '#38bdf8'}
                  />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>وضع الرقابة الأبوية (وضع الطفل)</Text>
                  <Text style={styles.cardSubtitle}>
                    فلترة المحتوى غير المناسب والأخبار تلقائياً
                  </Text>
                </View>
              </View>

              <View style={[styles.statusBadge, isChildMode && styles.statusBadgeActive]}>
                <Text style={[styles.statusText, isChildMode && styles.statusTextActive]}>
                  {isChildMode ? 'مفعّل الآن' : 'غير مفعّل'}
                </Text>
              </View>
            </View>

            <Text style={styles.descText}>
              {isChildMode
                ? 'وضع الطفل قيد التشغيل حالياً. لإيقافه والسماح بجميع القنوات، أدخل رمز PIN المسجل أدناه:'
                : 'لحماية أطفالك وتصفية المحتوى الموجه للبالغين، قم بتعيين رمز PIN مكون من 4 أرقام ثم اضغط تفعيل:'}
            </Text>

            <View
              style={[
                styles.inputBox,
                (focusedElement === 'pin' || isInputFocused) && styles.inputBoxFocused,
              ]}
            >
              <MaterialIcons
                name="lock-outline"
                size={22}
                color={isInputFocused || focusedElement === 'pin' ? '#38bdf8' : '#64748b'}
              />
              <TextInput
                ref={pinInputRef}
                value={inputPin}
                onChangeText={setInputPin}
                onFocus={() => {
                  setIsInputFocused(true);
                  setFocusedElement('pin');
                }}
                onBlur={() => setIsInputFocused(false)}
                placeholder="أدخل رمز PIN (مثال: 1234)"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                maxLength={4}
                secureTextEntry
                style={styles.pinInput}
              />
            </View>

            {errorMessage ? (
              <Text style={styles.errorAlert}>{errorMessage}</Text>
            ) : null}

            {successMessage ? (
              <Text style={styles.successAlert}>{successMessage}</Text>
            ) : null}
          </View>

          <Pressable
            hasTVPreferredFocus
            onPress={handleToggleChildMode}
            style={({ focused }) => [
              styles.actionBtn,
              isChildMode ? styles.actionBtnDanger : styles.actionBtnWarning,
              (focusedElement === 'toggleChild' || focused) && styles.actionBtnFocused,
            ]}
          >
            {({ focused }) => (
              <View style={styles.btnRow}>
                <MaterialIcons
                  name={isChildMode ? 'lock-open' : 'lock'}
                  size={20}
                  color={focused ? '#000000' : '#ffffff'}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    focused && styles.actionBtnTextFocused,
                  ]}
                >
                  {isChildMode ? 'إلغاء قفل وضع الطفل' : 'تفعيل وضع الطفل وقفل التصنيفات'}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* 2. قسم المؤقت الزمني */}
        <View style={[styles.card, styles.cardMargin]}>
          <View>
            <View style={styles.cardHeaderInfo}>
              <View style={styles.cardIconBox}>
                <MaterialIcons name="timer" size={28} color="#38bdf8" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>مؤقت المشاهدة الذكي</Text>
                <Text style={styles.cardSubtitle}>
                  إيقاف التشغيل التلقائي بعد مدة محددة
                </Text>
              </View>
            </View>

            <View style={styles.timerPreviewBox}>
              <View style={styles.timerRow}>
                <Text style={styles.timerLabel}>المدة الافتراضية:</Text>
                <Text style={styles.timerValue}>ساعتان (120 دقيقة)</Text>
              </View>
              <Text style={styles.timerDesc}>
                عند انتهاء العداد التنازلي للمؤقت، سيتم قفل المشغل تلقائياً لمنع الاستخدام المفرط.
              </Text>
            </View>
          </View>

          <View style={styles.disabledBtn}>
            <MaterialIcons name="hourglass-empty" size={20} color="#64748b" />
            <Text style={styles.disabledBtnText}>المؤقت التلقائي (قيد التطوير)</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  gridRow: {
    flexDirection: 'row',
  },
  card: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 20,
    padding: 24,
    justifyContent: 'space-between',
  },
  cardMargin: {
    marginLeft: 20,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconBoxActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  cardHeaderText: {
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusTextActive: {
    color: '#fbbf24',
  },
  descText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 22,
    marginBottom: 16,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  inputBoxFocused: {
    borderColor: '#38bdf8',
    backgroundColor: '#0b1120',
  },
  pinInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    letterSpacing: 4,
    marginLeft: 12,
    outlineWidth: 0,
  },
  errorAlert: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  successAlert: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  actionBtnWarning: {
    backgroundColor: '#d97706',
  },
  actionBtnDanger: {
    backgroundColor: '#dc2626',
  },
  actionBtnFocused: {
    backgroundColor: '#ffffff',
    transform: [{ scale: 1.05 }],
    shadowColor: '#38bdf8',
    shadowOpacity: 0.9,
    shadowRadius: 14,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  actionBtnTextFocused: {
    color: '#000000',
    fontWeight: '900',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerPreviewBox: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginTop: 18,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timerLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  timerValue: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  timerDesc: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  disabledBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    opacity: 0.7,
  },
  disabledBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  subInfoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
    marginBottom: 24,
    direction: 'rtl',
  },
  subInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    direction: 'rtl',
  },
  subInfoTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    direction: 'rtl',
  },
  subIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0369a130',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0284c750',
  },
  subInfoMainTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subInfoSubTitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    direction: 'rtl',
  },
  subStatusActive: {
    backgroundColor: '#10b98120',
    borderWidth: 1,
    borderColor: '#10b98150',
  },
  subStatusExpired: {
    backgroundColor: '#ef444420',
    borderWidth: 1,
    borderColor: '#ef444450',
  },
  subStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subStatusPillText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  subDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    direction: 'rtl',
  },
  subDetailBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    minWidth: 180,
    flex: 1,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'flex-start',
    direction: 'rtl',
  },
  subDetailLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    direction: 'rtl',
  },
  subCodeVal: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  copyBtnFocused: {
    backgroundColor: '#38bdf8',
  },
  copyBtnText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
  },
  subHighlightVal: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subDetailText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  subActionBox: {
    justifyContent: 'center',
  },
  subLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    direction: 'rtl',
  },
  subLogoutBtnFocused: {
    backgroundColor: '#ef4444',
    transform: [{ scale: 1.05 }],
  },
  subLogoutBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
