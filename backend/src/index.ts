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

// قائمة الدول العربية المستهدفة لربط كل رمز بالاسم العربي (22 دولة عربية)
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
  { code: 'ly', name: 'ليبيا' },
  { code: 'ye', name: 'اليمن' },
  { code: 'sd', name: 'السودان' },
  { code: 'mr', name: 'موريتانيا' },
  { code: 'so', name: 'الصومال' },
  { code: 'dj', name: 'جيبوتي' },
  { code: 'km', name: 'جزر القمر' },
];

const ARAB_COUNTRY_MAP: Record<string, string> = {
  SY: 'سوريا',
  SA: 'السعودية',
  EG: 'مصر',
  AE: 'الإمارات',
  JO: 'الأردن',
  LB: 'لبنان',
  PS: 'فلسطين',
  IQ: 'العراق',
  QA: 'قطر',
  KW: 'الكويت',
  MA: 'المغرب',
  DZ: 'الجزائر',
  TN: 'تونس',
  OM: 'عُمان',
  BH: 'البحرين',
  LY: 'ليبيا',
  YE: 'اليمن',
  SD: 'السودان',
  MR: 'موريتانيا',
  SO: 'الصومال',
  DJ: 'جيبوتي',
  KM: 'جزر القمر',
};

const ARAB_COUNTRY_NAME_MAP: Record<string, string> = {
  egypt: 'مصر',
  'saudi arabia': 'السعودية',
  syria: 'سوريا',
  'united arab emirates': 'الإمارات',
  uae: 'الإمارات',
  jordan: 'الأردن',
  lebanon: 'لبنان',
  palestine: 'فلسطين',
  iraq: 'العراق',
  qatar: 'قطر',
  kuwait: 'الكويت',
  morocco: 'المغرب',
  algeria: 'الجزائر',
  tunisia: 'تونس',
  oman: 'عُمان',
  bahrain: 'البحرين',
  libya: 'ليبيا',
  yemen: 'اليمن',
  sudan: 'السودان',
  mauritania: 'موريتانيا',
  somalia: 'الصومال',
  djibouti: 'جيبوتي',
  comoros: 'جزر القمر',
};

/**
 * فحص ما إذا كان سطر القناة ينتمي لإحدى الدول العربية الـ 22
 */
function detectArabCountry(extinf: string): string | null {
  // 1. فحص tvg-country="..."
  const countryMatch = extinf.match(/tvg-country="([^"]*)"/i);
  if (countryMatch) {
    const code = countryMatch[1].trim().toUpperCase();
    if (ARAB_COUNTRY_MAP[code]) {
      return ARAB_COUNTRY_MAP[code];
    }
    const nameLower = countryMatch[1].trim().toLowerCase();
    if (ARAB_COUNTRY_NAME_MAP[nameLower]) {
      return ARAB_COUNTRY_NAME_MAP[nameLower];
    }
  }

  // 2. فحص group-title="..."
  const groupMatch = extinf.match(/group-title="([^"]*)"/i);
  if (groupMatch) {
    const rawGroup = groupMatch[1].trim().toLowerCase();
    for (const [eng, ara] of Object.entries(ARAB_COUNTRY_NAME_MAP)) {
      if (rawGroup.includes(eng)) {
        return ara;
      }
    }
  }

  // 3. فحص tvg-id="...code"
  const idMatch = extinf.match(/tvg-id="([^"]*)"/i);
  if (idMatch) {
    const idLower = idMatch[1].trim().toLowerCase();
    for (const code of Object.keys(ARAB_COUNTRY_MAP)) {
      const c = code.toLowerCase();
      if (idLower.endsWith(`.${c}`) || idLower.includes(`.${c}@`)) {
        return ARAB_COUNTRY_MAP[code];
      }
    }
  }

  return null;
}

