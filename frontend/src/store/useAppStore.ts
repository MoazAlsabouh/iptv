import { create } from 'zustand';
import { Platform } from 'react-native';
import { DEFAULT_BACKEND_M3U_URL } from '../utils/m3uParser';
import { appStorage } from '../utils/storage';

const BACKEND_BASE_URL = 'https://iptv-backend.moaznsm.workers.dev';
const FAVORITES_STORAGE_KEY = 'iptv_user_favorites_v2';
const TOKEN_KEY = 'iptv_auth_token';

export interface FavoriteRecord {
  id: string;
  type: 'channel' | 'vod';
  data: any;
  createdAt?: string;
}

export interface AppState {
  isChildMode: boolean;
  pinCode: string | null;
  playlistUrl: string;
  favoriteIds: string[];
  vodFavorites: any[];
  channelFavorites: any[];
  isFavoritesLoaded: boolean;
  activeDashboardTab: 'category' | 'network' | 'country';
  setChildMode: (isChildMode: boolean) => void;
  setPinCode: (pinCode: string | null) => void;
  setPlaylistUrl: (playlistUrl: string) => void;
  toggleFavorite: (target: string | { id: string; type?: string; [key: string]: any }) => Promise<void>;
  isItemFavorite: (id: string) => boolean;
  syncFavorites: (customToken?: string | null) => Promise<void>;
  loadFavoritesFromStorage: () => Promise<void>;
  setActiveDashboardTab: (tab: 'category' | 'network' | 'country') => void;
  resetAppStore: () => void;
}

function getStoredTokenSync(): string | null {
  return appStorage.getItemSync(TOKEN_KEY);
}

function loadInitialFavoritesSync(): {
  favoriteIds: string[];
  vodFavorites: any[];
  channelFavorites: any[];
} {
  try {
    const raw = appStorage.getItemSync(FAVORITES_STORAGE_KEY);
    if (raw) {
      const records: FavoriteRecord[] = JSON.parse(raw);
      if (Array.isArray(records)) {
        const ids: string[] = [];
        const vodList: any[] = [];
        const chList: any[] = [];
        records.forEach((r) => {
          if (r && r.id) {
            ids.push(r.id);
            if (r.type === 'vod') {
              vodList.push({ id: r.id, ...(r.data || {}) });
            } else {
              chList.push({ id: r.id, ...(r.data || {}) });
            }
          }
        });
        return { favoriteIds: ids, vodFavorites: vodList, channelFavorites: chList };
      }
    }
  } catch {}
  return { favoriteIds: [], vodFavorites: [], channelFavorites: [] };
}

