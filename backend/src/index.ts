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

interface CountrySource {
  code: string;
  name: string;
}

// قائمة الدول العربية المستهدفة لربط كل رمز بالاسم العربي
const ARAB_COUNTRIES: CountrySource[] = [
  { code: 'sy', name: 'سوريا' },
  { code: 'sa', name: 'السعودية' },
  { code: 'eg', name: 'مصر' },
  { code: 'ae', name: 'الإمارات' },
  { code: 'jo', name: 'الأردن' },
  { code: 'lb', name: 'لبنان' },
  { code: 'ps', name: 'فلسطين' },
  { code: 'iq', name: 'العراق' },
  { code: 'qa', name: 'قطر' },
  { code: 'kw', name: 'الكويت' },
  { code: 'ma', name: 'المغرب' },
  { code: 'dz', name: 'الجزائر' },
  { code: 'tn', name: 'تونس' },
  { code: 'om', name: 'عُمان' },
  { code: 'bh', name: 'البحرين' },
];

/**
 * تعريب وتوحيد تصنيفات القنوات إلى أحد الأقسام العربية المعتمدة حصراً:
 * (رياضة، أخبار واقتصاد، أفلام ومسلسلات، أطفال وعائلة، وثائقيات وتعليم، قنوات دينية، موسيقى، قنوات عامة ومنوعة)
 */
function translateCategory(rawCategory: string): string {
  if (!rawCategory || rawCategory.trim().length === 0) {
    return 'قنوات عامة ومنوعة';
  }

  // دعم التصنيفات المركبة مثل Documentary;News
  const parts = rawCategory.split(';').map((p) => p.trim().toLowerCase());

  for (const part of parts) {
    if (['sports', 'sport', 'outdoor', 'auto', 'motorsport'].some((k) => part.includes(k))) {
      return 'رياضة';
    }
    if (['news', 'business', 'weather', 'legislative', 'finance'].some((k) => part.includes(k))) {
      return 'أخبار واقتصاد';
    }
    if (['movie', 'movies', 'series', 'entertainment', 'comedy', 'drama', 'cinema'].some((k) => part.includes(k))) {
      return 'أفلام ومسلسلات';
    }
    if (['kids', 'animation', 'family', 'children'].some((k) => part.includes(k))) {
      return 'أطفال وعائلة';
    }
    if (['documentary', 'doc', 'science', 'education', 'travel', 'nature', 'history'].some((k) => part.includes(k))) {
      return 'وثائقيات وتعليم';
    }
    if (['religious', 'islamic', 'quran', 'religion'].some((k) => part.includes(k))) {
      return 'قنوات دينية';
    }
    if (['music', 'song'].some((k) => part.includes(k))) {
      return 'موسيقى';
    }
    if (['general', 'undefined', 'classic', 'culture', 'lifestyle', 'shop', 'relax'].some((k) => part.includes(k))) {
      return 'قنوات عامة ومنوعة';
    }
  }

  return 'قنوات عامة ومنوعة';
}

/**
 * جلب قائمة M3U فردية لدولة معينة بأمان
 */
async function fetchCountrySource(country: CountrySource): Promise<{ country: CountrySource; content: string }> {
  const url = `https://iptv-org.github.io/iptv/countries/${country.code}.m3u`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTVStream/1.0',
      },
    });
    if (!res.ok) return { country, content: '' };
    const content = await res.text();
    return { country, content };
  } catch {
    return { country, content: '' };
  }
}

/**
 * معالجة نص M3U للدولة واستخراج القنوات مع تعريب التصنيف وإضافة tvg-country وإلغاء التكرار
 */
function processCountryM3U(
  content: string,
  countryName: string,
  urlSet: Set<string>,
  entries: ChannelEntry[]
): void {
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

          let updatedExtinf = currentExtinf;

          // 1. تعريب وتوحيد group-title بدقة
          const groupTitleRegex = /group-title="([^"]*)"/i;
          const groupMatch = updatedExtinf.match(groupTitleRegex);
          const rawGroup = groupMatch ? groupMatch[1] : '';
          const translatedGroup = translateCategory(rawGroup);

          if (groupMatch) {
            updatedExtinf = updatedExtinf.replace(groupTitleRegex, `group-title="${translatedGroup}"`);
          } else {
            const commaIdx = updatedExtinf.lastIndexOf(',');
            if (commaIdx !== -1) {
              updatedExtinf = `${updatedExtinf.substring(0, commaIdx)} group-title="${translatedGroup}"${updatedExtinf.substring(commaIdx)}`;
            } else {
              updatedExtinf = `${updatedExtinf} group-title="${translatedGroup}"`;
            }
          }

          // 2. إضافة أو تحديث سمة tvg-country بالاسم العربي للدولة
          const countryRegex = /tvg-country="([^"]*)"/i;
          if (countryRegex.test(updatedExtinf)) {
            updatedExtinf = updatedExtinf.replace(countryRegex, `tvg-country="${countryName}"`);
          } else {
            const commaIdx = updatedExtinf.lastIndexOf(',');
            if (commaIdx !== -1) {
              updatedExtinf = `${updatedExtinf.substring(0, commaIdx)} tvg-country="${countryName}"${updatedExtinf.substring(commaIdx)}`;
            } else {
              updatedExtinf = `${updatedExtinf} tvg-country="${countryName}"`;
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
 * جلب وتوحيد كافة القنوات العربية من قوائم الدول بالتوازي
 */
async function fetchAndNormalizeArabChannels(): Promise<string> {
  const results = await Promise.all(ARAB_COUNTRIES.map(fetchCountrySource));
  const urlSet = new Set<string>();
  const entries: ChannelEntry[] = [];

  for (const item of results) {
    if (item.content) {
      processCountryM3U(item.content, item.country.name, urlSet, entries);
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
 * تحويل أفلام TMDB إلى صيغة M3U موحدة تحت تصنيف "أفلام رائجة" ودولة "أفلام عالمية"
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
      `#EXTINF:-1 tvg-id="${movie.id}" tvg-logo="${posterUrl}" tvg-country="أفلام عالمية" group-title="أفلام رائجة",${title}`
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
          'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma, *',
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

        // جلب وتجميع قنوات الدول العربية مع الأفلام الرائجة بالتوازي
        const [channelsM3U, movies] = await Promise.all([
          fetchAndNormalizeArabChannels(),
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
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      } catch (error) {
        return new Response('خطأ في توليد قائمة M3U', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
