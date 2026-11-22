const { withAndroidManifest, withGradleProperties, withMainActivity } = require('@expo/config-plugins');

/**
 * Expo Config Plugin لإعداد أندرويد وشاشات Android TV وتقليص حجم الـ APK:
 * 1. إضافة LEANBACK_LAUNCHER إلى MainActivity ليظهر التطبيق في القائمة الرئيسية للتلفاز.
 * 2. جعل ميزة شاشة اللمس touchscreen اختيارية (required="false") لتعمل على التلفاز والريموت.
 * 3. جعل ميزة leanback اختيارية (required="false") ليعمل التطبيق على الهواتف والتلفاز معاً.
 * 4. تفعيل usesCleartextTraffic في حال لم يتم تفعيلها عبر expo-build-properties.
 * 5. حصر المعماريات على الهواتف وشاشات التلفاز الحقيقية (arm64-v8a, armeabi-v7a) لتقليص حجم ملف APK بنسبة 50%.
 */
function withAndroidTV(config) {
  // 1. إعدادات AndroidManifest
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;

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

    // ضبط التطبيق والنشاط الرئيسي MainActivity
    const app = androidManifest.application?.[0];
    if (app) {
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

          if (!app.$['android:banner']) {
            app.$['android:banner'] = '@mipmap/ic_launcher';
          }
        }
      }
    }

    return config;
  });

  // 2. ضبط المعماريات في gradle.properties لتقليص حجم الـ APK
  config = withGradleProperties(config, (config) => {
    const properties = config.modResults;
    const archProp = properties.find(
      (item) => item.type === 'property' && item.key === 'reactNativeArchitectures'
    );
    if (archProp) {
      archProp.value = 'arm64-v8a,armeabi-v7a';
    } else {
      properties.push({
        type: 'property',
        key: 'reactNativeArchitectures',
        value: 'arm64-v8a,armeabi-v7a',
      });
    }
    return config;
  });

  // 3. تعديل MainActivity لإرسال أحداث ريموت Android TV عبر onTVKeyEvent
  config = withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('onTVKeyEvent')) {
      const dispatchKeyEventCode = `
  /**
   * إرسال أحداث أزرار ريموت Android TV إلى React Native عبر DeviceEventEmitter (onTVKeyEvent)
   */
  override fun dispatchKeyEvent(event: android.view.KeyEvent): Boolean {
    val keyCode = event.keyCode
    val action = event.action

    // إذا كان التركيز الحالي على حقل إدخال نصي (EditText)، نمرر الحدث مباشرة للنظام دون اعتراض
    val isEditTextFocused = currentFocus is android.widget.EditText

    if (action == android.view.KeyEvent.ACTION_DOWN && !isEditTextFocused) {
      val eventType = when (keyCode) {
        android.view.KeyEvent.KEYCODE_DPAD_UP -> "DPAD_UP"
        android.view.KeyEvent.KEYCODE_DPAD_DOWN -> "DPAD_DOWN"
        android.view.KeyEvent.KEYCODE_DPAD_LEFT -> "DPAD_LEFT"
        android.view.KeyEvent.KEYCODE_DPAD_RIGHT -> "DPAD_RIGHT"
        android.view.KeyEvent.KEYCODE_DPAD_CENTER -> "DPAD_CENTER"
        android.view.KeyEvent.KEYCODE_ENTER, android.view.KeyEvent.KEYCODE_NUMPAD_ENTER -> "ENTER"
        android.view.KeyEvent.KEYCODE_CHANNEL_UP -> "CHANNEL_UP"
        android.view.KeyEvent.KEYCODE_CHANNEL_DOWN -> "CHANNEL_DOWN"
        android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "PLAY_PAUSE"
        android.view.KeyEvent.KEYCODE_MEDIA_PLAY -> "PLAY"
        android.view.KeyEvent.KEYCODE_MEDIA_PAUSE -> "PAUSE"
        android.view.KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> "FAST_FORWARD"
        android.view.KeyEvent.KEYCODE_MEDIA_REWIND -> "REWIND"
        else -> null
      }

      if (eventType != null) {
        try {
          val params: com.facebook.react.bridge.WritableMap = com.facebook.react.bridge.Arguments.createMap().apply {
            putString("eventType", eventType)
            putInt("keyCode", keyCode)
            putInt("action", action)
          }
          reactInstanceManager?.currentReactContext
            ?.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("onTVKeyEvent", params)
        } catch (_: Exception) {}
      }
    }

    return super.dispatchKeyEvent(event)
  }
`;

      contents = contents.replace(
        'class MainActivity : ReactActivity() {',
        `class MainActivity : ReactActivity() {\n${dispatchKeyEventCode}`
      );

      config.modResults.contents = contents;
    }

    return config;
  });

  return config;
}

module.exports = withAndroidTV;
