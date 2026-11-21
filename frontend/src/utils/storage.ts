import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * طبقة تخزين موحدة تعمل على كافة المنصات:
 * - على الويب: تستخدم localStorage
 * - على أندرويد و Native: تستخدم AsyncStorage
 */
export const appStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
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
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return null;
  },
};

export default appStorage;
