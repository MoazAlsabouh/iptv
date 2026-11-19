import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Slot, usePathname, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { MainLayout } from '../components/layout/MainLayout';

/**
 * حارس التنقل العام للتحقق من وجود اشتراك نشط وتوجيه المستخدمين
 */
function NavigationGuard(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const isPublic = pathname === '/activate' || pathname.startsWith('/admin') || pathname.startsWith('/reseller');

    if (!token && !isPublic) {
      router.replace('/activate');
    } else if (token && pathname === '/activate') {
      router.replace('/');
    }
  }, [token, isLoading, pathname, router]);

  if (isLoading) {
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
    pathname.startsWith('/play/') ||
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
