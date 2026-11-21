import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTVRemoteNavigation } from '../../hooks/useTVRemoteNavigation';

export default function ActivateScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activate, deviceId, deviceName } = useAuth();
  const { width } = useWindowDimensions();

  const defaultDeviceName = React.useMemo(() => {
    if (Platform.OS !== 'web') {
      return Platform.isTV ? 'شاشة التلفاز' : 'هاتف محمول';
    }
    return deviceName || 'متصفح ويب';
  }, [deviceName]);

  const [code, setCode] = useState<string>('');
  const [customDeviceName, setCustomDeviceName] = useState<string>(defaultDeviceName);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // تحديث اسم الجهاز في حال تغير الاكتشاف
  React.useEffect(() => {
    setCustomDeviceName(defaultDeviceName);
  }, [defaultDeviceName]);

  const isWide = width >= 768;

  // تنسيق الكود تلقائياً
  const handleCodeChange = (text: string) => {
    setErrorMessage(null);
    let cleaned = text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setCode(cleaned);
  };

  const handleActivate = async () => {
    if (!code.trim()) {
      setErrorMessage('يرجى إدخال كود التفعيل للمتابعة');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await activate(code.trim(), customDeviceName.trim());
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMessage('تم تفعيل الاشتراك بنجاح! جاري تحويلك للمنصة...');
      setTimeout(() => {
        router.replace('/home');
      }, 1200);
    } else {
      setErrorMessage(result.error || 'فشل التفعيل، تأكد من صحة الكود');
    }
  };

  useTVRemoteNavigation({
    onBack: () => {
      // لا نرجع إذا كان غير مفعل
    },
  });

  return (
    <View style={styles.container}>
      {/* خلفية بتدرج داكن فخم مع أشكال دائرية مضيئة خافتة */}
      <View style={styles.glowBlob1} />
      <View style={styles.glowBlob2} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 24),
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, isWide && styles.cardWide]}>
          {/* الشعار والعنوان */}
          <View style={styles.header}>
            <Image
              source={{ uri: '/icon.png' }}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitle}>تلفازي</Text>
              <Text style={styles.brandTitleDivider}>|</Text>
              <Text style={styles.brandTitleEn}>Telfazi</Text>
            </View>
            <Text style={styles.title}>تفعيل اشتراك المنصة</Text>
            <Text style={styles.subtitle}>
              أدخل كود التفعيل المخصص لك للوصول إلى كافة القنوات الفضائية ومكتبة الأفلام والمسلسلات بجودة عالية
            </Text>
          </View>

          {/* حقل إدخال الكود */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>كود التفعيل (Activation Code):</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons
                name="vpn-key"
                size={22}
                color="#38bdf8"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={handleCodeChange}
                placeholder="مثال: TV-8492-XK9P"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleActivate}
              />
            </View>
          </View>

          {/* معلومات الجهاز */}
          <View style={styles.deviceInfoBox}>
            <View style={styles.deviceInfoRow}>
              <MaterialIcons name="devices" size={18} color="#94a3b8" />
              <Text style={styles.deviceInfoLabel}>الجهاز الحالي:</Text>
              <Text style={styles.deviceInfoValue}>{customDeviceName}</Text>
            </View>
            <View style={styles.deviceInfoRow}>
              <MaterialIcons name="fingerprint" size={18} color="#94a3b8" />
              <Text style={styles.deviceInfoLabel}>معرّف الجهاز:</Text>
              <Text style={styles.deviceInfoValue} numberOfLines={1}>
                {deviceId}
              </Text>
            </View>
          </View>

          {/* رسائل الخطأ أو النجاح */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <MaterialIcons name="error-outline" size={20} color="#ef4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {successMessage && (
            <View style={styles.successBox}>
              <MaterialIcons name="check-circle" size={20} color="#10b981" />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          {/* زر التفعيل الرئيسي */}
          <Pressable
            hasTVPreferredFocus
            disabled={isSubmitting}
            onPress={handleActivate}
            style={({ focused }) => [
              styles.submitBtn,
              focused && styles.submitBtnFocused,
              isSubmitting && { opacity: 0.7 },
            ]}
          >
            {({ focused }) => (
              <View style={styles.submitBtnContent}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={focused ? '#000000' : '#ffffff'} />
                ) : (
                  <>
                    <MaterialIcons
                      name="lock-open"
                      size={22}
                      color={focused ? '#000000' : '#ffffff'}
                    />
                    <Text
                      style={[
                        styles.submitBtnText,
                        focused && styles.submitBtnTextFocused,
                      ]}
                    >
                      تفعيل الاشتراك والبدء
                    </Text>
                  </>
                )}
              </View>
            )}
          </Pressable>

          {/* مساعدة وطلب كود */}
          <View style={styles.footerNote}>
            <Text style={styles.footerNoteText}>
              ليس لديك كود تفعيل؟ تواصل مع الموزع المعتمد للحصول على كود اشتراكك.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowBlob1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 350,
    height: 350,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
  },
  glowBlob2: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 165, 233, 0.08)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#131C31',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.2)',
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
  },
  cardWide: {
    padding: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoImg: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 14,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandTitleDivider: {
    color: '#0EA5E9',
    fontSize: 15,
    fontWeight: '400',
  },
  brandTitleEn: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 360,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'right',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1120',
    borderWidth: 1.5,
    borderColor: 'rgba(14, 165, 233, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginLeft: 10,
  },
  input: {
    flex: 1,
    height: 52,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  deviceInfoBox: {
    backgroundColor: 'rgba(11, 17, 32, 0.6)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceInfoLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  deviceInfoValue: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  successText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  submitBtn: {
    backgroundColor: '#0EA5E9',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  submitBtnFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.03 }],
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 8,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  submitBtnTextFocused: {
    color: '#000000',
  },
  footerNote: {
    marginTop: 22,
    alignItems: 'center',
  },
  footerNoteText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
