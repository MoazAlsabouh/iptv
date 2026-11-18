import { useRouter } from 'expo-router';

export type AppRouter = ReturnType<typeof useRouter>;

/**
 * دالة ملاحة آمنة للرجوع للخلف لتجنب تحذير:
 * The action 'GO_BACK' was not handled by any navigator
 *
 * @param router كائن الموجه من expo-router
 */
export function safeGoBack(router: AppRouter): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}