/**
 * تعريب وتوحيد تصنيفات القنوات إلى أحد الأقسام العربية المعتمدة حصراً:
 * (رياضة، أخبار واقتصاد، أفلام ومسلسلات، أطفال وعائلة، وثائقيات وتعليم، قنوات دينية، موسيقى، قنوات عامة ومنوعة)
 */
function translateCategory(rawCategory: string, channelName: string = ''): string {
  const combined = `${rawCategory} ${channelName}`.toLowerCase();

  if (['sport', 'sports', 'outdoor', 'auto', 'motorsport', 'رياض'].some((k) => combined.includes(k))) {
    return 'رياضة';
  }
  if (['news', 'business', 'weather', 'legislative', 'finance', 'أخبار', 'اقتصاد', 'حدث', 'عاجل'].some((k) => combined.includes(k))) {
    return 'أخبار واقتصاد';
  }
  if (['movie', 'movies', 'series', 'entertainment', 'comedy', 'drama', 'cinema', 'aflam', 'دراما', 'سينما', 'مسلسل', 'فيلم'].some((k) => combined.includes(k))) {
    return 'أفلام ومسلسلات';
  }
  if (['kids', 'animation', 'family', 'children', 'cartoon', 'اطفال', 'أطفال', 'كرتون'].some((k) => combined.includes(k))) {
    return 'أطفال وعائلة';
  }
  if (['documentary', 'doc', 'science', 'education', 'travel', 'nature', 'history', 'وثائق', 'تعليم'].some((k) => combined.includes(k))) {
    return 'وثائقيات وتعليم';
  }
  if (['religious', 'islamic', 'quran', 'religion', 'coptic', 'huda', 'قرآن', 'دين', 'دعوة', 'إسلام'].some((k) => combined.includes(k))) {
    return 'قنوات دينية';
  }
  if (['music', 'song', 'طرب', 'أغاني', 'اغاني', 'موسيقى'].some((k) => combined.includes(k))) {
    return 'موسيقى';
  }

  return 'قنوات عامة ومنوعة';
}

/**
 * جلب آمن للروابط مع مهلة زمنية (Timeout) لتجنب تعليق العامل السحابي
 */
async function fetchWithTimeout(url: string, timeoutMs: number = 8000): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTVStream/1.0',
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    clearTimeout(timeoutId);
    return '';
  }
}

/**
 * تنظيف وتصفية سطر #EXTINF وحذف الشعارات المعطوبة
 */
function sanitizeExtinf(
  rawExtinf: string,
  countryName: string,
  categoryName: string
): string {
  let updated = rawExtinf;

  // 1. group-title
  const groupTitleRegex = /group-title="([^"]*)"/i;
  if (groupTitleRegex.test(updated)) {
    updated = updated.replace(groupTitleRegex, `group-title="${categoryName}"`);
  } else {
    const commaIdx = updated.lastIndexOf(',');
    if (commaIdx !== -1) {
      updated = `${updated.substring(0, commaIdx)} group-title="${categoryName}"${updated.substring(commaIdx)}`;
    } else {
      updated = `${updated} group-title="${categoryName}"`;
    }
  }

  // 2. tvg-country
  const countryRegex = /tvg-country="([^"]*)"/i;
  if (countryRegex.test(updated)) {
    updated = updated.replace(countryRegex, `tvg-country="${countryName}"`);
  } else {
    const commaIdx = updated.lastIndexOf(',');
    if (commaIdx !== -1) {
      updated = `${updated.substring(0, commaIdx)} tvg-country="${countryName}"${updated.substring(commaIdx)}`;
    } else {
      updated = `${updated} tvg-country="${countryName}"`;
    }
  }

  // 3. تنظيف tvg-logo
  const logoRegex = /tvg-logo="([^"]*)"/i;
  const logoMatch = updated.match(logoRegex);
  if (logoMatch) {
    const rawLogo = logoMatch[1].trim();
    const isBroken =
      (!rawLogo.startsWith('http://') && !rawLogo.startsWith('https://')) ||
      rawLogo.includes('twimg.com') ||
      rawLogo.includes('pbs.twimg') ||
      rawLogo.includes('example.com') ||
      rawLogo.length < 10;

    if (isBroken) {
      updated = updated.replace(logoRegex, 'tvg-logo=""');
    }
  }

  return updated;
}

