/**
 * واجهة تمثل عنصر وسائط أو قناة مأخوذة من قائمة تشغيل M3U
 */
export interface MediaItem {
  id: string;
  name: string;
  groupTitle: string;
  logo: string;
  url: string;
}
