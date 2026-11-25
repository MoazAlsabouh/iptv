import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth, BACKEND_BASE_URL } from '../context/AuthContext';

/**
 * رابط تحميل ملف APK الافتراضي ورقم الإصدار
 */
export const DEFAULT_DOWNLOAD_URL = 'https://github.com/MoazAlsabouh/iptv/releases/latest/download/telfazi.apk';
export const DEFAULT_VERSION_NAME = '1.0.5';

export default function LandingPage(): React.JSX.Element {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const isWide = mounted ? width >= 960 : false;
  const isTablet = mounted ? (width >= 640 && width < 960) : false;
  const isMobile = mounted ? width < 640 : true;

  const { token } = useAuth();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>(DEFAULT_DOWNLOAD_URL);
  const [versionName, setVersionName] = useState<string>(DEFAULT_VERSION_NAME);

  // جلب رابط وأحدث إصدار من السيرفر
  useEffect(() => {
    fetch(`${BACKEND_BASE_URL}/api/app-version`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.downloadUrl) setDownloadUrl(data.downloadUrl);
        if (data?.latestVersionName) setVersionName(data.latestVersionName);
      })
      .catch((err) => {
        console.warn('[LandingPage] Failed to fetch app version:', err);
      });
  }, []);

  // تجاوز صفحة الهبوط فوراً في تطبيق الأندرويد/التلفاز الأصلي
  useEffect(() => {
    if (Platform.OS !== 'web') {
      if (token) {
        router.replace('/home');
      } else {
        router.replace('/activate');
      }
    }
  }, [token, router]);

  if (Platform.OS !== 'web') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0B1120',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  // إظهار تنبيه لطيف للمستخدم
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // الدخول للمنصة (إذا كان لديه اشتراك مفعّل يدخل للرئيسية، وإلا يتوجه لشاشة التفعيل)
  const handleEnterPlatform = () => {
    if (token) {
      router.push('/home');
    } else {
      router.push('/activate');
    }
  };

  // معالجة تحميل ملف APK المباشر (توجيه مباشر في نفس الصفحة لمتصفحات التلفاز)
  const handleDownloadApk = () => {
    const targetUrl = downloadUrl || DEFAULT_DOWNLOAD_URL;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = targetUrl;
    } else {
      Linking.openURL(targetUrl);
    }
  };

  const handleDownloadSmartTV = () => {
    handleDownloadApk();
  };

  const handleDownloadMobile = () => {
    handleDownloadApk();
  };

  return (
    <View style={styles.root}>
      {/* تنبيه عائم عند النقر على روابط قيد التجهيز */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <View style={styles.toastInner}>
            <MaterialIcons name="info" size={20} color="#38bdf8" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}

      {/* شريط الملاحة العلوي */}
      <View style={styles.navbar}>
        <View style={styles.brandRow}>
          <Image
            source={{ uri: '/icon.png' }}
            style={styles.brandLogoImg}
            resizeMode="contain"
          />
          <View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandName}>تلفازي</Text>
              <Text style={styles.brandNameDivider}>|</Text>
              <Text style={styles.brandSubEn}>Telfazi</Text>
            </View>
            <Text style={styles.brandSub}>منصة الترفيه المنزلي المتكاملة</Text>
          </View>
        </View>

        <a
          href="/home"
          style={{
            textDecoration: 'none',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(14, 165, 233, 0.15)',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#0EA5E9',
            paddingLeft: 18,
            paddingRight: 18,
            paddingTop: 10,
            paddingBottom: 10,
            borderRadius: 12,
            cursor: 'pointer',
          }}
        >
          <MaterialIcons name="login" size={18} color="#ffffff" />
          <Text style={styles.navCtaBtnText}>الدخول للمنصة</Text>
        </a>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ==========================================
            قسم البطل الترحيبي (Hero Section)
            ========================================== */}
        <View style={styles.heroSection}>
          <View style={styles.heroBadge}>
            <MaterialIcons name="auto-awesome" size={16} color="#38bdf8" />
            <Text style={styles.heroBadgeText}>
              الجيل الجديد من تجربة البث الرقمي 4K & FHD
            </Text>
          </View>

          <Text style={[styles.heroTitle, isMobile && { fontSize: 28 }]}>
            بوابتك المتكاملة لمشاهدة <Text style={styles.textHighlight}>القنوات والأفلام</Text> بأعلى جودة
          </Text>

          <Text style={[styles.heroDescription, isMobile && { fontSize: 15 }]}>
            استمتع بآلاف القنوات التلفزيونية المباشرة العربية والعالمية، ومكتبة متجددة باستمرار
            من أحدث الأفلام والمسلسلات بدقة فائقة وبدون إعلانات مزعجة. صُممت المنصة خصيصاً
            لتمنحك تجربة سينمائية متكاملة متوافقة تماماً مع أجهزة التلفاز وريموت التحكم عن بعد.
          </Text>

          {/* زر الدعوة الأساسي */}
          <View style={styles.heroCtaWrapper}>
            <a
              href="/home"
              style={{
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: '#38bdf8',
                paddingLeft: 32,
                paddingRight: 32,
                paddingTop: 16,
                paddingBottom: 16,
                borderRadius: 14,
                cursor: 'pointer',
                boxShadow: '0 8px 16px rgba(56, 189, 248, 0.4)',
              }}
            >
              <Text style={styles.primaryCtaBtnText}>ابدأ المشاهدة الآن</Text>
              <MaterialIcons
                name="play-circle-filled"
                size={24}
                color="#070b14"
              />
            </a>
          </View>

          {/* مؤشرات سريعة */}
          <View style={styles.statsPillRow}>
            <View style={styles.statPill}>
              <MaterialIcons name="live-tv" size={18} color="#38bdf8" />
              <Text style={styles.statPillText}>+10,000 قناة حية</Text>
            </View>
            <View style={styles.statPill}>
              <MaterialIcons name="movie" size={18} color="#f59e0b" />
              <Text style={styles.statPillText}>أحدث الأفلام والمسلسلات</Text>
            </View>
            <View style={styles.statPill}>
              <MaterialIcons name="flash-on" size={18} color="#10b981" />
              <Text style={styles.statPillText}>بث مباشر فائق السرعة</Text>
            </View>
          </View>
        </View>

        {/* ==========================================
            قسم تحميل التطبيقات (Downloads Section)
            ========================================== */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderBadge}>
              <MaterialIcons name="download" size={16} color="#38bdf8" />
              <Text style={styles.sectionHeaderBadgeText}>تطبيقات المنصة</Text>
            </View>
            <Text style={styles.sectionTitle}>حمّل التطبيق على أجهزتك المفضلة</Text>
            <Text style={styles.sectionSubtitle}>
              تطبيقات أصلية وخفيفة تمنحك أفضل أداء على الشاشات الكبيرة والهواتف الذكية
            </Text>
          </View>

          <View style={isWide ? styles.downloadCardsGridWide : styles.downloadCardsGridCol}>
            {/* بطاقة الشاشات الذكية */}
            <View style={styles.downloadCard}>
              <View style={styles.downloadCardHeader}>
                <View style={styles.downloadIconWrap}>
                  <MaterialIcons name="tv" size={36} color="#38bdf8" />
                </View>
                <View style={[styles.versionBadge, { backgroundColor: 'rgba(14, 165, 233, 0.15)', borderColor: 'rgba(14, 165, 233, 0.35)' }]}>
                  <MaterialIcons name="verified" size={13} color="#38bdf8" />
                  <Text style={[styles.versionBadgeText, { color: '#38bdf8' }]}>الإصدار v{versionName}</Text>
                </View>
              </View>

              <Text style={styles.downloadCardTitle}>شاشات أندرويد والتلفاز الذكي</Text>
              <Text style={styles.downloadCardSub}>Android TV • Google TV • TV Box</Text>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color="#38bdf8" />
                  <Text style={styles.featureItemText}>تحكم كامل ومباشر بريموت التلفاز</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color="#38bdf8" />
                  <Text style={styles.featureItemText}>واجهة سينمائية ملائمة للشاشات الكبيرة</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color="#38bdf8" />
                  <Text style={styles.featureItemText}>دعم دقة 4K و Full HD بدون تقطيع</Text>
                </View>
              </View>

              <a
                href={downloadUrl || DEFAULT_DOWNLOAD_URL}
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: 'rgba(14, 165, 233, 0.1)',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: '#0EA5E9',
                  paddingTop: 14,
                  paddingBottom: 14,
                  paddingLeft: 16,
                  paddingRight: 16,
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
              >
                <MaterialIcons name="android" size={20} color="#38bdf8" />
                <Text style={styles.downloadBtnText}>
                  تحميل نسخة الشاشات (APK)
                </Text>
                <View
                  style={[
                    styles.btnVersionTag,
                    { backgroundColor: 'rgba(56, 189, 248, 0.15)' },
                  ]}
                >
                  <Text style={[styles.btnVersionText, { color: '#38bdf8' }]}>
                    v{versionName}
                  </Text>
                </View>
              </a>
              <Text style={styles.downloadSubMeta}>ملف APK مباشر • v{versionName} • متوافق مع الريموت</Text>
              <View style={styles.directUrlBox}>
                <MaterialIcons name="link" size={14} color="#38bdf8" />
                <Text style={styles.directUrlText}>
                  أو عبر الرابط المباشر:{' '}
                  <Text style={styles.directUrlHighlight}>tv.moazns.sy/apk</Text>
                </Text>
              </View>
            </View>

            {/* بطاقة الهواتف الذكية */}
            <View style={styles.downloadCard}>
              <View style={styles.downloadCardHeader}>
                <View style={[styles.downloadIconWrap, { backgroundColor: 'rgba(129, 140, 248, 0.15)' }]}>
                  <MaterialIcons name="smartphone" size={36} color="#818cf8" />
                </View>
                <View style={[styles.versionBadge, { backgroundColor: 'rgba(129, 140, 248, 0.15)', borderColor: 'rgba(129, 140, 248, 0.35)' }]}>
                  <MaterialIcons name="verified" size={13} color="#818cf8" />
                  <Text style={[styles.versionBadgeText, { color: '#818cf8' }]}>الإصدار v{versionName}</Text>
                </View>
              </View>

              <Text style={styles.downloadCardTitle}>الهواتف والأجهزة اللوحية</Text>
              <Text style={styles.downloadCardSub}>Android Phones & Tablets</Text>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color="#818cf8" />
                  <Text style={styles.featureItemText}>واجهة لمسية متجاوبة وسريعة</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color="#818cf8" />
                  <Text style={styles.featureItemText}>استهلاك منخفض للبيانات والبطارية</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color="#818cf8" />
                  <Text style={styles.featureItemText}>مشغل فيديو متطور يدعم التكبير والتصغير</Text>
                </View>
              </View>

              <a
                href={downloadUrl || DEFAULT_DOWNLOAD_URL}
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: 'rgba(129, 140, 248, 0.1)',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: '#818cf8',
                  paddingTop: 14,
                  paddingBottom: 14,
                  paddingLeft: 16,
                  paddingRight: 16,
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
              >
                <MaterialIcons name="android" size={20} color="#818cf8" />
                <Text style={[styles.downloadBtnText, { color: '#818cf8' }]}>
                  تحميل نسخة المحمول (APK)
                </Text>
                <View style={styles.btnVersionTag}>
                  <Text style={styles.btnVersionText}>v{versionName}</Text>
                </View>
              </a>
              <Text style={styles.downloadSubMeta}>ملف APK مباشر • v{versionName} • أندرويد 6.0 وما فوق</Text>
              <View style={styles.directUrlBox}>
                <MaterialIcons name="link" size={14} color="#818cf8" />
                <Text style={styles.directUrlText}>
                  أو عبر الرابط المباشر:{' '}
                  <Text style={[styles.directUrlHighlight, { color: '#a5b4fc' }]}>tv.moazns.sy/apk</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ==========================================
            قسم مميزات المنصة (Features Section)
            ========================================== */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderBadge}>
              <MaterialIcons name="verified" size={16} color="#10b981" />
              <Text style={[styles.sectionHeaderBadgeText, { color: '#10b981' }]}>
                لماذا تختار منصتنا؟
              </Text>
            </View>
            <Text style={styles.sectionTitle}>مميزات صُممت لراحتك ومتعة مشاهدتك</Text>
          </View>

          <View style={isWide ? styles.featuresGridWide : styles.featuresGridCol}>
            {/* ميزة 1 */}
            <View style={styles.featureCard}>
              <View style={[styles.featureIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <MaterialIcons name="settings-remote" size={30} color="#38bdf8" />
              </View>
              <Text style={styles.featureCardTitle}>دعم كامل لريموت التلفاز</Text>
              <Text style={styles.featureCardDesc}>
                تجربة تحكم مصممة بدقة للشاشات الكبيرة؛ تنقل بين القنوات والأفلام بأزرار الأسهم
                ومفتاح OK بسلاسة تامة دون الحاجة لفأرة أو لمس.
              </Text>
            </View>

            {/* ميزة 2 */}
            <View style={styles.featureCard}>
              <View style={[styles.featureIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <MaterialIcons name="video-library" size={30} color="#f59e0b" />
              </View>
              <Text style={styles.featureCardTitle}>مكتبة ترفيهية متجددة</Text>
              <Text style={styles.featureCardDesc}>
                آلاف القنوات الرياضية والوثائقية والإخبارية، وأضخم مكتبة للأفلام والمسلسلات
                العربية والأجنبية مع تحديث الحلقات والمواسم فور صدورها.
              </Text>
            </View>

            {/* ميزة 3 */}
            <View style={styles.featureCard}>
              <View style={[styles.featureIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <MaterialIcons name="vpn-key" size={30} color="#10b981" />
              </View>
              <Text style={styles.featureCardTitle}>تفعيل فوري وآمن</Text>
              <Text style={styles.featureCardDesc}>
                تفعيل مباشر بكود الاشتراك الرقمي دون الحاجة لكتابة بريد أو كلمات مرور معقدة على
                شاشة التلفاز، مع حفظ اشتراكك تلقائياً على جهازك.
              </Text>
            </View>
          </View>
        </View>

        {/* ==========================================
            دعوة للعمل الختامية (CTA Banner)
            ========================================== */}
        <View style={styles.bottomBanner}>
          <Text style={styles.bottomBannerTitle}>جاهز لتجربة ترفيهية غير مسبوقة؟</Text>
          <Text style={styles.bottomBannerSub}>
            أدخل كود الاشتراك الخاص بك وابدأ البث المباشر على الفور
          </Text>
          <a
            href="/home"
            style={{
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: '#38bdf8',
              paddingLeft: 32,
              paddingRight: 32,
              paddingTop: 16,
              paddingBottom: 16,
              borderRadius: 14,
              cursor: 'pointer',
              boxShadow: '0 8px 16px rgba(56, 189, 248, 0.4)',
            }}
          >
            <Text style={styles.primaryCtaBtnText}>الدخول للمنصة الآن</Text>
            <MaterialIcons
              name="arrow-back"
              size={20}
              color="#070b14"
            />
          </a>
        </View>

        {/* ==========================================
            التذييل (Footer)
            ========================================== */}
        <View style={styles.footer}>
          <View style={styles.footerBrandRow}>
            <Image
              source={{ uri: '/icon.png' }}
              style={styles.footerLogoImg}
              resizeMode="contain"
            />
            <Text style={styles.footerBrand}>تلفازي | Telfazi</Text>
          </View>
          <Text style={styles.footerCopyright}>
            جميع الحقوق محفوظة © {new Date().getFullYear()} • أفضل تجربة بث رقمي للشاشات الذكية
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // التنبيه العائم (Toast)
  toastContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#131C31',
    borderWidth: 1,
    borderColor: '#0EA5E9',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#0EA5E9',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  // شريط الملاحة العلوي
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 18,
    backgroundColor: 'rgba(11, 17, 32, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(14, 165, 233, 0.15)',
    zIndex: 100,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandLogoImg: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  brandNameDivider: {
    fontSize: 16,
    fontWeight: '400',
    color: '#0EA5E9',
  },
  brandSubEn: {
    fontSize: 16,
    fontWeight: '800',
    color: '#94a3b8',
  },
  brandSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  navCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderWidth: 1,
    borderColor: '#0EA5E9',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  navCtaBtnFocused: {
    backgroundColor: '#0EA5E9',
    borderColor: '#ffffff',
    transform: [{ scale: 1.05 }],
  },
  navCtaBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  navCtaBtnTextFocused: {
    color: '#0B1120',
  },

  // قسم البطل (Hero)
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 48,
    maxWidth: 960,
    alignSelf: 'center',
    width: '100%',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  heroBadgeText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 52,
    marginBottom: 18,
  },
  textHighlight: {
    color: '#38bdf8',
  },
  heroDescription: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 28,
    maxWidth: 780,
    marginBottom: 32,
  },
  heroCtaWrapper: {
    marginBottom: 36,
  },
  primaryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#38bdf8',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#38bdf8',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryCtaBtnFocused: {
    backgroundColor: '#0284c7',
    borderColor: '#ffffff',
    borderWidth: 2,
    transform: [{ scale: 1.06 }],
  },
  primaryCtaBtnText: {
    color: '#070b14',
    fontSize: 17,
    fontWeight: '900',
  },
  primaryCtaBtnTextFocused: {
    color: '#ffffff',
  },
  statsPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statPillText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },

  // الأقسام العامة
  sectionContainer: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sectionHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 10,
  },
  sectionHeaderBadgeText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 620,
    lineHeight: 24,
  },

  // قسم التحميل
  downloadCardsGridWide: {
    flexDirection: 'row',
    gap: 24,
  },
  downloadCardsGridCol: {
    flexDirection: 'column',
    gap: 20,
  },
  downloadCard: {
    flex: 1,
    backgroundColor: '#131C31',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.2)',
    justifyContent: 'space-between',
  },
  downloadCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
  },
  downloadCardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
  },
  downloadCardSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 20,
  },
  featureList: {
    gap: 10,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureItemText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  downloadBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderWidth: 1,
    borderColor: '#0EA5E9',
    paddingVertical: 14,
    borderRadius: 12,
  },
  downloadBtnFocused: {
    backgroundColor: '#0EA5E9',
    borderColor: '#ffffff',
    transform: [{ scale: 1.04 }],
  },
  downloadBtnText: {
    color: '#0EA5E9',
    fontSize: 15,
    fontWeight: '800',
  },
  downloadBtnTextFocused: {
    color: '#0B1120',
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  versionBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  btnVersionTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    marginLeft: 4,
  },
  btnVersionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#818cf8',
  },
  downloadSubMeta: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
  directUrlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  directUrlText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  directUrlHighlight: {
    color: '#38bdf8',
    fontWeight: '700',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },

  // قسم المميزات
  featuresGridWide: {
    flexDirection: 'row',
    gap: 20,
  },
  featuresGridCol: {
    flexDirection: 'column',
    gap: 16,
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#131C31',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  featureIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  featureCardDesc: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
  },

  // البانر السفلي
  bottomBanner: {
    backgroundColor: '#131C31',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    maxWidth: 960,
    alignSelf: 'center',
    width: '90%',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.25)',
    marginVertical: 24,
  },
  bottomBannerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  bottomBannerSub: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
  },

  // التذييل (Footer)
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    marginTop: 20,
    gap: 6,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  footerLogoImg: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  footerBrand: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0EA5E9',
    letterSpacing: 0.5,
  },
  footerCopyright: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
});
