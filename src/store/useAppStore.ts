import { create } from 'zustand';

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
 */
export const useAppStore = create<AppState>((set) => ({
  isChildMode: false,
  pinCode: null,
  playlistUrl: '',
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
      playlistUrl: '',
      favoriteIds: [],
    }),
}));
