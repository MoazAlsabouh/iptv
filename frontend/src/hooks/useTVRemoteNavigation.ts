import { useEffect } from 'react';
import { Platform, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { safeGoBack } from '../utils/navigation';

export interface TVKeyHandlers {
  onEnter?: () => void;
  onBack?: () => boolean | void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onChannelUp?: () => void;
  onChannelDown?: () => void;
  onAnyKey?: () => void;
}

/**
 * Hook مخصص للاستماع إلى أزرار ريموت التلفاز ومفاتيح الأسهم (Arrow Keys + Enter + Back + Zapping).
 * يوفر تجربة سلسة ومتوافقة مع شاشات التلفاز الذكية (Android TV, Apple TV, Smart TV Browsers, Web).
 *
 * @param handlers كائن يحتوي على دوال الاستجابة للأزرار المختلفة
 */
export function useTVRemoteNavigation(handlers: TVKeyHandlers) {
  const router = useRouter();

  // 1. دعم زر الرجوع الأصلي في أجهزة Android و Android TV
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const backAction = () => {
      if (handlers.onBack) {
        const handled = handlers.onBack();
        if (handled === true) return true;
        if (handled === false) return false;
        return true;
      }
      safeGoBack(router);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [handlers, router]);

  // 2. دعم لوحة المفاتيح وريموتات الويب والمتصفحات الذكية
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
            const handled = handlers.onBack();
            if (handled !== false) {
              event.preventDefault();
            }
          } else {
            safeGoBack(router);
          }
          break;
        case 'ArrowUp':
          if (handlers.onArrowUp) {
            event.preventDefault();
            handlers.onArrowUp();
          }
          break;
        case 'ArrowDown':
          if (handlers.onArrowDown) {
            event.preventDefault();
            handlers.onArrowDown();
          }
          break;
        case 'ArrowLeft':
          if (handlers.onArrowLeft) {
            event.preventDefault();
            handlers.onArrowLeft();
          }
          break;
        case 'ArrowRight':
          if (handlers.onArrowRight) {
            event.preventDefault();
            handlers.onArrowRight();
          }
          break;
        case 'ChannelUp':
        case 'PageUp':
        case 'MediaTrackNext':
          if (handlers.onChannelUp) {
            event.preventDefault();
            handlers.onChannelUp();
          }
          break;
        case 'ChannelDown':
        case 'PageDown':
        case 'MediaTrackPrevious':
          if (handlers.onChannelDown) {
            event.preventDefault();
            handlers.onChannelDown();
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
