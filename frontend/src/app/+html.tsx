import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * هذا الملف يعمل فقط على بيئة الويب لتخصيص HTML الأساسي.
 * يحدد خطوط @expo/vector-icons بمسارات مطلقة ثابتة لتفادي أخطاء OTS parsing error على Cloudflare Pages.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>شاشة بلس | منصة البث التلفزيوني والسينمائي</title>

        {/* إعادة ضبط تمرير الصفحة لمحاكاة بيئة الهاتف والتلفاز */}
        <ScrollViewStyleReset />

        {/* تحميل خطوط الأيقونات مباشرة عبر مسارات مطلقة تفادياً لإرجاع صفحة HTML بدلاً من ملف الخط */}
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

              body {
                background-color: #0b0f19;
                color: #f8fafc;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
