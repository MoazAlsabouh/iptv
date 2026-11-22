import { useEffect, useRef } from 'react';
import { Platform, BackHandler, DeviceEventEmitter } from 'react-native';
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
  const handlersRef = useRef<TVKeyHandlers>(handlers);
  handlersRef.current = handlers;

  // 1. دعم زر الرجوع الأصلي في أجهزة Android و Android TV
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const backAction = () => {
      if (handlersRef.current.onBack) {
        const handled = handlersRef.current.onBack();
        if (handled === true) return true;
        if (handled === false) return false;
        return true;
      }
      safeGoBack(router);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [router]);

  // 1.ب. دعم أزرار ريموت Android TV الأصلية (D-Pad, Enter, Channel +/-)
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const sub = DeviceEventEmitter.addListener(
      'onTVKeyEvent',
      (event: { eventType: string; keyCode: number }) => {
        handlersRef.current.onAnyKey?.();

        switch (event?.eventType) {
          case 'DPAD_UP':
            handlersRef.current.onArrowUp?.();
            break;
          case 'DPAD_DOWN':
            handlersRef.current.onArrowDown?.();
            break;
          case 'DPAD_LEFT':
            handlersRef.current.onArrowLeft?.();
            break;
          case 'DPAD_RIGHT':
            handlersRef.current.onArrowRight?.();
            break;
          case 'DPAD_CENTER':
          case 'ENTER':
            handlersRef.current.onEnter?.();
            break;
          case 'CHANNEL_UP':
            if (handlersRef.current.onChannelUp) {
              handlersRef.current.onChannelUp();
            } else {
              handlersRef.current.onArrowUp?.();
            }
            break;
          case 'CHANNEL_DOWN':
            if (handlersRef.current.onChannelDown) {
              handlersRef.current.onChannelDown();
            } else {
              handlersRef.current.onArrowDown?.();
            }
            break;
        }
      }
    );

    return () => {
      sub.remove();
    };
  }, []);

  // 2. دعم لوحة المفاتيح وريموتات الويب والمتصفحات الذكية
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInput) {
        if (event.key === 'Escape' || event.key === 'ArrowDown') {
          (activeEl as HTMLElement).blur();
        }
        return;
      }

      handlersRef.current.onAnyKey?.();

      switch (event.key) {
        case 'Enter':
        case 'Select':
        case 'Ok':
        case 'OK':
        case 'NumpadEnter':
          if (handlersRef.current.onEnter) {
            handlersRef.current.onEnter();
          }
          break;
        case 'Escape':
        case 'Backspace':
        case 'BrowserBack':
          if (handlersRef.current.onBack) {
            const handled = handlersRef.current.onBack();
            if (handled !== false) {
              event.preventDefault();
            }
          } else {
            safeGoBack(router);
          }
          break;
        case 'ArrowUp':
          if (handlersRef.current.onArrowUp) {
            event.preventDefault();
            handlersRef.current.onArrowUp();
          }
          break;
        case 'ArrowDown':
          if (handlersRef.current.onArrowDown) {
            event.preventDefault();
            handlersRef.current.onArrowDown();
          }
          break;
        case 'ArrowLeft':
          if (handlersRef.current.onArrowLeft) {
            event.preventDefault();
            handlersRef.current.onArrowLeft();
          }
          break;
        case 'ArrowRight':
          if (handlersRef.current.onArrowRight) {
            event.preventDefault();
            handlersRef.current.onArrowRight();
          }
          break;
        case 'ChannelUp':
        case 'PageUp':
        case 'MediaTrackNext':
          if (handlersRef.current.onChannelUp) {
            event.preventDefault();
            handlersRef.current.onChannelUp();
          }
          break;
        case 'ChannelDown':
        case 'PageDown':
        case 'MediaTrackPrevious':
          if (handlersRef.current.onChannelDown) {
            event.preventDefault();
            handlersRef.current.onChannelDown();
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
  }, [router]);
}