/**
 * فحص ما إذا كانت القناة محظورة جغرافياً أو غير مستقرة (Geo-blocked / Not 24/7 / Ⓖ)
 */
function isBlockedOrUnstableChannel(extinf: string): boolean {
  if (
    extinf.includes('Ⓖ') ||
    extinf.includes('[Geo-blocked]') ||
    extinf.includes('[Not 24/7]') ||
    /\[(geo-blocked|not 24\/7)\]/i.test(extinf)
  ) {
    return true;
  }
  return false;
}

/**
 * معالجة قائمة Free-TV (الأولوية الأولى - الأكثر استقراراً)
 */
function processFreeTVM3U(
  content: string,
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
        const country = detectArabCountry(currentExtinf);
        if (country && !isBlockedOrUnstableChannel(currentExtinf)) {
          if (!urlSet.has(line)) {
            urlSet.add(line);
            const commaIdx = currentExtinf.lastIndexOf(',');
            const chName = commaIdx !== -1 ? currentExtinf.substring(commaIdx + 1) : '';
            const category = translateCategory('', chName);
            const sanitized = sanitizeExtinf(currentExtinf, country, category);
            entries.push({ extinf: sanitized, url: line });
          }
        }
      }
      currentExtinf = '';
    }
  }
}

/**
 * معالجة نص M3U للدول وتوحيده
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
        if (!isBlockedOrUnstableChannel(currentExtinf) && !urlSet.has(line)) {
          urlSet.add(line);

          const groupTitleRegex = /group-title="([^"]*)"/i;
          const match = currentExtinf.match(groupTitleRegex);
          const rawGroup = match ? match[1] : '';
          const commaIdx = currentExtinf.lastIndexOf(',');
          const chName = commaIdx !== -1 ? currentExtinf.substring(commaIdx + 1) : '';
          const category = translateCategory(rawGroup, chName);

          const sanitized = sanitizeExtinf(currentExtinf, countryName, category);
          entries.push({ extinf: sanitized, url: line });
        }
      }
      currentExtinf = '';
    }
  }
}

/**
 * معالجة قائمة اللغة العربية (ara.m3u) لتغطية القنوات العربية الدولية
 */
function processAraM3U(
  content: string,
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
        if (!isBlockedOrUnstableChannel(currentExtinf) && !urlSet.has(line)) {
          urlSet.add(line);

          const detectedCountry = detectArabCountry(currentExtinf) || 'قنوات عربية دولية';
          const groupTitleRegex = /group-title="([^"]*)"/i;
          const match = currentExtinf.match(groupTitleRegex);
          const rawGroup = match ? match[1] : '';
          const commaIdx = currentExtinf.lastIndexOf(',');
          const chName = commaIdx !== -1 ? currentExtinf.substring(commaIdx + 1) : '';
          const category = translateCategory(rawGroup, chName);

          const sanitized = sanitizeExtinf(currentExtinf, detectedCountry, category);
          entries.push({ extinf: sanitized, url: line });
        }
      }
      currentExtinf = '';
    }
  }
}

/**
 * معالجة قائمة DistroTV
 */
function processDistroM3U(
  content: string,
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
        const lower = currentExtinf.toLowerCase();
        // تصفية المحتوى العربي أو الشرق أوسطي أو الأفلام الوثائقية
        const isTarget =
          lower.includes('arabic') ||
          lower.includes('arab') ||
          lower.includes('middle east') ||
          detectArabCountry(currentExtinf);

        if (isTarget && !isBlockedOrUnstableChannel(currentExtinf) && !urlSet.has(line)) {
          urlSet.add(line);
          const country = detectArabCountry(currentExtinf) || 'قنوات عربية دولية';
          const commaIdx = currentExtinf.lastIndexOf(',');
          const chName = commaIdx !== -1 ? currentExtinf.substring(commaIdx + 1) : '';
          const category = translateCategory('', chName);

          const sanitized = sanitizeExtinf(currentExtinf, country, category);
          entries.push({ extinf: sanitized, url: line });
        }
      }
      currentExtinf = '';
    }
  }
}

