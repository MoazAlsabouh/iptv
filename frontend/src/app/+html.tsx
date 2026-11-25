import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import React from 'react';

/**
 * ملف تهيئة مستند HTML الجذري لجميع صفحات الويب أثناء البناء الثابت (SSG / SSR).
 * يضمن ثبات السمات (lang="ar" dir="rtl") وحقن الخطوط والأيقونات مباشرة داخل <head>
 * دون أي تعديل ديناميكي أثناء تحميل العميل لتفادي خطأ Hydration mismatch #418.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  return (
    <html lang="ar" dir="rtl" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>تلفازي | Telfazi</title>
        <link rel="icon" type="image/png" href="/icon.png" />
        <link rel="shortcut icon" href="/icon.png" />

        {/* إعادة تعيين أنماط التمرير على الويب لتطابق بيئة التطبيق */}
        <ScrollViewStyleReset />

        {headNodes}

        {/* حقن تعريفات الخطوط الأساسية داخل HEAD أثناء الـ SSR */}
        <style
          id="expo-vector-icons-fonts"
          dangerouslySetInnerHTML={{
            __html: `
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
            `,
          }}
        />
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
