import { Platform } from 'react-native';
import { VirtualLiveEpisode } from './virtualLive';

export interface ActiveSimulatedChannelData {
  id: string;
  name: string;
  logo: string;
  category: string;
  episodes: VirtualLiveEpisode[];
  createdAt?: string | number | null;
}

// مخزن الذاكرة المحلي (In-memory Store) لنقل البيانات بين الشاشات دون تضخيم الـ URL
const memoryStore = new Map<string, ActiveSimulatedChannelData>();
let lastActiveChannel: ActiveSimulatedChannelData | null = null;

const SESSION_STORAGE_KEY_PREFIX = 'telfazi_simulated_ch_';

/**
 * حفظ بيانات القناة النشطة وحلقاتها في الذاكرة و sessionStorage
 * لتجنب تمرير مصفوفات JSON الضخمة داخل رابط الـ URL ووقوع خطأ HTTP 413
 */
export function setActiveSimulatedChannel(data: ActiveSimulatedChannelData): void {
  if (!data || !data.id) return;
  memoryStore.set(data.id, data);
  lastActiveChannel = data;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(
        `${SESSION_STORAGE_KEY_PREFIX}${data.id}`,
        JSON.stringify(data)
      );
    } catch {}
  }
}

/**
 * استرجاع بيانات القناة النشطة وحلقاتها من الذاكرة أو sessionStorage
 */
export function getActiveSimulatedChannel(id: string): ActiveSimulatedChannelData | null {
  if (!id) return null;

  // 1. الفحص من الذاكرة الحية أولاً
  const inMem = memoryStore.get(id);
  if (inMem && Array.isArray(inMem.episodes) && inMem.episodes.length > 0) {
    return inMem;
  }
  if (lastActiveChannel && lastActiveChannel.id === id && Array.isArray(lastActiveChannel.episodes) && lastActiveChannel.episodes.length > 0) {
    return lastActiveChannel;
  }

  // 2. الفحص من sessionStorage على الويب عند إعادة التحميل (Refresh)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(`${SESSION_STORAGE_KEY_PREFIX}${id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id === id && Array.isArray(parsed.episodes) && parsed.episodes.length > 0) {
          memoryStore.set(id, parsed);
          lastActiveChannel = parsed;
          return parsed;
        }
      }
    } catch {}
  }

  return null;
}
