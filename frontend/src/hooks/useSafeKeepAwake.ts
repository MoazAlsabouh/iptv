import { useEffect } from 'react';
import { Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/**
 * Hook آمن لإبقاء الشاشة مفعلة أثناء تشغيل الفيديو والبث المباشر.
 * يتفادى أخطاء expo-keep-awake على الويب (مثل "The wake lock with tag ... has not activated yet").
 *
 * @param tag معرف اختياري لقفل الشاشة على الأنظمة الأصلية
 */
export function useSafeKeepAwake(tag: string = 'IPTV_PLAYER_WAKE_LOCK'): void {
  useEffect(() => {
    let isMounted = true;

    if (Platform.OS === 'web') {
      let wakeLockSentinel: any = null;

      const requestWakeLock = async () => {
        try {
          if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock?.request) {
            const lock = await (navigator as any).wakeLock.request('screen');
            if (isMounted) {
              wakeLockSentinel = lock;
            } else {
              // في حال إلغاء تحميل المكون قبل اكتمال طلب القفل
              lock.release().catch(() => {});
            }
          }
        } catch {
          // تجاهل الأخطاء بهدوء (مثل منع المتصفح أو عدم دعم الشاشة)
        }
      };

      requestWakeLock();

      const handleVisibilityChange = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !wakeLockSentinel) {
          requestWakeLock();
        }
      };

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }

      return () => {
        isMounted = false;
        if (typeof document !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
        if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
          try {
            wakeLockSentinel.release().catch(() => {});
          } catch {
            // تجاهل أي استثناء عند التحرير
          }
          wakeLockSentinel = null;
        }
      };
    } else {
      // الأنظمة الأصلية (Android TV / Fire TV / iOS)
      try {
        activateKeepAwakeAsync(tag).catch(() => {});
      } catch {
        // تجاهل
      }

      return () => {
        try {
          deactivateKeepAwake(tag).catch(() => {});
        } catch {
          // تجاهل
        }
      };
    }
  }, [tag]);
}
