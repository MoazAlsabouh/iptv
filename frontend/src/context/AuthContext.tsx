import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

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

function getInitialDeviceId(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }
  return 'dev_' + Math.random().toString(36).substring(2, 9);
}

function getInitialDeviceName(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(DEVICE_NAME_KEY);
    if (saved) return saved;

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    let name = 'متصفح ويب';
    if (/SmartTV|Tizen|Web0S|NetCast|Android TV|AppleTV/i.test(userAgent)) {
      name = 'تلفاز ذكي (Smart TV)';
    } else if (/Android/i.test(userAgent)) {
      name = 'جهاز أندرويد';
    } else if (/iPhone|iPad/i.test(userAgent)) {
      name = 'جهاز آبل';
    } else if (/Windows/i.test(userAgent)) {
      name = 'كمبيوتر ويندوز';
    } else if (/Macintosh/i.test(userAgent)) {
      name = 'كمبيوتر ماك';
    }
    window.localStorage.setItem(DEVICE_NAME_KEY, name);
    return name;
  }
  return 'شاشة التلفاز';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [deviceId] = useState<string>(getInitialDeviceId);
  const [deviceName] = useState<string>(getInitialDeviceName);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // استرجاع الجلسة المحفوظة والتحقق من صحتها عبر الخادم
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          const savedToken = window.localStorage.getItem(TOKEN_KEY);
          const savedSub = window.localStorage.getItem(SUB_KEY);

          if (savedToken) {
            setToken(savedToken);
            if (savedSub) {
              try {
                setSubscription(JSON.parse(savedSub));
              } catch {}
            }

            // التحقق من الخادم
            const res = await fetch(`${BACKEND_BASE_URL}/api/auth/me`, {
              headers: {
                Authorization: `Bearer ${savedToken}`,
              },
            });

            if (res.ok) {
              const data = await res.json();
              if (isMounted && data.valid && data.subscription) {
                setSubscription(data.subscription);
                window.localStorage.setItem(SUB_KEY, JSON.stringify(data.subscription));
              }
            } else {
              // الرمز منتهٍ أو ملغى
              if (isMounted) {
                setToken(null);
                setSubscription(null);
                window.localStorage.removeItem(TOKEN_KEY);
                window.localStorage.removeItem(SUB_KEY);
              }
            }
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

        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(TOKEN_KEY, data.token);
          window.localStorage.setItem(SUB_KEY, JSON.stringify(data.subscription));
        }

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
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(SUB_KEY);
    }
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
          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(SUB_KEY, JSON.stringify(data.subscription));
          }
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
