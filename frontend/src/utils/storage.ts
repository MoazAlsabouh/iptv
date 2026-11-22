import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

function getCookie(name: string): string | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string, maxAgeSeconds: number = 31536000): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; SameSite=Lax; Path=/`;
  } catch {}
}

function removeCookie(name: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=; Max-Age=0; SameSite=Lax; Path=/`;
  } catch {}
}

/**
 * طبقة تخزين موحدة ودائمة تعمل على كافة المنصات:
 * - على الويب: تستخدم localStorage و Cookies كطبقة حماية مضاعفة لمدة سنة (Max-Age=31536000)
 * - على أندرويد و Native: تستخدم AsyncStorage
 * - تضمن عدم استخدام sessionStorage إطلاقاً
 */
export const appStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        let val: string | null = null;
        if (typeof window !== 'undefined' && window.localStorage) {
          val = window.localStorage.getItem(key);
        }
        if (!val) {
          val = getCookie(key);
          if (val && typeof window !== 'undefined' && window.localStorage) {
            try {
              window.localStorage.setItem(key, val);
            } catch {}
          }
        }
        return val;
      }
      return await AsyncStorage.getItem(key);
    } catch (err) {
      console.warn(`[appStorage] Error reading key "${key}":`, err);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        setCookie(key, value, 31536000); // حفظ دائم لمدة سنة كاملة
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch (err) {
      console.warn(`[appStorage] Error writing key "${key}":`, err);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        removeCookie(key);
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch (err) {
      console.warn(`[appStorage] Error removing key "${key}":`, err);
    }
  },

  /**
   * قراءة متزامنة فورية على الويب كبديل مؤقت أثناء أول ريندر
   */
  getItemSync(key: string): string | null {
    if (Platform.OS === 'web') {
      try {
        let val = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null;
        if (!val) {
          val = getCookie(key);
          if (val && typeof window !== 'undefined' && window.localStorage) {
            try {
              window.localStorage.setItem(key, val);
            } catch {}
          }
        }
        return val;
      } catch {
        return null;
      }
    }
    return null;
  },
};

export default appStorage;
