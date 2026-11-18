/**
 * بنية تمثل مصدر بث منفصل لنفس القناة
 */
export interface StreamSource {
  label: string;
  url: string;
}

/**
 * واجهة تمثل عنصر وسائط أو قناة مأخوذة من قائمة تشغيل M3U
 */
export interface MediaItem {
  id: string;
  name: string;
  groupTitle: string;
  country?: string;
  logo: string;
  url: string;
  sources?: StreamSource[];
  type?: 'live' | 'movie' | 'series';
}
