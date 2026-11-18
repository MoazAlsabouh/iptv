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

// 1. جلب القنوات المفتوحة المصدر المجانية (القنوات العربية كمثال)
async function fetchOpenSourceChannels(): Promise<string> {
  const url = 'https://iptv-org.github.io/iptv/languages/ara.m3u';
  try {
    const response = await fetch(url);
    if (!response.ok) return '#EXTM3U\n';
    return await response.text();
  } catch (error) {
    return '#EXTM3U\n';
  }
}

// 2. جلب الأفلام من TMDB
async function fetchTrendingMovies(apiKey: string): Promise<TMDBMovie[]> {
  if (!apiKey) return [];
  const url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=ar`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return [];
    const data = (await response.json()) as TMDBResponse;
    return data.results || [];
  } catch (error) {
    return [];
  }
}

// 3. تحويل الأفلام إلى صيغة M3U
function formatMoviesToM3U(movies: TMDBMovie[]): string {
  const lines: string[] = [];
  for (const movie of movies) {
    const title = movie.title || movie.name || `Movie ${movie.id}`;
    const posterUrl = movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : '';
    // رابط فيديو تجريبي مفتوح المصدر للأفلام
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

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (url.pathname === '/' || url.pathname === '/playlist.m3u') {
      try {
        const apiKey = env.TMDB_API_KEY || 'YOUR_TMDB_API_KEY';

        // تنفيذ الطلبين في نفس الوقت لتسريع الاستجابة
        const [channelsM3U, movies] = await Promise.all([
          fetchOpenSourceChannels(),
          fetchTrendingMovies(apiKey),
        ]);

        const moviesM3U = formatMoviesToM3U(movies);

        // تنظيف ومحاذاة ملف القنوات (إزالة سطر فارغ إن وجد) ودمج الأفلام معه
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
