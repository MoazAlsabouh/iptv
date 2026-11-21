import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  Linking,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import Constants from 'expo-constants';
import { MaterialIcons } from '@expo/vector-icons';
import { BACKEND_BASE_URL } from '../context/AuthContext';

interface AppVersionResponse {
  latestVersionCode: number;
  minSupportedVersionCode: number;
  latestVersionName: string;
  downloadUrl: string;
  message: string;
}

export function UpdateModal(): React.JSX.Element | null {
  // هذا المكوّن مخصص فقط للأجهزة الأصلية (Android / Android TV)
  if (Platform.OS === 'web') {
    return null;
  }

  const { width } = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [isMandatory, setIsMandatory] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<AppVersionResponse | null>(null);

  // قراءة رقم الإصدار الحالي للتطبيق
  const currentVersionCode =
    Constants.expoConfig?.android?.versionCode ?? 3;

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const checkAppVersion = async () => {
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/api/app-version`, {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            Accept: 'application/json',
          },
        });

        if (!res.ok) return;

        const data: AppVersionResponse = await res.json();
        if (!isMounted) return;

        setUpdateInfo(data);

        // 1. فحص التحديث الإجباري
        if (currentVersionCode < data.minSupportedVersionCode) {
          setIsMandatory(true);
          setModalVisible(true);
        }
        // 2. فحص التحديث الاختياري
        else if (currentVersionCode < data.latestVersionCode) {
          setIsMandatory(false);
          setModalVisible(true);
        }
      } catch {
        // في حال فشل الاتصال أو انتهاء المهلة، لا نعطل عمل التطبيق
      } finally {
        clearTimeout(timeoutId);
      }
    };

    checkAppVersion();

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [currentVersionCode]);

  // تعطيل زر الرجوع في أندرويد إذا كان التحديث إجبارياً
  useEffect(() => {
    if (!modalVisible || !isMandatory) return;

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true // يمنع إغلاق النافذة
    );

    return () => backSubscription.remove();
  }, [modalVisible, isMandatory]);

  if (!modalVisible || !updateInfo) {
    return null;
  }

  const handleUpdateNow = async () => {
    try {
      if (updateInfo.downloadUrl) {
        const canOpen = await Linking.canOpenURL(updateInfo.downloadUrl);
        if (canOpen) {
          await Linking.openURL(updateInfo.downloadUrl);
        } else {
          await Linking.openURL(updateInfo.downloadUrl);
        }
      }
    } catch (err) {
      console.warn('[UpdateModal] Failed to open download URL:', err);
    }
  };

  const handleDismiss = () => {
    if (!isMandatory) {
      setModalVisible(false);
    }
  };

  const isWide = width >= 600;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.dialogCard, isWide && styles.dialogCardWide]}>
          {/* رأس النافذة */}
          <View style={styles.headerRow}>
            <View
              style={[
                styles.iconBadge,
                isMandatory ? styles.iconBadgeMandatory : styles.iconBadgeOptional,
              ]}
            >
              <MaterialIcons
                name={isMandatory ? 'system-security-update-warning' : 'system-update'}
                size={30}
                color={isMandatory ? '#ef4444' : '#0EA5E9'}
              />
            </View>

            <View style={styles.headerTextContainer}>
              <View style={styles.titleWithBadge}>
                <Text style={styles.titleText}>
                  {isMandatory ? 'تحديث إجباري مطلوب' : 'يتوفر إصدار جديد'}
                </Text>
                {isMandatory && (
                  <View style={styles.mandatoryBadge}>
                    <Text style={styles.mandatoryBadgeText}>إجباري</Text>
                  </View>
                )}
              </View>
              <Text style={styles.versionSubText}>
                الإصدار الجديد: {updateInfo.latestVersionName} (بناء {updateInfo.latestVersionCode})
              </Text>
            </View>
          </View>

          {/* نص الرسالة القادمة من السيرفر */}
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>
              {updateInfo.message ||
                'يتوفر إصدار جديد من تطبيق تلفازي يتضمن تحسينات في الأداء وسرعة المشغّل.'}
            </Text>
          </View>

          {/* تفاصيل الإصدار */}
          <View style={styles.versionDetailsRow}>
            <View style={styles.versionCol}>
              <Text style={styles.versionColLabel}>الإصدار الحالي:</Text>
              <Text style={styles.versionColVal}>بناء {currentVersionCode}</Text>
            </View>
            <MaterialIcons name="arrow-back" size={18} color="#64748b" />
            <View style={styles.versionCol}>
              <Text style={styles.versionColLabel}>الإصدار الأحدث:</Text>
              <Text style={[styles.versionColVal, { color: '#0EA5E9' }]}>
                {updateInfo.latestVersionName}
              </Text>
            </View>
          </View>

          {/* أزرار الإجراءات */}
          <View style={styles.actionsRow}>
            <Pressable
              hasTVPreferredFocus
              onPress={handleUpdateNow}
              style={({ focused }) => [
                styles.actionBtn,
                styles.updateBtn,
                focused && styles.actionBtnFocused,
              ]}
            >
              {({ focused }) => (
                <View style={styles.btnContent}>
                  <MaterialIcons
                    name="cloud-download"
                    size={20}
                    color={focused ? '#000000' : '#ffffff'}
                  />
                  <Text
                    style={[
                      styles.btnText,
                      styles.updateBtnText,
                      focused && styles.btnTextFocused,
                    ]}
                  >
                    تحديث الآن
                  </Text>
                </View>
              )}
            </Pressable>

            {!isMandatory && (
              <Pressable
                onPress={handleDismiss}
                style={({ focused }) => [
                  styles.actionBtn,
                  styles.laterBtn,
                  focused && styles.actionBtnFocused,
                ]}
              >
                {({ focused }) => (
                  <View style={styles.btnContent}>
                    <MaterialIcons
                      name="schedule"
                      size={18}
                      color={focused ? '#000000' : '#94a3b8'}
                    />
                    <Text
                      style={[
                        styles.btnText,
                        styles.laterBtnText,
                        focused && styles.btnTextFocused,
                      ]}
                    >
                      لاحقاً
                    </Text>
                  </View>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '92%',
    maxWidth: 520,
    backgroundColor: '#131C31',
    borderRadius: 22,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(14, 165, 233, 0.3)',
    direction: 'rtl',
    shadowColor: '#000000',
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
  },
  dialogCardWide: {
    padding: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    direction: 'rtl',
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadgeMandatory: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  iconBadgeOptional: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.4)',
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    direction: 'rtl',
  },
  titleText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  mandatoryBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mandatoryBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  versionSubText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  messageBox: {
    backgroundColor: '#0B1120',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  messageText: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  versionDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(11, 17, 32, 0.6)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    direction: 'rtl',
  },
  versionCol: {
    alignItems: 'center',
  },
  versionColLabel: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 2,
  },
  versionColVal: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    direction: 'rtl',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateBtn: {
    backgroundColor: '#0EA5E9',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
  },
  laterBtn: {
    backgroundColor: '#0B1120',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  actionBtnFocused: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    transform: [{ scale: 1.03 }],
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    direction: 'rtl',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  updateBtnText: {
    color: '#ffffff',
  },
  laterBtnText: {
    color: '#94a3b8',
  },
  btnTextFocused: {
    color: '#000000',
  },
});
