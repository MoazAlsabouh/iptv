import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../utils/navigation';

interface TVKeyHandlers {
  onEnter?: () => void;
  onBack?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onAnyKey?: () => void;
}

/**
 * Hook مخصص للاستماع إلى أزرار ريموت التلفاز ومفاتيح الأسهم (Arrow Keys + Enter + Back).
 * يوفر تجربة سلسة ومتوافقة مع شاشات التلفاز الذكية (Android TV, Apple TV, Smart TV Browsers, Web).
 *
 * @param handlers كائن يحتوي على دوال الاستجابة للأزرار المختلفة
 */
export function useTVRemoteNavigation(handlers: TVKeyHandlers) {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      handlers.onAnyKey?.();

      switch (event.key) {
        case 'Enter':
        case 'Select':
          if (handlers.onEnter) {
            handlers.onEnter();
          }
          break;
        case 'Escape':
        case 'Backspace':
        case 'BrowserBack':
          if (handlers.onBack) {
            handlers.onBack();
          } else {
            safeGoBack(router);
          }
          break;
        case 'ArrowUp':
          if (handlers.onArrowUp) {
            handlers.onArrowUp();
          }
          break;
        case 'ArrowDown':
          if (handlers.onArrowDown) {
            handlers.onArrowDown();
          }
          break;
        case 'ArrowLeft':
          if (handlers.onArrowLeft) {
            handlers.onArrowLeft();
          }
          break;
        case 'ArrowRight':
          if (handlers.onArrowRight) {
            handlers.onArrowRight();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlers, router]);
}
