/**
 * بيئة متغيرات الـ Cloudflare Worker
 */
export interface Env {
  TMDB_API_KEY?: string;
}

/**
 * بنية بيانات الفيلم المستخرجة من TMDB
 */
interface TMDBMovie {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  overview?: string;
  release_date?: string;
}

interface TMDBResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

/**
 * جلب قائمة الأفلام الرائجة (Trending) خلال الأسبوع من TMDB API
 *
 * @param apiKey مفتاح الواجهة البرمجية لـ TMDB
 * @returns مصفوفة الأفلام الرائجة
 */
async function fetchTrendingMovies(apiKey: string): Promise<TMDBMovie[]> {
  const url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=ar`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`فشل الاتصال بـ TMDB API. رمز الاستجابة: ${response.status}`);
  }

  const data = (await response.json()) as TMDBResponse;
  return data.results || [];
}

/**
 * توليد رابط تشغيل مباشر تجريبي (Placeholder) لكل فيلم بناءً على المعرف الخاص به
 *
 * @param movieId معرف الفيلم في TMDB
 * @returns رابط تشغيل الفيديو
 */
function generateStreamUrl(movieId: number): string {
  // رابط فيديو MP4 مفتوح المصدر عالي الجودة للتجربة والاختبار
  // يمكن استبداله لاحقاً برابط خدمة السحب أو التحليل الخاصة بك
  return `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4?movie_id=${movieId}`;
}

/**
 * تحويل مصفوفة الأفلام إلى صيغة ملف M3U القياسية المتوافقة مع المشغلات
 *
 * @param movies مصفوفة الأفلام المستخرجة
 * @returns نص قائمة التشغيل بصيغة M3U
 */
function formatToM3U(movies: TMDBMovie[]): string {
  const lines: string[] = ['#EXTM3U'];

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    const title = movie.title || movie.name || `Movie ${movie.id}`;
    const posterUrl = movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : '';
    const streamUrl = generateStreamUrl(movie.id);

    // سطر البيانات الوصفية EXTINF مع تصنيف "أفلام"
    lines.push(
      `#EXTINF:-1 tvg-id="${movie.id}" tvg-name="${title}" tvg-logo="${posterUrl}" group-title="أفلام",${title}`
    );
    // سطر رابط البث المباشر
    lines.push(streamUrl);
  }

  return lines.join('\n');
}

/**
 * نقطة الدخول الرئيسية لـ Cloudflare Worker
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // السماح فقط بطلبات GET
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // المسار الرئيسي أو مسار playlist.m3u
    if (url.pathname === '/' || url.pathname === '/playlist.m3u') {
      try {
        // استخدام المفتاح المسجل في متغيرات البيئة أو القيمة الافتراضية المؤقتة
        const apiKey = env.TMDB_API_KEY || 'YOUR_TMDB_API_KEY';

        const movies = await fetchTrendingMovies(apiKey);
        const m3uContent = formatToM3U(movies);

        return new Response(m3uContent, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'Access-Control-Allow-Origin': '*', // دعم CORS لأي مشغل ويب أو تطبيق
            'Cache-Control': 'public, max-age=3600', // تخزين مؤقت لمدة ساعة لتجنب استنزاف حد TMDB المجاني
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'حدث خطأ غير معروف أثناء إنشاء القائمة';

        return new Response(`خطأ في توليد قائمة M3U: ${message}`, {
          status: 500,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
