import { create } from 'zustand';
import { DEFAULT_BACKEND_M3U_URL } from '../utils/m3uParser';

/**
 * واجهة تمثل حالة التطبيق الأساسية
 */
export interface AppState {
  isChildMode: boolean;
  pinCode: string | null;
  playlistUrl: string;
  favoriteIds: string[];
  setChildMode: (isChildMode: boolean) => void;
  setPinCode: (pinCode: string | null) => void;
  setPlaylistUrl: (playlistUrl: string) => void;
  toggleFavorite: (id: string) => void;
  resetAppStore: () => void;
}

/**
 * المتجر العام للتطبيق باستخدام Zustand
 * يتم تعيين الرابط الافتراضي مباشرة إلى خادم Cloudflare Worker المدمج
 */
export const useAppStore = create<AppState>((set) => ({
  isChildMode: false,
  pinCode: null,
  playlistUrl: DEFAULT_BACKEND_M3U_URL,
  favoriteIds: [],
  setChildMode: (isChildMode: boolean) => set({ isChildMode }),
  setPinCode: (pinCode: string | null) => set({ pinCode }),
  setPlaylistUrl: (playlistUrl: string) => set({ playlistUrl }),
  toggleFavorite: (id: string) =>
    set((state) => {
      const exists = state.favoriteIds.includes(id);
      return {
        favoriteIds: exists
          ? state.favoriteIds.filter((favId) => favId !== id)
          : [...state.favoriteIds, id],
      };
    }),
  resetAppStore: () =>
    set({
      isChildMode: false,
      pinCode: null,
      playlistUrl: DEFAULT_BACKEND_M3U_URL,
      favoriteIds: [],
    }),
}));
