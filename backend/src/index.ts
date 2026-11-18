export interface Env {
  TMDB_API_KEY?: string;
}

interface TMDBMovie {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
}

interface TMDBResponse {
  results: TMDBMovie[];
}

interface ChannelEntry {
  extinf: string;
  url: string;
}

// مصادر القنوات المفتوحة المصدر الموثوقة من iptv-org
const CHANNEL_SOURCES = [
  'https://iptv-org.github.io/iptv/languages/ara.m3u',       // القنوات العربية
  'https://iptv-org.github.io/iptv/categories/sports.m3u',    // رياضة
  'https://iptv-org.github.io/iptv/categories/movies.m3u',    // أفلام ومسلسلات
  'https://iptv-org.github.io/iptv/categories/kids.m3u',      // أطفال
  'https://iptv-org.github.io/iptv/categories/documentary.m3u', // وثائقيات
  'https://iptv-org.github.io/iptv/categories/news.m3u',      // أخبار واقتصاد
];

/**
 * تعريب وتوحيد تصنيفات القنوات المأخوذة من iptv-org إلى تصنيفات عربية قياسية
 */
function translateCategory(rawCategory: string): string {
  if (!rawCategory || rawCategory.trim().length === 0) {
    return 'قنوات عامة ومنوعة';
  }

  // دعم التصنيفات المركبة مثل Documentary;News
  const parts = rawCategory.split(';').map((p) => p.trim().toLowerCase());

  for (const part of parts) {
    if (['sports', 'sport', 'outdoor', 'auto', 'motorsport'].includes(part)) {
      return 'رياضة';
    }
    if (['movies', 'movie', 'series', 'entertainment', 'comedy'].includes(part)) {
      return 'أفلام ومسلسلات';
    }
    if (['kids', 'animation', 'family'].includes(part)) {
      return 'أطفال وعائلة';
    }
    if (['documentary', 'science', 'education', 'travel', 'nature'].includes(part)) {
      return 'وثائقيات وتعليم';
    }
    if (['news', 'business', 'weather', 'legislative'].includes(part)) {
      return 'أخبار واقتصاد';
    }
    if (['religious', 'islamic', 'quran'].includes(part)) {
      return 'قنوات دينية';
    }
    if (['music'].includes(part)) {
      return 'موسيقى';
    }
    if (['general', 'undefined', 'classic', 'culture', 'lifestyle', 'shop', 'relax'].includes(part)) {
      return 'قنوات عامة ومنوعة';
    }
  }

  return 'قنوات عامة ومنوعة';
}

/**
 * جلب قائمة M3U فردية بأمان
 */
async function fetchSource(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTVStream/1.0',
      },
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * معالجة نص M3U واستخراج القنوات مع تعريب التصنيف وإلغاء التكرار
 */
function processM3UText(content: string, urlSet: Set<string>, entries: ChannelEntry[]): void {
  const lines = content.split('\n');
  const total = lines.length;
  let currentExtinf = '';

  for (let i = 0; i < total; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentExtinf = line;
    } else if (!line.startsWith('#') && currentExtinf) {
      if (line.startsWith('http://') || line.startsWith('https://')) {
        // إزالة القنوات المكررة بناءً على رابط البث المباشر
        if (!urlSet.has(line)) {
          urlSet.add(line);

          // استخراج وترجمة group-title
          const groupTitleRegex = /group-title="([^"]*)"/i;
          const match = currentExtinf.match(groupTitleRegex);
          const rawGroup = match ? match[1] : '';
          const translatedGroup = translateCategory(rawGroup);

          let updatedExtinf: string;
          if (match) {
            updatedExtinf = currentExtinf.replace(groupTitleRegex, `group-title="${translatedGroup}"`);
          } else {
            const commaIdx = currentExtinf.lastIndexOf(',');
            if (commaIdx !== -1) {
              updatedExtinf = `${currentExtinf.substring(0, commaIdx)} group-title="${translatedGroup}"${currentExtinf.substring(commaIdx)}`;
            } else {
              updatedExtinf = `${currentExtinf} group-title="${translatedGroup}"`;
            }
          }

          entries.push({ extinf: updatedExtinf, url: line });
        }
      }
      currentExtinf = '';
    }
  }
}

/**
 * جلب وتوحيد كافة القنوات المفتوحة المصدر بالتوازي
 */
async function fetchAndNormalizeAllChannels(): Promise<string> {
  const texts = await Promise.all(CHANNEL_SOURCES.map(fetchSource));
  const urlSet = new Set<string>();
  const entries: ChannelEntry[] = [];

  for (const text of texts) {
    if (text) {
      processM3UText(text, urlSet, entries);
    }
  }

  const lines = ['#EXTM3U'];
  for (const entry of entries) {
    lines.push(entry.extinf);
    lines.push(entry.url);
  }

  return lines.join('\n');
}

/**
 * جلب الأفلام الرائجة للأسبوع من TMDB
 */
async function fetchTrendingMovies(apiKey: string): Promise<TMDBMovie[]> {
  if (!apiKey) return [];
  const url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=ar`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return [];
    const data = (await response.json()) as TMDBResponse;
    return data.results || [];
  } catch {
    return [];
  }
}

/**
 * تحويل أفلام TMDB إلى صيغة M3U موحدة تحت تصنيف "أفلام رائجة"
 */
function formatMoviesToM3U(movies: TMDBMovie[]): string {
  const lines: string[] = [];
  for (const movie of movies) {
    const title = movie.title || movie.name || `Movie ${movie.id}`;
    const posterUrl = movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : '';
    const streamUrl = `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4?movie_id=${movie.id}`;

    lines.push(
      `#EXTINF:-1 tvg-id="${movie.id}" tvg-logo="${posterUrl}" group-title="أفلام رائجة",${title}`
    );
    lines.push(streamUrl);
  }
  return lines.join('\n');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // معالجة طلبات الأمان (CORS Preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (url.pathname === '/' || url.pathname === '/playlist.m3u') {
      try {
        const apiKey = env.TMDB_API_KEY || 'YOUR_TMDB_API_KEY';

        // جلب وتجميع كافة القنوات والأفلام بالتوازي لأعلى أداء
        const [channelsM3U, movies] = await Promise.all([
          fetchAndNormalizeAllChannels(),
          fetchTrendingMovies(apiKey),
        ]);

        const moviesM3U = formatMoviesToM3U(movies);

        const cleanChannels = channelsM3U.trim();
        const finalM3U = moviesM3U.length > 0
          ? `${cleanChannels}\n${moviesM3U}`
          : cleanChannels;

        return new Response(finalM3U, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (error) {
        return new Response('خطأ في توليد قائمة M3U', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
