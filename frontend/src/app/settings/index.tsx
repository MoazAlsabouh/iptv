import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';

/**
 * شاشة الإعدادات والرقابة الأبوية بتصميم تلفاز داكن (#0f172a).
 */
export default function SettingsScreen(): React.JSX.Element {
  const { isChildMode, pinCode, setChildMode, setPinCode } = useAppStore();

  const [inputPin, setInputPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);

  const handleToggleChildMode = () => {
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
  };

  return (
    <View style={styles.container}>
      {/* عنوان الشاشة */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>إعدادات التطبيق</Text>
        <Text style={styles.headerSub}>
          إدارة الرقابة الأبوية، أمان المحتوى، وتخصيص تجربة التلفاز
        </Text>
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

            <View style={[styles.inputBox, isInputFocused && styles.inputBoxFocused]}>
              <MaterialIcons
                name="lock-outline"
                size={22}
                color={isInputFocused ? '#38bdf8' : '#64748b'}
              />
              <TextInput
                value={inputPin}
                onChangeText={setInputPin}
                onFocus={() => setIsInputFocused(true)}
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
              focused && styles.actionBtnFocused,
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
});
