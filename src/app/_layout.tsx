import React, { useState } from 'react';
import { Slot, usePathname } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from '../components/layout/MainLayout';

/**
 * نقطة الدخول والتخطيط الجذري لـ Expo Router.
 * يقوم بتهيئة React Query وتوفير التخطيط العام MainLayout، مع استثناء مسار المشغل (/play/)
 * ليعمل بوضع ملء الشاشة الكامل وبدون الشريط الجانبي.
 */
export default function RootLayout(): React.JSX.Element {
  const pathname = usePathname();

  // تهيئة عميل React Query مرة واحدة فقط لضمان بقاء البيانات المخزنة مؤقتاً
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

  // إذا كان المسار يخص مشغل الفيديو، نعرض المحتوى في وضع ملء الشاشة دون الشريط الجانبي
  const isPlayerScreen = pathname.startsWith('/play/');

  return (
    <QueryClientProvider client={queryClient}>
      {isPlayerScreen ? (
        <Slot />
      ) : (
        <MainLayout>
          <Slot />
        </MainLayout>
      )}
    </QueryClientProvider>
  );
}
