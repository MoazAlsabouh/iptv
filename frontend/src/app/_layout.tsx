import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { Slot, usePathname, useRouter, useSegments } from 'expo-router';
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
  const segments = useSegments();
  const expoPathname = usePathname();
  const router = useRouter();
  const { token, isLoading } = useAuth();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1. فحص المقاطع عبر useSegments() من expo-router (يعمل بكفاءة عالية أثناء البناء الثابت والعميل)
  const firstSegment = segments && segments.length > 0 ? segments[0] : '';
  const rawExpoPath = (expoPathname || '').replace(/\/+$/, '') || '/';

  const isPublic =
    (segments as any[]).length === 0 || // الصفحة الرئيسية الجذرية /
    firstSegment === '' ||
    firstSegment === 'admin' ||
    firstSegment === 'reseller' ||
    firstSegment === 'activate' ||
    rawExpoPath === '/' ||
    rawExpoPath.startsWith('/admin') ||
    rawExpoPath.startsWith('/reseller') ||
    rawExpoPath.startsWith('/activate');

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
    if (token && (firstSegment === 'activate' || rawExpoPath === '/activate')) {
      router.replace('/home');
    }
  }, [token, isLoading, firstSegment, rawExpoPath, router]);

  // لا نعرض شاشة التحميل إلا بعد اكتمال mount على العميل للمسارات المحمية فقط
  // هذا يضمن تطابق شجرة DOM بنسبة 100% بين خادم الـ SSR وأول ريندر على المتصفح
  if (isMounted && isLoading && !isPublic) {
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

  // المسارات التي تعمل بملء الشاشة دون الشريط الجانبي (المشغل، صفحة البداية، وصفحات الإدارة/التفعيل)
  const isFullscreen =
    rawExpoPath.startsWith('/play') ||
    rawExpoPath.startsWith('/player') ||
    rawExpoPath === '/' ||
    rawExpoPath === '/activate' ||
    rawExpoPath === '/login' ||
    rawExpoPath.startsWith('/admin') ||
    rawExpoPath.startsWith('/reseller');

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
