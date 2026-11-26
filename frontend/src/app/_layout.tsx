import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { MainLayout } from '../components/layout/MainLayout';
import { UpdateModal } from '../components/UpdateModal';

// تحميل الخطوط عبر expo-font على الويب مباشرة من المتصفح (كدعم runtime إضافي فوق +html.tsx)
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

// معالجة تلقائية لأخطاء تحميل الحزم (AsyncRequireError / ChunkLoadError)
// لا نلمس DOM بشكل متزامن أثناء تحميل الوحدة حتى لا نسبب Hydration mismatch
if (Platform.OS === 'web' && typeof window !== 'undefined') {
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
          if (!lastReload || now - Number(lastReload) > 10000) {
            window.sessionStorage?.setItem('telfazi_chunk_reload', String(now));
            console.warn('[ChunkReload] تم رصد خطأ في تحميل الحزمة، جاري إعادة التحميل...');
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
  const expoPathname = usePathname();
  const router = useRouter();
  const { token, isLoading, isAuthReady } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const rawExpoPath = (expoPathname || '').replace(/\/+$/, '') || '/';

  const isPublic =
    rawExpoPath === '/' ||
    rawExpoPath.startsWith('/admin') ||
    rawExpoPath.startsWith('/reseller') ||
    rawExpoPath.startsWith('/activate');

  useEffect(() => {
    // 1. التطبيقات الأصلية (أندرويد / Android TV): تجاوز صفحة الهبوط فوراً
    if (Platform.OS !== 'web') {
      if (!isAuthReady || isLoading) return;
      if (token) {
        if (rawExpoPath === '/' || rawExpoPath === '/activate') {
          router.replace('/home');
        }
      } else {
        if (rawExpoPath === '/') {
          router.replace('/activate');
        }
      }
      return;
    }

    // 2. بيئة الويب (Web):
    // ننتظر حتى يكتمل الـ mount وتكتمل قراءة بيانات التوثيق من التخزين المحلي / الكوكيز
    if (!isMounted || !isAuthReady || isLoading) return;

    // المسارات العامة (صفحة الهبوط، الإدارة، الموزعين): لا نقوم بأي توجيه قسري
    if (isPublic) {
      // فقط في حال كان المشترك مفعلاً بالفعل وتواجد داخل صفحة التفعيل /activate، نحوله للرئيسية
      if (token && rawExpoPath === '/activate') {
        router.replace('/home');
      }
      return;
    }

    // المسارات المحمية (/home, /movies, /simulated, إلخ):
    // إذا لم يتوفر اشتراك بعد اكتمال التحقق تماماً، نوجّهه لشاشة التفعيل حصراً
    if (!token) {
      router.replace('/activate');
    }
  }, [isMounted, isAuthReady, isLoading, token, isPublic, rawExpoPath, router]);

  // المسارات التي تعمل بملء الشاشة دون الشريط الجانبي (المشغل، صفحة البداية، وصفحات الإدارة/التفعيل)
  const isFullscreen =
    rawExpoPath.startsWith('/play') ||
    rawExpoPath.startsWith('/player') ||
    rawExpoPath === '/' ||
    rawExpoPath === '/activate' ||
    rawExpoPath === '/login' ||
    rawExpoPath.startsWith('/admin') ||
    rawExpoPath.startsWith('/reseller');

  // نحافظ دائماً على بقاء <Slot /> داخل شجرة الرندر وعدم استبدالها بشاشة تحميل منفصلة
  // حتى لا يتم تفكيك حالة التوجيه الحالية في Expo Router وإعادة المستخدم قسراً إلى الجذر (/)
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