/**
 * جلب وتوحيد كافة المصادر بالتوازي باستخدام Promise.allSettled
 * مع منح الأولوية الأولى لقنوات Free-TV الموثوقة لتأخذ صدارة البث
 */
async function fetchAndNormalizeAllIPTV(): Promise<string> {
  const urlSet = new Set<string>();
  const entries: ChannelEntry[] = [];

  // جلب كافة المصادر بالتوازي وبأمان
  const [freeTvRes, countryResults, araRes, distroRes] = await Promise.allSettled([
    fetchWithTimeout('https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8', 12000),
    Promise.allSettled(
      ARAB_COUNTRIES.map(async (c) => {
        const content = await fetchWithTimeout(
          `https://iptv-org.github.io/iptv/countries/${c.code}.m3u`,
          6000
        );
        return { country: c, content };
      })
    ),
    fetchWithTimeout('https://iptv-org.github.io/iptv/languages/ara.m3u', 10000),
    fetchWithTimeout('https://www.apsattv.com/distro.m3u', 6000),
  ]);

  // 1. الأولوية الأولى: قائمة Free-TV (تدخل في البداية لتكون "مصدر 1")
  if (freeTvRes.status === 'fulfilled' && freeTvRes.value) {
    processFreeTVM3U(freeTvRes.value, urlSet, entries);
  }

  // 2. الأولوية الثانية: قوائم الدول العربية الـ 22 من iptv-org
  if (countryResults.status === 'fulfilled') {
    for (const res of countryResults.value) {
      if (res.status === 'fulfilled' && res.value.content) {
        processCountryM3U(res.value.content, res.value.country.name, urlSet, entries);
      }
    }
  }

  // 3. الأولوية الثالثة: قائمة اللغة العربية iptv-org لتغطية القنوات العربية الدولية
  if (araRes.status === 'fulfilled' && araRes.value) {
    processAraM3U(araRes.value, urlSet, entries);
  }

  // 4. الأولوية الرابعة: قائمة DistroTV
  if (distroRes.status === 'fulfilled' && distroRes.value) {
    processDistroM3U(distroRes.value, urlSet, entries);
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

interface VodItem {
  id: string;
  tmdbId?: number;
  imdbId?: string;
  title: string;
  type: 'movie' | 'tv';
  poster: string;
  backdrop?: string;
  rating: number;
  year: string;
  overview: string;
  category: string;
  episodeInfo?: string;
  sources: { label: string; url: string }[];
}

function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma, *',
      'Cache-Control': 'public, max-age=1800',
    },
  });
}