async function persistFavoritesLocally(records: FavoriteRecord[]) {
  try {
    await appStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

const initialFavs = loadInitialFavoritesSync();

export const useAppStore = create<AppState>((set, get) => ({
  isChildMode: false,
  pinCode: null,
  playlistUrl: DEFAULT_BACKEND_M3U_URL,
  favoriteIds: initialFavs.favoriteIds,
  vodFavorites: initialFavs.vodFavorites,
  channelFavorites: initialFavs.channelFavorites,
  isFavoritesLoaded: false,
  activeDashboardTab: 'category',

  setChildMode: (isChildMode: boolean) => set({ isChildMode }),
  setPinCode: (pinCode: string | null) => set({ pinCode }),
  setPlaylistUrl: (playlistUrl: string) => set({ playlistUrl }),

  isItemFavorite: (id: string) => {
    return get().favoriteIds.includes(id);
  },

  loadFavoritesFromStorage: async () => {
    try {
      const raw = await appStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw) {
        const records: FavoriteRecord[] = JSON.parse(raw);
        if (Array.isArray(records)) {
          const ids: string[] = [];
          const vodList: any[] = [];
          const chList: any[] = [];
          records.forEach((r) => {
            if (r && r.id) {
              ids.push(r.id);
              if (r.type === 'vod') {
                vodList.push({ id: r.id, ...(r.data || {}) });
              } else {
                chList.push({ id: r.id, ...(r.data || {}) });
              }
            }
          });
          set({
            favoriteIds: ids,
            vodFavorites: vodList,
            channelFavorites: chList,
            isFavoritesLoaded: true,
          });
        }
      }
    } catch (err) {
      console.warn('[Favorites] Failed to load local favorites:', err);
    }
  },

  syncFavorites: async (customToken?: string | null) => {
    const token = customToken || (await appStorage.getItem(TOKEN_KEY)) || getStoredTokenSync();
    if (!token) return;

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/favorites`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const json = await res.json();
        const records: FavoriteRecord[] = Array.isArray(json.favorites) ? json.favorites : [];
        const ids: string[] = [];
        const vodList: any[] = [];
        const chList: any[] = [];

        records.forEach((r) => {
          if (r && r.id) {
            ids.push(r.id);
            if (r.type === 'vod') {
              vodList.push({ id: r.id, ...(r.data || {}) });
            } else {
              chList.push({ id: r.id, ...(r.data || {}) });
            }
          }
        });

        persistFavoritesLocally(records);
        set({
          favoriteIds: ids,
          vodFavorites: vodList,
          channelFavorites: chList,
          isFavoritesLoaded: true,
        });
      }
    } catch (err) {
      console.warn('[Favorites] Failed to sync with server:', err);
    }
  },

  toggleFavorite: async (target: string | { id: string; type?: string; [key: string]: any }) => {
    const isObj = typeof target === 'object' && target !== null;
    const itemId = isObj ? target.id : target;
    if (!itemId) return;

    const { favoriteIds, vodFavorites, channelFavorites } = get();
    const isCurrentlyFav = favoriteIds.includes(itemId);

    let itemType: 'channel' | 'vod' = 'channel';
    if (isObj) {
      const t = target.type;
      if (t === 'vod' || t === 'movie' || t === 'tv' || itemId.startsWith('tmdb-') || itemId.startsWith('tvm-')) {
        itemType = 'vod';
      }
    } else {
      if (vodFavorites.some((v) => v.id === itemId) || itemId.startsWith('tmdb-') || itemId.startsWith('tvm-')) {
        itemType = 'vod';
      }
    }

    const token = (await appStorage.getItem(TOKEN_KEY)) || getStoredTokenSync();

    if (isCurrentlyFav) {
      // إزالة من المفضلة
      const newIds = favoriteIds.filter((id) => id !== itemId);
      const newVod = vodFavorites.filter((v) => v.id !== itemId);
      const newCh = channelFavorites.filter((c) => c.id !== itemId);

      const recordsToPersist: FavoriteRecord[] = [
        ...newVod.map((v) => ({ id: v.id, type: 'vod' as const, data: v })),
        ...newCh.map((c) => ({ id: c.id, type: 'channel' as const, data: c })),
      ];
      persistFavoritesLocally(recordsToPersist);

      set({
        favoriteIds: newIds,
        vodFavorites: newVod,
        channelFavorites: newCh,
      });

      // إرسال طلب الحذف للخادم إذا وُجد توكن
      if (token) {
        try {
          await fetch(`${BACKEND_BASE_URL}/api/favorites/${itemType}/${encodeURIComponent(itemId)}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (err) {
          console.warn('[Favorites] Failed to delete from server:', err);
        }
      }
    } else {
      // إضافة إلى المفضلة
      const newIds = [...favoriteIds, itemId];
      const itemData = isObj ? { ...target } : { id: itemId };
      const newVod = itemType === 'vod' ? [itemData, ...vodFavorites.filter((v) => v.id !== itemId)] : vodFavorites;
      const newCh = itemType === 'channel' ? [itemData, ...channelFavorites.filter((c) => c.id !== itemId)] : channelFavorites;

      const recordsToPersist: FavoriteRecord[] = [
        ...newVod.map((v) => ({ id: v.id, type: 'vod' as const, data: v })),
        ...newCh.map((c) => ({ id: c.id, type: 'channel' as const, data: c })),
      ];
      persistFavoritesLocally(recordsToPersist);

      set({
        favoriteIds: newIds,
        vodFavorites: newVod,
        channelFavorites: newCh,
      });

      // إرسال طلب الإضافة للخادم إذا وُجد توكن
      if (token) {
        try {
          await fetch(`${BACKEND_BASE_URL}/api/favorites`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              id: itemId,
              type: itemType,
              data: itemData,
            }),
          });
        } catch (err) {
          console.warn('[Favorites] Failed to save to server:', err);
        }
      }
    }
  },

  setActiveDashboardTab: (tab: 'category' | 'network' | 'country') =>
    set({ activeDashboardTab: tab }),

  resetAppStore: () =>
    set({
      isChildMode: false,
      pinCode: null,
      playlistUrl: DEFAULT_BACKEND_M3U_URL,
      favoriteIds: [],
      vodFavorites: [],
      channelFavorites: [],
      isFavoritesLoaded: false,
      activeDashboardTab: 'category',
    }),
}));
