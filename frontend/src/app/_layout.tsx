import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Font from 'expo-font';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { MainLayout } from '../components/layout/MainLayout';

// تحميل الخطوط عبر expo-font على الويب مباشرة من المسار الثابت /fonts/...
// هذا يمنع @expo/vector-icons من طلب ملفات الخط من /assets/node_modules/... نهائياً
if (Platform.OS === 'web') {
  Font.loadAsync({
    MaterialIcons: '/fonts/MaterialIcons.ttf',
    material: '/fonts/MaterialIcons.ttf',
    Ionicons: '/fonts/Ionicons.ttf',
    ionicons: '/fonts/Ionicons.ttf',
    MaterialCommunityIcons: '/fonts/MaterialCommunityIcons.ttf',
    'material-community': '/fonts/MaterialCommunityIcons.ttf',
    Feather: '/fonts/Feather.ttf',
    feather: '/fonts/Feather.ttf',
    FontAwesome: '/fonts/FontAwesome.ttf',
    AntDesign: '/fonts/AntDesign.ttf',
    Fontisto: '/fonts/Fontisto.ttf',
    Octicons: '/fonts/Octicons.ttf',
    SimpleLineIcons: '/fonts/SimpleLineIcons.ttf',
    Foundation: '/fonts/Foundation.ttf',
    Zocial: '/fonts/Zocial.ttf',
  }).catch((err) => {
    console.warn('[Font] Failed to load static fonts via expo-font:', err);
  });
}

// حقن تعريفات الخطوط الصريحة في document.head فوراً على بيئة الويب كدعم إضافي
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const fontStyleId = 'expo-vector-icons-fonts';
  if (!document.getElementById(fontStyleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = fontStyleId;
    styleEl.textContent = `
      @font-face {
        font-family: 'MaterialIcons';
        src: url('/fonts/MaterialIcons.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'material';
        src: url('/fonts/MaterialIcons.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'Ionicons';
        src: url('/fonts/Ionicons.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'ionicons';
        src: url('/fonts/Ionicons.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'MaterialCommunityIcons';
        src: url('/fonts/MaterialCommunityIcons.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'material-community';
        src: url('/fonts/MaterialCommunityIcons.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'Feather';
        src: url('/fonts/Feather.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'feather';
        src: url('/fonts/Feather.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'FontAwesome';
        src: url('/fonts/FontAwesome.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'AntDesign';
        src: url('/fonts/AntDesign.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'Fontisto';
        src: url('/fonts/Fontisto.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'Octicons';
        src: url('/fonts/Octicons.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'SimpleLineIcons';
        src: url('/fonts/SimpleLineIcons.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'Foundation';
        src: url('/fonts/Foundation.ttf') format('truetype');
        font-display: swap;
      }
      @font-face {
        font-family: 'Zocial';
        src: url('/fonts/Zocial.ttf') format('truetype');
        font-display: swap;
      }
    `;
    document.head.prepend(styleEl);
  }

  // ضبط عنوان الصفحة والأيقونة (Favicon) للهوية البصرية الجديدة
  document.title = 'تلفازي | Telfazi';
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'shortcut icon';
    document.head.appendChild(link);
  }
  link.href = '/icon.png';
}

/**
 * دالة مساعدة لحساب المسار وتطبيع الشرطة المائلة مع قراءة window.location.pathname فورياً على الويب
 */
function getNormalizedPath(expoPathname: string | null | undefined): string {
  let raw = expoPathname || '';
  if (!raw && Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.pathname) {
    raw = window.location.pathname;
  }
  if (!raw) {
    raw = '/';
  }
  // إزالة أي شرطات مائلة متكررة في النهاية مع الحفاظ على الجذر '/'
  return raw.replace(/\/+$/, '') || '/';
}

/**
 * حارس التنقل العام للتحقق من وجود اشتراك نشط وتوجيه المستخدمين
 */
function NavigationGuard(): React.JSX.Element {
  const expoPathname = usePathname();
  const router = useRouter();
  const { token, isLoading } = useAuth();

  // الحصول على المسار المطبع فوراً (بدون انتظار تهيئة usePathname على الويب)
  const normalizedPath = getNormalizedPath(expoPathname);

  // تحديد المسارات العامة المستثناة من حماية الاشتراك وشاشات الانتظار
  const isPublic =
    normalizedPath === '/' ||
    normalizedPath.startsWith('/admin') ||
    normalizedPath.startsWith('/reseller') ||
    normalizedPath.startsWith('/activate');

  useEffect(() => {
    // منع أي تحويل تلقائي للمسارات العامة لمنع التعليق
    if (isPublic) return;

    if (isLoading) return;

    if (!token) {
      router.replace('/activate');
    }
  }, [token, isLoading, router, isPublic]);

  // توجيه المستخدم المشترك خارج صفحة التفعيل فقط إذا كان في /activate
  useEffect(() => {
    if (isLoading) return;
    if (token && normalizedPath === '/activate') {
      router.replace('/home');
    }
  }, [token, isLoading, normalizedPath, router]);

  // لا نعرض شاشة التحميل للمسارات العامة إطلاقاً حتى لو كان isLoading === true
  if (isLoading && !isPublic) {
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
        <Text style={{ color: '#94a3b8', marginTop: 16, fontSize: 16, fontWeight: '700' }}>
          جاري التحقق من الاشتراك...
        </Text>
      </View>
    );
  }

  // المسارات العامة والمشغل تعمل بملء الشاشة دون الشريط الجانبي
  const isFullscreen =
    isPublic ||
    normalizedPath.startsWith('/play') ||
    normalizedPath.startsWith('/player');

  return isFullscreen ? (
    <Slot />
  ) : (
    <MainLayout>
      <Slot />
    </MainLayout>
  );
}

/**
 * نقطة الدخول والتخطيط الجذري لـ Expo Router مع تزويد AuthProvider و React Query.
 */
export default function RootLayout(): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 2,
            staleTime: 1000 * 60 * 30, // 30 دقيقة
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationGuard />
      </AuthProvider>
    </QueryClientProvider>
  );
}
