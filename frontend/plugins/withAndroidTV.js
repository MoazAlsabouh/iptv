const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin لإضافة دعم شاشات Android TV (Leanback)
 * 1. إضافة LEANBACK_LAUNCHER إلى MainActivity ليظهر التطبيق في القائمة الرئيسية للتلفاز.
 * 2. جعل ميزة شاشة اللمس touchscreen اختيارية (required="false") لتعمل على التلفاز والريموت.
 * 3. جعل ميزة leanback اختيارية (required="false") ليعمل التطبيق على الهواتف والتلفاز معاً.
 * 4. تفعيل usesCleartextTraffic في حال لم يتم تفعيلها عبر expo-build-properties.
 */
function withAndroidTV(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;

    // 1. إعداد uses-feature
    if (!androidManifest['uses-feature']) {
      androidManifest['uses-feature'] = [];
    }

    const features = androidManifest['uses-feature'];

    // جعل شاشة اللمس اختيارية لتعمل مع ريموت التلفاز
    const touchscreenIdx = features.findIndex(
      (f) => f.$ && f.$['android:name'] === 'android.hardware.touchscreen'
    );
    if (touchscreenIdx >= 0) {
      features[touchscreenIdx].$['android:required'] = 'false';
    } else {
      features.push({
        $: {
          'android:name': 'android.hardware.touchscreen',
          'android:required': 'false',
        },
      });
    }

    // جعل واجهة leanback اختيارية ليعمل التطبيق على الهواتف والشاشات معاً
    const leanbackIdx = features.findIndex(
      (f) => f.$ && f.$['android:name'] === 'android.software.leanback'
    );
    if (leanbackIdx >= 0) {
      features[leanbackIdx].$['android:required'] = 'false';
    } else {
      features.push({
        $: {
          'android:name': 'android.software.leanback',
          'android:required': 'false',
        },
      });
    }

    // 2. ضبط التطبيق والنشاط الرئيسي MainActivity
    const app = androidManifest.application?.[0];
    if (app) {
      // التأكد من تفعيل حركة مرور النصوص غير المشفرة لروابط البث المباشر HTTP
      app.$['android:usesCleartextTraffic'] = 'true';

      if (app.activity && app.activity.length > 0) {
        const mainActivity =
          app.activity.find(
            (a) =>
              a.$ &&
              (a.$['android:name'] === '.MainActivity' ||
                a.$['android:name'] === 'MainActivity')
          ) || app.activity[0];

        if (mainActivity) {
          if (!mainActivity['intent-filter']) {
            mainActivity['intent-filter'] = [];
          }

          const intentFilters = mainActivity['intent-filter'];
          // البحث عن فلتر MAIN
          let mainFilter = intentFilters.find((filter) =>
            filter.action?.some(
              (act) => act.$?.['android:name'] === 'android.intent.action.MAIN'
            )
          );

          if (mainFilter) {
            if (!mainFilter.category) {
              mainFilter.category = [];
            }
            const hasLeanback = mainFilter.category.some(
              (cat) =>
                cat.$?.['android:name'] ===
                'android.intent.category.LEANBACK_LAUNCHER'
            );
            if (!hasLeanback) {
              mainFilter.category.push({
                $: {
                  'android:name': 'android.intent.category.LEANBACK_LAUNCHER',
                },
              });
            }
          } else {
            intentFilters.push({
              action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
              category: [
                { $: { 'android:name': 'android.intent.category.LAUNCHER' } },
                {
                  $: {
                    'android:name': 'android.intent.category.LEANBACK_LAUNCHER',
                  },
                },
              ],
            });
          }

          // تعيين بانر التلفاز الافتراضي إلى أيقونة التطبيق
          if (!app.$['android:banner']) {
            app.$['android:banner'] = '@mipmap/ic_launcher';
          }
        }
      }
    }

    return config;
  });
}

module.exports = withAndroidTV;
