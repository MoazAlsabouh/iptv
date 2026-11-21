import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { Slot, usePathname, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { MainLayout } from '../components/layout/MainLayout';
import { UpdateModal } from '../components/UpdateModal';

// تحميل الخطوط عبر expo-font على الويب مباشرة من المتصفح
// هذا يمنع @expo/vector-icons من طلب ملفات الخط من /assets/node_modules/... نهائياً
if (Platform.OS === 'web' && typeof window !== 'undefined') {
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

  // معالجة تلقائية لأخطاء تحميل الحزم والوحدات المجزأة (Chunks) مثل AsyncRequireError عند نشر إصدار جديد أو انقطاع الشبكة
  const win = window as any;
  if (!win.__telfazi_chunk_handler_attached) {
    win.__telfazi_chunk_handler_attached = true;

    const handleChunkError = (rawError: any) => {
      try {
        const errorMsg = String(
          rawError?.message ||
          rawError?.reason?.message ||
          rawError?.reason ||
          rawError?.error?.message ||
          rawError ||
          ''
        ).toLowerCase();

        const isChunkError =
          errorMsg.includes('asyncrequireerror') ||
          errorMsg.includes('loading module') ||
          errorMsg.includes('chunkloaderror') ||
          errorMsg.includes('failed to fetch dynamically imported module');

        if (isChunkError) {
          const lastReload = window.sessionStorage?.getItem('telfazi_chunk_reload');
          const now = Date.now();
          // منع الدخول في حلقة إعادة تحميل متكررة إذا حدثت خلال آخر 10 ثوانٍ
          if (!lastReload || now - Number(lastReload) > 10000) {
            window.sessionStorage?.setItem('telfazi_chunk_reload', String(now));
            console.warn('[ChunkReload] تم رصد خطأ في تحميل الحزمة المجزأة، جاري إعادة تحميل الصفحة لجلب أحدث إصدار...');
            window.location.reload();
          }
        }
      } catch {}
    };

    window.addEventListener('error', (event) => {
      handleChunkError(event.error || event.message);
    });

    window.addEventListener('unhandledrejection', (event) => {
      handleChunkError(event.reason);
    });
  }
}

/**
 * حارس التنقل العام للتحقق من وجود اشتراك نشط وتوجيه المستخدمين
 */
function NavigationGuard(): React.JSX.Element {
  const segments = useSegments();
  const expoPathname = usePathname();
  const router = useRouter();
  const { token, isLoading } = useAuth();

  // 1. فحص المقاطع عبر useSegments() من expo-router (يعمل بكفاءة عالية أثناء البناء الثابت والعميل)
  const firstSegment = segments && segments.length > 0 ? segments[0] : '';
  const isSegmentPublic =
    segments.length === 0 || // الصفحة الرئيسية الجذرية /
    firstSegment === 'admin' ||
    firstSegment === 'reseller' ||
    firstSegment === 'activate';

  // 2. فحص المسار عبر window.location.pathname على الويب كبديل فوري متزامن
  let browserPath = '';
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.pathname) {
    browserPath = window.location.pathname.replace(/\/+$/, '') || '/';
  }

  // 3. فحص المسار عبر usePathname()
  const rawExpoPath = (expoPathname || '').replace(/\/+$/, '') || '/';

  const isBrowserPathPublic =
    browserPath === '/' ||
    browserPath.startsWith('/admin') ||
    browserPath.startsWith('/reseller') ||
    browserPath.startsWith('/activate');

  const isExpoPathPublic =
    rawExpoPath === '/' ||
    rawExpoPath.startsWith('/admin') ||
    rawExpoPath.startsWith('/reseller') ||
    rawExpoPath.startsWith('/activate');

  // المسار عام إذا تحقق أي شرط من الشروط الثلاثة
  const isPublic = isSegmentPublic || isBrowserPathPublic || isExpoPathPublic;

  useEffect(() => {
    // على التطبيقات الأصلية (أندرويد/تلفاز)، تجاوز صفحة الهبوط التسويقية والتوجه فوراً للمنصة
    if (Platform.OS !== 'web') {
      if (isLoading) return;
      if (token) {
        if (firstSegment === '' || firstSegment === 'activate' || rawExpoPath === '/' || rawExpoPath === '/activate') {
          router.replace('/home');
        }
      } else {
        if (firstSegment === '' || rawExpoPath === '/') {
          router.replace('/activate');
        }
      }
      return;
    }

    // منع أي تحويل تلقائي للمسارات العامة لمنع التعليق
    if (isPublic) return;

    if (isLoading) return;

    if (!token) {
      router.replace('/activate');
    }
  }, [token, isLoading, router, isPublic, firstSegment, rawExpoPath]);

  // توجيه المستخدم المشترك خارج صفحة التفعيل فقط إذا كان في /activate
  useEffect(() => {
    if (isLoading) return;
    if (
      token &&
      (firstSegment === 'activate' ||
        rawExpoPath === '/activate' ||
        browserPath === '/activate')
    ) {
      router.replace('/home');
    }
  }, [token, isLoading, firstSegment, rawExpoPath, browserPath, router]);

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
    firstSegment === 'play' ||
    firstSegment === 'player' ||
    rawExpoPath.startsWith('/play') ||
    browserPath.startsWith('/play');

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
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationGuard />
          <UpdateModal />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