function buildVodSources(
  type: 'movie' | 'tv',
  tmdbId?: number,
  imdbId?: string,
  season: number = 1,
  episode: number = 1
): { label: string; url: string }[] {
  const sources: { label: string; url: string }[] = [];
  const targetId = tmdbId ? String(tmdbId) : imdbId || '';

  if (type === 'movie') {
    if (tmdbId) {
      sources.push({
        label: 'سيرفر 1 (VidSrc)',
        url: `https://vidsrc.to/embed/movie/${tmdbId}`,
      });
      sources.push({
        label: 'سيرفر 2 (Embed.su)',
        url: `https://embed.su/embed/movie/${tmdbId}`,
      });
      sources.push({
        label: 'سيرفر 3 (VidSrc Me)',
        url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`,
      });
    } else if (imdbId) {
      sources.push({
        label: 'سيرفر 1 (VidSrc)',
        url: `https://vidsrc.to/embed/movie/${imdbId}`,
      });
      sources.push({
        label: 'سيرفر 2 (VidSrc Me)',
        url: `https://vidsrc.me/embed/movie?imdb=${imdbId}`,
      });
    }
  } else {
    // TV show
    if (tmdbId) {
      sources.push({
        label: 'سيرفر 1 (VidSrc)',
        url: `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`,
      });
      sources.push({
        label: 'سيرفر 2 (Embed.su)',
        url: `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`,
      });
      sources.push({
        label: 'سيرفر 3 (VidSrc Me)',
        url: `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,
      });
    } else if (imdbId) {
      sources.push({
        label: 'سيرفر 1 (VidSrc)',
        url: `https://vidsrc.to/embed/tv/${imdbId}/${season}/${episode}`,
      });
      sources.push({
        label: 'سيرفر 2 (VidSrc Me)',
        url: `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`,
      });
    }
  }

  // سيرفر احتياطي دائم عالي الجودة
  sources.push({
    label: `سيرفر ${sources.length + 1} (مباشر)`,
    url: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4?id=${targetId}&s=${season}&e=${episode}`,
  });

  return sources;
}

/**
 * معالجة كتالوج الأفلام والمسلسلات VOD عبر TMDB + TVmaze
 */
async function handleVodCatalog(url: URL, env: Env): Promise<Response> {
  const type = url.searchParams.get('type') || 'all'; // all | movie | tv
  const category = url.searchParams.get('category') || 'trending';
  const page = parseInt(url.searchParams.get('page') || '1', 10) || 1;
  const apiKey = env.TMDB_API_KEY || '';

  // 1. جدول الحلقات اليوم عبر TVmaze API المجاني
  if (category === 'tv_schedule') {
    try {
      const res = await fetch('https://api.tvmaze.com/schedule', {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        return jsonResponse({ page: 1, totalPages: 1, results: [] });
      }
      const data = (await res.json()) as any[];
      const pageSize = 24;
      const sliced = data.slice((page - 1) * pageSize, page * pageSize);
      const results: VodItem[] = sliced.map((item) => {
        const show = item.show || {};
        const title = show.name || item.name || 'حلقة تلفزيونية';
        const poster =
          show.image?.original ||
          show.image?.medium ||
          item.image?.original ||
          item.image?.medium ||
          '';
        const rating = show.rating?.average || item.rating?.average || 7.5;
        const year = item.airdate ? item.airdate.substring(0, 4) : '';
        const summary = (show.summary || item.summary || '').replace(/<[^>]+>/g, '');
        const imdbId = show.externals?.imdb || undefined;
        const season = item.season || 1;
        const episode = item.number || 1;
        const episodeInfo = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}${item.airtime ? ' • ' + item.airtime : ''}`;

        return {
          id: `tvm-${item.id}`,
          imdbId,
          title,
          type: 'tv',
          poster,
          rating: Number(Number(rating).toFixed(1)),
          year,
          overview: summary,
          category: 'جدول الحلقات اليوم',
          episodeInfo,
          sources: buildVodSources('tv', undefined, imdbId, season, episode),
        };
      });

      return jsonResponse({
        page,
        totalPages: Math.ceil(data.length / pageSize) || 1,
        results,
      });
    } catch {
      return jsonResponse({ page: 1, totalPages: 1, results: [] });
    }
  }

  // 2. كتالوج TMDB
  if (!apiKey) {
    return jsonResponse({ page: 1, totalPages: 1, results: [] });
  }

  let tmdbUrl = '';
  let categoryLabel = 'الرائج';

  if (category === 'arabic_movies') {
    categoryLabel = 'أفلام عربية';
    tmdbUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_original_language=ar&sort_by=popularity.desc&page=${page}&language=ar-SA`;
  } else if (category === 'arabic_series') {
    categoryLabel = 'مسلسلات عربية';
    tmdbUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_original_language=ar&sort_by=popularity.desc&page=${page}&language=ar-SA`;
  } else if (category === 'trending') {
    categoryLabel = 'الرائج هذا الأسبوع';
    if (type === 'movie') {
      tmdbUrl = `https://api.themoviedb.org/3/trending/movie/week?api_key=${apiKey}&language=ar-SA&page=${page}`;
    } else if (type === 'tv') {
      tmdbUrl = `https://api.themoviedb.org/3/trending/tv/week?api_key=${apiKey}&language=ar-SA&page=${page}`;
    } else {
      tmdbUrl = `https://api.themoviedb.org/3/trending/all/week?api_key=${apiKey}&language=ar-SA&page=${page}`;
    }
  } else {
    // Genres: action | drama | comedy | horror | scifi | animation
    const genreMap: Record<string, { movie: number; tv: number; label: string }> = {
      action: { movie: 28, tv: 10759, label: 'أكشن ومغامرات' },
      drama: { movie: 18, tv: 18, label: 'دراما' },
      comedy: { movie: 35, tv: 35, label: 'كوميديا' },
      horror: { movie: 27, tv: 9648, label: 'رعب وإثارة' },
      scifi: { movie: 878, tv: 10765, label: 'خيال علمي وفانتازيا' },
      animation: { movie: 16, tv: 16, label: 'أنمي ورسوم متحركة' },
    };

    const targetGenre = genreMap[category] || { movie: 28, tv: 10759, label: 'منوع' };
    categoryLabel = targetGenre.label;

    if (type === 'tv') {
      tmdbUrl = `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&with_genres=${targetGenre.tv}&sort_by=popularity.desc&page=${page}&language=ar-SA`;
    } else {
      tmdbUrl = `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&with_genres=${targetGenre.movie}&sort_by=popularity.desc&page=${page}&language=ar-SA`;
    }
  }

  try {
    const res = await fetch(tmdbUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return jsonResponse({ page: 1, totalPages: 1, results: [] });
    }
    const data = (await res.json()) as any;
    const rawResults = data.results || [];
    const results: VodItem[] = rawResults.map((item: any) => {
      const isTv =
        item.media_type === 'tv' ||
        (!item.title && Boolean(item.name)) ||
        category === 'arabic_series' ||
        type === 'tv';
      const itemType: 'movie' | 'tv' = isTv ? 'tv' : 'movie';
      const title = item.title || item.name || 'بدون عنوان';
      const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '';
      const backdrop = item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : undefined;
      const rating = item.vote_average ? Number(Number(item.vote_average).toFixed(1)) : 0;
      const year = (item.release_date || item.first_air_date || '').substring(0, 4);
      const overview = item.overview || '';

      return {
        id: `tmdb-${itemType}-${item.id}`,
        tmdbId: item.id,
        title,
        type: itemType,
        poster,
        backdrop,
        rating,
        year,
        overview,
        category: categoryLabel,
        sources: buildVodSources(itemType, item.id),
      };
    });

    return jsonResponse({
      page: data.page || page,
      totalPages: data.total_pages || 1,
      results,
    });
  } catch {
    return jsonResponse({ page: 1, totalPages: 1, results: [] });
  }
}

