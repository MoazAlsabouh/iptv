import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { MainLayout } from '../components/layout/MainLayout';

// حقن تعريفات الخطوط الصريحة في document.head فوراً على بيئة الويب لتفادي أخطاء OTS parsing error
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
}

/**
 * حارس التنقل العام للتحقق من وجود اشتراك نشط وتوجيه المستخدمين
 */
function NavigationGuard(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { token, isLoading } = useAuth();

  const isPublic =
    pathname === '/' ||
    pathname === '/activate' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/reseller');

  useEffect(() => {
    if (isLoading) return;

    if (!token && !isPublic) {
      router.replace('/activate');
    } else if (token && pathname === '/activate') {
      router.replace('/home');
    }
  }, [token, isLoading, pathname, router, isPublic]);

  // لا نعرض شاشة التحميل للمسارات العامة مثل الصفحة التعريفية / أو شاشة التفعيل / أو الإدارة
  if (isLoading && !isPublic) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#070b14',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={{ color: '#94a3b8', marginTop: 16, fontSize: 16, fontWeight: '700' }}>
          جاري التحقق من الاشتراك...
        </Text>
      </View>
    );
  }

  // المشغل، شاشة التفعيل، ولوحة الإدارة تعمل في وضع ملء الشاشة دون الشريط الجانبي
  const isFullscreen =
    pathname === '/' ||
    pathname.startsWith('/play/') ||
    pathname.startsWith('/player') ||
    pathname === '/activate' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/reseller');

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
