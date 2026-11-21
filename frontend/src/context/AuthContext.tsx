import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { appStorage } from '../utils/storage';

export const BACKEND_BASE_URL = 'https://iptv-backend.moaznsm.workers.dev';

export interface SubscriptionInfo {
  code: string;
  expiresAt: string;
  remainingDays: number;
  maxDevices: number;
  status: string;
  note?: string;
}

export interface AuthContextType {
  token: string | null;
  subscription: SubscriptionInfo | null;
  deviceId: string;
  deviceName: string;
  isLoading: boolean;
  activate: (code: string, deviceName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'iptv_auth_token';
const SUB_KEY = 'iptv_sub_info';
const DEVICE_ID_KEY = 'iptv_device_id';
const DEVICE_NAME_KEY = 'iptv_device_name';

function getInitialDeviceIdSync(): string {
  const syncId = appStorage.getItemSync(DEVICE_ID_KEY);
  if (syncId) return syncId;
  return 'dev_' + Math.random().toString(36).substring(2, 9);
}

function getInitialDeviceNameSync(): string {
  const syncName = appStorage.getItemSync(DEVICE_NAME_KEY);
  if (syncName) return syncName;

  if (Platform.OS === 'web') {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    let name = 'متصفح ويب';
    if (/SmartTV|Tizen|Web0S|NetCast|Android TV|AppleTV/i.test(userAgent)) {
      name = 'شاشة التلفاز';
    } else if (/Android/i.test(userAgent)) {
      name = 'هاتف أندرويد';
    } else if (/iPhone/i.test(userAgent)) {
      name = 'هاتف آيفون';
    } else if (/iPad/i.test(userAgent)) {
      name = 'جهاز آيباد';
    } else if (/Windows/i.test(userAgent)) {
      name = 'كمبيوتر ويندوز';
    } else if (/Macintosh/i.test(userAgent)) {
      name = 'كمبيوتر ماك';
    }
    return name;
  }

  if (Platform.isTV) {
    return 'شاشة التلفاز';
  }

  return 'هاتف محمول';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => appStorage.getItemSync(TOKEN_KEY));
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(() => {
    try {
      const s = appStorage.getItemSync(SUB_KEY);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const [deviceId, setDeviceId] = useState<string>(getInitialDeviceIdSync);
  const [deviceName, setDeviceName] = useState<string>(getInitialDeviceNameSync);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // استرجاع الجلسة المحفوظة والتحقق من صحتها عبر الخادم
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        // 1. تحميل أو توليد وحفظ معرّف الجهاز الثابت
        let currentDeviceId = await appStorage.getItem(DEVICE_ID_KEY);
        if (!currentDeviceId) {
          currentDeviceId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
          await appStorage.setItem(DEVICE_ID_KEY, currentDeviceId);
        }
        if (isMounted) {
          setDeviceId(currentDeviceId);
        }

        // 2. تحميل أو توليد وحفظ اسم الجهاز
        let currentDeviceName = await appStorage.getItem(DEVICE_NAME_KEY);
        if (!currentDeviceName) {
          currentDeviceName = getInitialDeviceNameSync();
          await appStorage.setItem(DEVICE_NAME_KEY, currentDeviceName);
        }
        if (isMounted) {
          setDeviceName(currentDeviceName);
        }

        // 3. استرجاع رمز التوثيق وبيانات الاشتراك
        const savedToken = await appStorage.getItem(TOKEN_KEY);
        const savedSub = await appStorage.getItem(SUB_KEY);

        if (savedToken) {
          if (isMounted) {
            setToken(savedToken);
            if (savedSub) {
              try {
                setSubscription(JSON.parse(savedSub));
              } catch {}
            }
          }

          // استعادة المفضلات من التخزين المحلي فوراً
          useAppStore.getState().loadFavoritesFromStorage?.();

          // التحقق من صحة الجلسة مع الخادم
          try {
            const res = await fetch(`${BACKEND_BASE_URL}/api/auth/me`, {
              headers: {
                Authorization: `Bearer ${savedToken}`,
              },
            });

            if (res.ok) {
              const data = await res.json();
              if (isMounted && data.valid && data.subscription) {
                setSubscription(data.subscription);
                await appStorage.setItem(SUB_KEY, JSON.stringify(data.subscription));
                useAppStore.getState().syncFavorites(savedToken);
              }
            } else if (res.status === 401 || res.status === 403) {
              // الرمز منتهٍ أو ملغى رسمياً من الخادم
              if (isMounted) {
                setToken(null);
                setSubscription(null);
                await appStorage.removeItem(TOKEN_KEY);
                await appStorage.removeItem(SUB_KEY);
              }
            }
          } catch (netErr) {
            // في حال حدوث خطأ شبكة مؤقت، نبقي الجلسة المحلية حتى لا يُطرد المستخدم
            console.warn('[Auth] Network issue verifying session with server:', netErr);
          }
        }
      } catch (err) {
        console.warn('[Auth] Failed to initialize auth:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // تفعيل كود الاشتراك
  const activate = useCallback(
    async (code: string, customDeviceName?: string) => {
      try {
        const dName = customDeviceName || deviceName;
        const res = await fetch(`${BACKEND_BASE_URL}/api/auth/activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: code.trim().toUpperCase(),
            deviceId,
            deviceName: dName,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.token) {
          return {
            success: false,
            error: data.error || 'فشل تفعيل الاشتراك، يرجى التأكد من صحة الكود',
          };
        }

        setToken(data.token);
        setSubscription(data.subscription);

        // حفظ التوكن ومعلومات الاشتراك في التخزين الموحد (Web / AsyncStorage)
        await appStorage.setItem(TOKEN_KEY, data.token);
        await appStorage.setItem(SUB_KEY, JSON.stringify(data.subscription));

        useAppStore.getState().syncFavorites(data.token);

        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: 'تعذر الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت',
        };
      }
    },
    [deviceId, deviceName]
  );

  // تسجيل الخروج وفك الجلسة
  const logout = useCallback(async () => {
    setToken(null);
    setSubscription(null);
    await appStorage.removeItem(TOKEN_KEY);
    await appStorage.removeItem(SUB_KEY);
  }, []);

  // تحديث حالة الاشتراك من الخادم
  const refreshAuth = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.valid && data.subscription) {
          setSubscription(data.subscription);
          await appStorage.setItem(SUB_KEY, JSON.stringify(data.subscription));
        }
      }
    } catch {}
  }, [token]);

  // استدعاء محمي يضيف ترويسة التوثيق تلقائياً
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return fetch(url, { ...options, headers });
    },
    [token]
  );

  return (
    <AuthContext.Provider
      value={{
        token,
        subscription,
        deviceId,
        deviceName,
        isLoading,
        activate,
        logout,
        refreshAuth,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