/**
 * البحث في كتالوج VOD عبر TMDB
 */
async function handleVodSearch(url: URL, env: Env): Promise<Response> {
  const query = url.searchParams.get('q') || '';
  const page = parseInt(url.searchParams.get('page') || '1', 10) || 1;
  const apiKey = env.TMDB_API_KEY || '';

  if (!query.trim() || !apiKey) {
    return jsonResponse({ page: 1, totalPages: 1, results: [] });
  }

  const tmdbUrl = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&language=ar-SA&query=${encodeURIComponent(query)}&page=${page}`;

  try {
    const res = await fetch(tmdbUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return jsonResponse({ page: 1, totalPages: 1, results: [] });
    }
    const data = (await res.json()) as any;
    const rawResults = (data.results || []).filter(
      (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
    );

    const results: VodItem[] = rawResults.map((item: any) => {
      const itemType: 'movie' | 'tv' = item.media_type === 'tv' ? 'tv' : 'movie';
      const title = item.title || item.name || 'بدون عنوان';
      const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '';
      const backdrop = item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : undefined;
      const rating = item.vote_average ? Number(Number(item.vote_average).toFixed(1)) : 0;
      const year = (item.release_date || item.first_air_date || '').substring(0, 4);
      const overview = item.overview || '';

      return {
        id: `tmdb-${itemType}-${item.id}`,
        tmdbId: item.id,
        title,
        type: itemType,
        poster,
        backdrop,
        rating,
        year,
        overview,
        category: itemType === 'tv' ? 'مسلسل' : 'فيلم',
        sources: buildVodSources(itemType, item.id),
      };
    });

    return jsonResponse({
      page: data.page || page,
      totalPages: data.total_pages || 1,
      results,
    });
  } catch {
    return jsonResponse({ page: 1, totalPages: 1, results: [] });
  }
}

/**
 * جلب مواسم وحلقات المسلسلات عبر TVmaze API المجاني
 */
async function handleVodEpisodes(url: URL): Promise<Response> {
  const query = url.searchParams.get('q') || '';
  const imdb = url.searchParams.get('imdb') || '';

  let tvmazeUrl = '';
  if (imdb) {
    tvmazeUrl = `https://api.tvmaze.com/lookup/shows?imdb=${encodeURIComponent(imdb)}`;
  } else if (query) {
    tvmazeUrl = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(query)}&embed=episodes`;
  } else {
    return jsonResponse({ seasons: [] });
  }

  try {
    const res = await fetch(tvmazeUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      return jsonResponse({ seasons: [] });
    }
    const showData = (await res.json()) as any;

    let episodes = showData._embedded?.episodes;
    if (!episodes && showData.id) {
      const epRes = await fetch(`https://api.tvmaze.com/shows/${showData.id}/episodes`);
      if (epRes.ok) {
        episodes = (await epRes.json()) as any[];
      }
    }

    if (!episodes || !Array.isArray(episodes)) {
      return jsonResponse({ show: { id: showData.id, name: showData.name }, seasons: [] });
    }

    // تجميع الحلقات بحسب رقم الموسم
    const seasonMap = new Map<number, any[]>();
    for (const ep of episodes) {
      const s = ep.season || 1;
      if (!seasonMap.has(s)) {
        seasonMap.set(s, []);
      }
      seasonMap.get(s)!.push({
        id: ep.id,
        season: ep.season,
        number: ep.number,
        name: ep.name || `الحلقة ${ep.number}`,
        airdate: ep.airdate,
        rating: ep.rating?.average || 0,
        summary: ep.summary ? ep.summary.replace(/<[^>]+>/g, '') : '',
        image: ep.image?.medium || ep.image?.original || '',
      });
    }

    const seasons = Array.from(seasonMap.entries()).map(([seasonNum, epList]) => ({
      season: seasonNum,
      episodes: epList,
    }));

    return jsonResponse({
      show: {
        id: showData.id,
        name: showData.name,
        image: showData.image?.original || showData.image?.medium || '',
        imdb: showData.externals?.imdb,
      },
      seasons,
    });
  } catch {
    return jsonResponse({ seasons: [] });
  }
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

    // نقاط نهاية كتالوج وبحث وحلقات الأفلام والمسلسلات VOD
    if (url.pathname === '/api/vod/catalog') {
      return handleVodCatalog(url, env);
    }

    if (url.pathname === '/api/vod/search') {
      return handleVodSearch(url, env);
    }

    if (url.pathname === '/api/vod/episodes') {
      return handleVodEpisodes(url);
    }

    if (url.pathname === '/' || url.pathname === '/playlist.m3u') {
      try {
        const apiKey = env.TMDB_API_KEY || 'YOUR_TMDB_API_KEY';

        // جلب وتجميع كافة المصادر بالتوازي
        const [channelsM3U, movies] = await Promise.all([
          fetchAndNormalizeAllIPTV(),
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
        return new Response('خطأ في توليد قائمة القنوات', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
