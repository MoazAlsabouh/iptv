import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { appStorage } from '../utils/storage';

export const BACKEND_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://iptv-backend.moaznsm.workers.dev';

export const TOKEN_KEY = 'iptv_auth_token';
export const ACTIVATION_CODE_KEY = 'iptv_activation_code';
export const SUB_KEY = 'iptv_sub_info';
export const DEVICE_ID_KEY = 'iptv_device_id';
export const DEVICE_NAME_KEY = 'iptv_device_name';

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
  activationCode: string | null;
  subscription: SubscriptionInfo | null;
  deviceId: string;
  deviceName: string;
  isLoading: boolean;
  isAuthReady: boolean;
  activate: (code: string, deviceName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  silentReauth: (codeToUse?: string) => Promise<{ success: boolean; token?: string; error?: string }>;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getInitialDeviceIdSync(): string {
  const syncId = appStorage.getItemSync(DEVICE_ID_KEY);
  if (syncId) return syncId;
  const newId = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(DEVICE_ID_KEY, newId);
    } catch {}
  }
  return newId;
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
  const [token, setToken] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);

  // مراجع لحفظ أحدث القيم لتجنب مشاكل الـ closures أثناء استدعاءات الخلفية
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;
  const activationCodeRef = useRef<string | null>(activationCode);
  activationCodeRef.current = activationCode;
  const isReauthingRef = useRef<boolean>(false);

  // دالة إعادة التفعيل الصامت التلقائي في الخلفية (Silent Auto-Reauth)
  const silentReauth = useCallback(
    async (codeToUse?: string): Promise<{ success: boolean; token?: string; error?: string }> => {
      // منع استدعاءات التجديد المتزامنة المتكررة
      if (isReauthingRef.current) {
        return { success: false, error: 'جاري التجديد في الخلفية بالفعل' };
      }

      const targetCode = (
        codeToUse ||
        activationCodeRef.current ||
        (await appStorage.getItem(ACTIVATION_CODE_KEY)) ||
        ''
      ).trim().toUpperCase();

      if (!targetCode) {
        return { success: false, error: 'لا يوجد كود تفعيل محفوظ محلياً' };
      }

      isReauthingRef.current = true;
      try {
        const currentDevId = deviceId || (await appStorage.getItem(DEVICE_ID_KEY)) || '';
        const currentDevName = deviceName || (await appStorage.getItem(DEVICE_NAME_KEY)) || 'جهاز تيلفازي';

        const res = await fetch(`${BACKEND_BASE_URL}/api/auth/activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: targetCode,
            deviceId: currentDevId,
            deviceName: currentDevName,
          }),
        });

        // أخطاء السيرفر العابرة (5xx, 502, 503, 504) لا تلغي الجلسة
        if (res.status >= 500) {
          console.warn('[silentReauth] Server error (5xx), preserving local session.');
          return { success: false, error: 'خطأ مؤقت في الخادم' };
        }

        const data = await res.json().catch(() => null);

        if (res.ok && data?.token) {
          console.log('[silentReauth] Session renewed successfully in background.');
          setToken(data.token);
          setActivationCode(targetCode);
          if (data.subscription) {
            setSubscription(data.subscription);
            await appStorage.setItem(SUB_KEY, JSON.stringify(data.subscription));
          }
          await appStorage.setItem(TOKEN_KEY, data.token);
          await appStorage.setItem(ACTIVATION_CODE_KEY, targetCode);

          useAppStore.getState().syncFavorites(data.token);
          return { success: true, token: data.token };
        }

        // رفض صريح ومؤكد من السيرفر (401/403/404)
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          const errMsg = data?.error || 'انتهت صلاحية الاشتراك أو تم إلغاؤه';
          console.warn('[silentReauth] Explicit rejection from server:', errMsg);
          return { success: false, error: errMsg };
        }

        return { success: false, error: data?.error || 'فشل التجديد التلقائي' };
      } catch (netErr) {
        // انقطاع الشبكة أو تعذر الاتصال: نحافظ على الجلسة الحالية
        console.warn('[silentReauth] Network exception during reauth, preserving session:', netErr);
        return { success: false, error: 'تعذر الاتصال بالخادم' };
      } finally {
        isReauthingRef.current = false;
      }
    },
    [deviceId, deviceName]
  );

  // استرجاع الجلسة المحفوظة والتحقق من صحتها وتجديدها صامتاً عند الحاجة
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        // 1. تحميل أو توليد وحفظ معرّف الجهاز الثابت
        let currentDeviceId = await appStorage.getItem(DEVICE_ID_KEY);
        if (!currentDeviceId) {
          currentDeviceId = getInitialDeviceIdSync();
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

        // 3. استرجاع رمز التوثيق وكود التفعيل وبيانات الاشتراك
        const savedToken = await appStorage.getItem(TOKEN_KEY);
        let savedCode = await appStorage.getItem(ACTIVATION_CODE_KEY);
        const savedSub = await appStorage.getItem(SUB_KEY);

        // إذا كان كود التفعيل غير محفوظ في مفتاحه الخاص ولكن محفوظ في sub_info: استخرجه واحفظه فوراً
        if (!savedCode && savedSub) {
          try {
            const parsed = JSON.parse(savedSub);
            if (parsed?.code) {
              const codeStr = String(parsed.code).trim().toUpperCase();
              savedCode = codeStr;
              await appStorage.setItem(ACTIVATION_CODE_KEY, codeStr);
            }
          } catch {}
        }

        if (isMounted && savedCode) {
          setActivationCode(savedCode);
        }

        if (savedToken) {
          if (isMounted) {
            setToken(savedToken);
            if (savedSub) {
              try {
                setSubscription(JSON.parse(savedSub));
              } catch {}
            }
          }
        }

        // تم استرجاع كل البيانات المخزنة محلياً بنجاح، نعلن جاهزية بيانات التوثيق الأولية
        if (isMounted) {
          setIsAuthReady(true);
        }

        if (savedToken) {
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
                if (data.subscription.code && !savedCode) {
                  const codeStr = String(data.subscription.code).trim().toUpperCase();
                  savedCode = codeStr;
                  setActivationCode(codeStr);
                  await appStorage.setItem(ACTIVATION_CODE_KEY, codeStr);
                }
                useAppStore.getState().syncFavorites(savedToken);
              }
            } else if (res.status === 401 || res.status === 403) {
              console.warn('[Auth] Token expired or device unlinked (401/403). Attempting silent re-auth...');
              // التوكن منتهٍ أو فُك ارتباط الجهاز: نحاول التجديد الصامت التلقائي أولاً!
              if (savedCode) {
                const reauthResult = await silentReauth(savedCode);
                if (!reauthResult.success) {
                  // إذا كان سبب الفشل رفضاً صريحاً ومؤكداً من السيرفر (انتهاء الصلاحية الفعلي أو كود ملغى)
                  const isExplicitRejection =
                    reauthResult.error &&
                    (reauthResult.error.includes('انتهت صلاحية') ||
                      reauthResult.error.includes('غير صحيح') ||
                      reauthResult.error.includes('غير موجود') ||
                      reauthResult.error.includes('موقوف'));

                  if (isExplicitRejection && isMounted) {
                    console.warn('[Auth] Silent reauth explicitly failed with permanent rejection:', reauthResult.error);
                    setToken(null);
                    setSubscription(null);
                    await appStorage.removeItem(TOKEN_KEY);
                    await appStorage.removeItem(SUB_KEY);
                  } else {
                    console.warn('[Auth] Transient reauth failure (network/server), keeping local session active.');
                  }
                }
              } else {
                // لا يوجد كود تفعيل محفوظ محلياً إطلاقاً
                if (isMounted) {
                  setToken(null);
                  setSubscription(null);
                  await appStorage.removeItem(TOKEN_KEY);
                  await appStorage.removeItem(SUB_KEY);
                }
              }
            } else {
              // 500, 502, 503: أخطاء سيرفر مؤقتة، نحافظ على الجلسة المحلية دون طرد المستخدم
              console.warn('[Auth] Server returned non-ok status during auth check:', res.status, 'Keeping session active.');
            }
          } catch (netErr) {
            // انقطاع شبكة أو تعذر الاتصال: نحافظ على الجلسة
            console.warn('[Auth] Network issue verifying session with server, keeping local session:', netErr);
          }
        } else if (savedCode) {
          // يوجد كود تفعيل محفوظ ولكن بدون توكن: قم بالتفعيل الصامت مباشرة لإصدار توكن جديد
          console.log('[Auth] No token found, but activation code exists. Re-authenticating silently...');
          await silentReauth(savedCode);
        }
      } catch (err) {
        console.warn('[Auth] Failed to initialize auth:', err);
      } finally {
        if (isMounted) {
          setIsAuthReady(true);
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [silentReauth]);

  // تفعيل كود الاشتراك
  const activate = useCallback(
    async (code: string, customDeviceName?: string) => {
      try {
        const normalizedCode = code.trim().toUpperCase();
        const dName = customDeviceName || deviceName;
        const res = await fetch(`${BACKEND_BASE_URL}/api/auth/activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: normalizedCode,
            deviceId,
            deviceName: dName,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.token) {
          return {
            success: false,
            error: data?.error || 'فشل تفعيل الاشتراك، يرجى التأكد من صحة الكود',
          };
        }

        setToken(data.token);
        setActivationCode(normalizedCode);
        setSubscription(data.subscription);

        // حفظ التوكن وكود التفعيل ومعلومات الاشتراك في التخزين الموحد والدائم (Web / AsyncStorage)
        await appStorage.setItem(TOKEN_KEY, data.token);
        await appStorage.setItem(ACTIVATION_CODE_KEY, normalizedCode);
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
    setActivationCode(null);
    setSubscription(null);
    await appStorage.removeItem(TOKEN_KEY);
    await appStorage.removeItem(ACTIVATION_CODE_KEY);
    await appStorage.removeItem(SUB_KEY);
  }, []);

  // تحديث حالة الاشتراك من الخادم
  const refreshAuth = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${tokenRef.current}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.valid && data.subscription) {
          setSubscription(data.subscription);
          await appStorage.setItem(SUB_KEY, JSON.stringify(data.subscription));
          if (data.subscription.code && !activationCodeRef.current) {
            const c = data.subscription.code.trim().toUpperCase();
            setActivationCode(c);
            await appStorage.setItem(ACTIVATION_CODE_KEY, c);
          }
        }
      } else if (res.status === 401 && activationCodeRef.current) {
        await silentReauth();
      }
    } catch {}
  }, [silentReauth]);

  // استدعاء محمي يضيف ترويسة التوثيق تلقائياً مع إعادة المحاولة الصامتة عند 401
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(options.headers || {});
      if (tokenRef.current) {
        headers.set('Authorization', `Bearer ${tokenRef.current}`);
      }

      let res = await fetch(url, { ...options, headers });

      // إذا رد السيرفر بـ 401، حاول إعادة التفعيل الصامت مرة واحدة
      if (res.status === 401 && activationCodeRef.current) {
        console.warn(`[authFetch] 401 on ${url}, attempting silent reauth...`);
        const reauth = await silentReauth();
        if (reauth.success && reauth.token) {
          const retryHeaders = new Headers(options.headers || {});
          retryHeaders.set('Authorization', `Bearer ${reauth.token}`);
          res = await fetch(url, { ...options, headers: retryHeaders });
        }
      }

      return res;
    },
    [silentReauth]
  );

  return (
    <AuthContext.Provider
      value={{
        token,
        activationCode,
        subscription,
        deviceId,
        deviceName,
        isLoading,
        isAuthReady,
        activate,
        logout,
        refreshAuth,
        silentReauth,
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
