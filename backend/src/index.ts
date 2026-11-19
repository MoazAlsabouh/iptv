export interface Env {
  TMDB_API_KEY?: string;
  WYZIE_API_KEY?: string;
  OPENSUBTITLES_API_KEY?: string;
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
  releaseDate?: string;
  isUnreleased?: boolean;
  originalLanguage?: string;
  sources: { label: string; url: string; type?: 'embed' | 'direct' }[];
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
      const today = new Date().toISOString().split('T')[0];
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
        const releaseDate = item.airdate || '';
        const year = releaseDate ? releaseDate.substring(0, 4) : '';
        const isUnreleased = Boolean(releaseDate && releaseDate > today);
        const summary = (show.summary || item.summary || '').replace(/<[^>]+>/g, '');
        const imdbId = show.externals?.imdb || undefined;
        const season = item.season || 1;
        const episode = item.number || 1;
        const episodeInfo = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}${item.airtime ? ' • ' + item.airtime : ''}`;

        const originalLanguage = show.language?.toLowerCase() === 'arabic' ? 'ar' : 'en';

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
          releaseDate,
          isUnreleased,
          originalLanguage,
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
    const today = new Date().toISOString().split('T')[0];
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
      const releaseDate = item.release_date || item.first_air_date || '';
      const year = releaseDate ? releaseDate.substring(0, 4) : '';
      const isUnreleased = Boolean(releaseDate && releaseDate > today);
      const originalLanguage = item.original_language || (category === 'arabic_movies' || category === 'arabic_series' ? 'ar' : 'en');
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
        releaseDate,
        isUnreleased,
        originalLanguage,
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

    const today = new Date().toISOString().split('T')[0];
    const results: VodItem[] = rawResults.map((item: any) => {
      const itemType: 'movie' | 'tv' = item.media_type === 'tv' ? 'tv' : 'movie';
      const title = item.title || item.name || 'بدون عنوان';
      const poster = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '';
      const backdrop = item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : undefined;
      const rating = item.vote_average ? Number(Number(item.vote_average).toFixed(1)) : 0;
      const releaseDate = item.release_date || item.first_air_date || '';
      const year = releaseDate ? releaseDate.substring(0, 4) : '';
      const isUnreleased = Boolean(releaseDate && releaseDate > today);
      const originalLanguage = item.original_language || 'en';
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
        releaseDate,
        isUnreleased,
        originalLanguage,
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
 * جلب مواسم وحلقات المسلسلات عبر TMDB أولاً ثم TVmaze API كبديل
 */
async function handleVodEpisodes(url: URL, env: Env): Promise<Response> {
  const tmdbId = url.searchParams.get('tmdbId') || '';
  const query = url.searchParams.get('q') || '';
  const imdb = url.searchParams.get('imdb') || '';
  const apiKey = env.TMDB_API_KEY || '';

  // 1. الأولوية الأولى: جلب المواسم والحلقات الدقيقة من TMDB إذا توفر المعرف ومفتاح API
  if (tmdbId && apiKey) {
    try {
      const showRes = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKey}&language=ar-SA`,
        { headers: { Accept: 'application/json' } }
      );

      if (showRes.ok) {
        const showData = (await showRes.json()) as any;
        const allSeasons = (showData.seasons || []) as any[];

        // استبعاد الموسم 0 (الحلقات الخاصة Specials) إذا كانت هناك مواسم فعلية
        let targetSeasons = allSeasons.filter((s) => s.season_number > 0);
        if (targetSeasons.length === 0 && allSeasons.length > 0) {
          targetSeasons = allSeasons;
        }

        // جلب حلقات جميع المواسم بالتوازي وبأمان
        const seasonResults = await Promise.allSettled(
          targetSeasons.map(async (sItem) => {
            const sNum = sItem.season_number;
            const sRes = await fetch(
              `https://api.themoviedb.org/3/tv/${tmdbId}/season/${sNum}?api_key=${apiKey}&language=ar-SA`,
              { headers: { Accept: 'application/json' } }
            );

            if (sRes.ok) {
              return { season: sNum, data: await sRes.json() };
            }

            // محاولة بديلة دون تحديد اللغة إذا لم تتوفر ترجمة عربية لأسماء الحلقات
            const fallbackRes = await fetch(
              `https://api.themoviedb.org/3/tv/${tmdbId}/season/${sNum}?api_key=${apiKey}`,
              { headers: { Accept: 'application/json' } }
            );
            if (fallbackRes.ok) {
              return { season: sNum, data: await fallbackRes.json() };
            }

            return { season: sNum, data: null };
          })
        );

        const seasonsOutput: { season: number; episodes: any[] }[] = [];

        for (const res of seasonResults) {
          if (res.status === 'fulfilled' && res.value && res.value.data) {
            const sNum = res.value.season;
            const rawEps = (res.value.data.episodes || []) as any[];
            const mappedEpisodes = rawEps.map((ep) => ({
              id: ep.id,
              season: ep.season_number || sNum,
              number: ep.episode_number,
              name: ep.name || `الحلقة ${ep.episode_number}`,
              airdate: ep.air_date,
              rating: ep.vote_average ? Number(Number(ep.vote_average).toFixed(1)) : 0,
              summary: ep.overview || '',
              image: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : '',
            }));

            if (mappedEpisodes.length > 0) {
              seasonsOutput.push({
                season: sNum,
                episodes: mappedEpisodes,
              });
            }
          }
        }

        if (seasonsOutput.length > 0) {
          seasonsOutput.sort((a, b) => a.season - b.season);

          return jsonResponse({
            show: {
              id: showData.id,
              name: showData.name || showData.original_name,
              image: showData.poster_path ? `https://image.tmdb.org/t/p/w500${showData.poster_path}` : '',
              imdb: showData.external_ids?.imdb_id,
            },
            seasons: seasonsOutput,
          });
        }
      }
    } catch (err) {
      console.warn('[TMDB Episodes fetch error, falling back to TVmaze]:', err);
    }
  }

  // 2. بديل TVmaze المجاني في حال عدم توفر معرف TMDB أو تعذر الاتصال
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

/**
 * تحويل مدة الفيديو النصية (مثل "44:20" أو "1:15:30") إلى ثوانٍ
 */
function parseDurationToSeconds(durationStr: string): number {
  if (!durationStr) return 0;
  const normalized = durationStr.replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
  const parts = normalized.split(':').map((p) => parseInt(p.trim(), 10) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

/**
 * استخراج كائنات videoRenderer من كائن ytInitialData
 */
function findVideoRenderers(obj: any, results: any[] = []): any[] {
  if (!obj || typeof obj !== 'object') return results;
  if (obj.videoRenderer) {
    results.push(obj.videoRenderer);
    if (results.length >= 25) return results;
  }
  for (const key of Object.keys(obj)) {
    if (key !== 'videoRenderer') {
      findVideoRenderers(obj[key], results);
      if (results.length >= 25) return results;
    }
  }
  return results;
}

/**
 * فحص قابلية تضمين وتشغيل فيديو يوتيوب داخل iframe
 * واستبعاد الفيديوهات المقيدة بالعمر أو المعطل بها التضمين
 */
async function checkYouTubeEmbedPlayable(
  videoId: string,
  timeoutMs: number = 2500
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const res = await fetch(embedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en,ar;q=0.9',
      },
    });

    if (!res.ok) {
      return false;
    }

    const html = await res.text();
    const lower = html.toLowerCase();

    // مؤشرات الحظر والتقييد العمري أو منع التضمين
    const isRestricted =
      html.includes('LOGIN_REQUIRED') ||
      html.includes('UNPLAYABLE') ||
      html.includes('EMBEDDING_DISABLED') ||
      html.includes('AGE_VERIFICATION_REQUIRED') ||
      lower.includes('age-restricted') ||
      lower.includes('confirm your age') ||
      lower.includes('sign in to confirm your age');

    return !isRestricted;
  } catch {
    // في حال انتهاء المهلة أو حدوث خطأ، يعتبر الفيديو غير متاح
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * تسوية وتوحيد النصوص العربية لإزالة التشكيل وتوحيد الحروف المتشابهة
 */
function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[\u0660-\u0669]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
    .replace(/[\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ARABIC_ORDINALS: Record<number, string[]> = {
  1: ['الاولي', 'الاول', 'واحد'],
  2: ['الثانيه', 'الثاني', 'اثنين'],
  3: ['الثالثه', 'الثالث', 'ثلاثه'],
  4: ['الرابعه', 'الرابع', 'اربعه'],
  5: ['الخامسه', 'الخامس', 'خمسه'],
  6: ['السادسه', 'السادس', 'سته'],
  7: ['السابعه', 'السابع', 'سبعه'],
  8: ['الثامنه', 'الثامن', 'ثمانيه'],
  9: ['التاسعه', 'التاسع', 'تسعه'],
  10: ['العاشره', 'العاشر', 'عشره'],
  11: ['الحاديه عشره', 'الحادي عشر'],
  12: ['الثانيه عشره', 'الثاني عشر'],
  13: ['الثالثه عشره', 'الثالث عشر'],
  14: ['الرابعه عشره', 'الرابع عشر'],
  15: ['الخامسه عشره', 'الخامس عشر'],
  16: ['السادسه عشره', 'السادس عشر'],
  17: ['السابعه عشره', 'السابع عشر'],
  18: ['الثامنه عشره', 'الثامن عشر'],
  19: ['التاسعه عشره', 'التاسع عشر'],
  20: ['العشرون', 'العشرين'],
  21: ['الحاديه والعشرون', 'الحاديه والعشرين'],
  22: ['الثانيه والعشرون', 'الثانيه والعشرين'],
  23: ['الثالثه والعشرون', 'الثالثه والعشرين'],
  24: ['الرابعه والعشرون', 'الرابعه والعشرين'],
  25: ['الخامسه والعشرون', 'الخامسه والعشرين'],
  26: ['السادسه والعشرون', 'السادسه والعشرين'],
  27: ['السابعه والعشرون', 'السابعه والعشرين'],
  28: ['الثامنه والعشرون', 'الثامنه والعشرين'],
  29: ['التاسعه والعشرون', 'التاسعه والعشرين'],
  30: ['الثلاثون', 'الثلاثين'],
};

function checkEpisodeMatch(normTitle: string, episode: number): boolean {
  // 1. فحص مباشر لأرقام الحلقات الصريحة مثل: حلقة 1، الحلقة 1، ح 1، ep 1
  const epPattern = /(?:حلقه|الحلقه|ح|ep|episode|e)\s*[:#\-]?\s*(\d+)/i;
  const match = normTitle.match(epPattern);
  if (match) {
    const num = parseInt(match[1], 10);
    return num === episode;
  }

  // 2. فحص الكلمات الترتيبية (الأولى، الثانية...)
  const ordinals = ARABIC_ORDINALS[episode] || [];
  for (const ord of ordinals) {
    const normOrd = normalizeArabic(ord);
    if (new RegExp('(?:^|\\s)' + normOrd + '(?:$|\\s)').test(normTitle)) {
      return true;
    }
  }

  // 3. فحص الرقم ككلمة مستقلة (بما في ذلك 01 إذا كانت 1)
  const padded = episode < 10 ? '0' + episode : String(episode);
  const looseNum = new RegExp('(?:^|\\s)(?:' + episode + '|' + padded + ')(?:$|\\s)').test(normTitle);
  return looseNum;
}

function wordMatches(normVid: string, word: string): boolean {
  if (normVid.includes(word)) return true;
  if (word.startsWith('و') && word.length > 3 && normVid.includes(word.slice(1))) return true;
  if (word.startsWith('ال') && word.length > 4 && normVid.includes(word.slice(2))) return true;
  return false;
}

/**
 * فحص التطابق الدقيق لعنوان الفيديو العربي ورقم الحلقة (Title Relevance Check)
 */
function isArabicTitleRelevant(
  videoTitle: string,
  targetTitle: string,
  isTv: boolean,
  episode: number
): boolean {
  const normVid = normalizeArabic(videoTitle);
  const normTarget = normalizeArabic(targetTitle);

  const stopWords = new Set([
    'مسلسل',
    'فيلم',
    'كامل',
    'كامله',
    'hd',
    'الجزء',
    'الموسم',
    'الحلقه',
    'حلقه',
  ]);
  let targetWords = normTarget.split(' ').filter((w) => w.length > 1 && !stopWords.has(w));

  if (targetWords.length === 0) {
    targetWords = normTarget.split(' ').filter((w) => w.length > 0);
  }

  let matchedWords = 0;
  for (const w of targetWords) {
    if (wordMatches(normVid, w)) {
      matchedWords++;
    }
  }

  const ratio = targetWords.length > 0 ? matchedWords / targetWords.length : 1;
  if (ratio < 0.6) {
    return false;
  }

  if (isTv) {
    return checkEpisodeMatch(normVid, episode);
  }

  return true;
}

/**
 * فحص نتائج البحث المباشرة من موقع يوتيوب واستخراج الفيديوهات الطويلة الكاملة
 * مع فحص التضمين الذكي وفحص تطابق العنوان والحلقة بدقة
 */
async function searchYouTubeDirect(
  query: string,
  isMovie: boolean,
  targetTitle?: string,
  episode?: number
): Promise<{ label: string; url: string; type: 'embed' }[]> {
  const minSeconds = isMovie ? 55 * 60 : 20 * 60; // 55 دقيقة للأفلام، 20 دقيقة لحلقات المسلسلات
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'ar,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const html = await res.text();
    const marker = 'ytInitialData = ';
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) return [];

    const jsonStart = startIdx + marker.length;
    const endIdx = html.indexOf(';</script>', jsonStart);
    if (endIdx === -1) return [];

    const jsonStr = html.substring(jsonStart, endIdx);
    const ytData = JSON.parse(jsonStr);
    const renderers = findVideoRenderers(ytData);

    const candidates: { id: string; title: string }[] = [];

    for (const r of renderers) {
      const videoId = r.videoId;
      const title = r.title?.runs?.[0]?.text || r.title?.simpleText || '';
      const durationText =
        r.lengthText?.simpleText ||
        r.thumbnailOverlays?.find((o: any) => o.thumbnailOverlayTimeStatusRenderer)
          ?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText ||
        '';

      const seconds = parseDurationToSeconds(durationText);
      if (videoId && seconds >= minSeconds) {
        if (targetTitle) {
          const isTv = !isMovie;
          if (!isArabicTitleRelevant(title, targetTitle, isTv, episode || 1)) {
            continue;
          }
        }
        candidates.push({ id: videoId, title });
        if (candidates.length >= 5) break; // أخذ أفضل 5 مرشحين بدلاً من 2
      }
    }

    if (candidates.length === 0) {
      return [];
    }

    // فحص قابلية التضمين للمرشحين بالتوازي (Promise.allSettled مع مهلة 2.5 ثانية)
    const checkResults = await Promise.allSettled(
      candidates.map((c) => checkYouTubeEmbedPlayable(c.id, 2500))
    );

    const playableVideos: { id: string; title: string }[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const check = checkResults[i];
      if (check.status === 'fulfilled' && check.value === true) {
        playableVideos.push(candidates[i]);
        if (playableVideos.length >= 2) break; // أخذ أول نتيجتين سليمتين وقابلتين للتضمين
      }
    }

    if (playableVideos.length > 0) {
      return playableVideos.map((v, idx) => ({
        label: idx === 0 ? 'يوتيوب (HD)' : 'يوتيوب (سيرفر 2)',
        url: `https://www.youtube.com/embed/${v.id}?autoplay=1&rel=0`,
        type: 'embed' as const,
      }));
    }
  } catch {
    // تجاهل الأخطاء بهدوء
  }
  return [];
}

/**
 * 1. مزود يوتيوب المباشر مع استعلامات مرنة للمحتوى العربي وفحص التطابق
 */
async function searchYouTubeProvider(
  title: string,
  season: number,
  episode: number,
  type: 'movie' | 'tv'
): Promise<{ label: string; url: string; type: 'embed' }[]> {
  const isMovie = type === 'movie';
  let primaryQuery = '';
  let fallbackQuery = '';

  if (isMovie) {
    primaryQuery = `${title} فيلم كامل`;
    const shortTitle = title.replace(/^(مسلسل|فيلم|مغامرات|قصة|حكاية|كرتون)\s+/i, '').trim();
    fallbackQuery = `${shortTitle} فيلم`;
  } else {
    primaryQuery =
      season > 1
        ? `${title} الجزء ${season} الحلقة ${episode}`
        : `${title} الحلقة ${episode}`;
    const shortTitle = title.replace(/^(مسلسل|فيلم|مغامرات|قصة|حكاية|كرتون)\s+/i, '').trim();
    fallbackQuery =
      season > 1
        ? `${shortTitle} الجزء ${season} الحلقة ${episode}`
        : `${shortTitle} الحلقة ${episode}`;
  }

  // 1. تجربة البحث بالاستعلام الأساسي مع فحص التطابق
  let results = await searchYouTubeDirect(primaryQuery, isMovie, title, episode);
  if (results.length > 0) return results;

  // 2. تجربة البحث بالاستعلام البديل المختصر
  if (fallbackQuery && fallbackQuery !== primaryQuery) {
    results = await searchYouTubeDirect(fallbackQuery, isMovie, title, episode);
    if (results.length > 0) return results;
  }

  return [];
}

/**
 * 2. مزود Dailymotion الرسمي المجاني (بدون مفتاح API) مع فحص التطابق
 */
async function searchDailymotionProvider(
  query: string,
  isMovie: boolean,
  targetTitle?: string,
  episode?: number
): Promise<{ label: string; url: string; type: 'embed' }[]> {
  const minSeconds = isMovie ? 55 * 60 : 20 * 60;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const searchUrl = `https://api.dailymotion.com/videos?search=${encodeURIComponent(query)}&fields=id,title,duration,embed_url&limit=10`;
    const res = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const data = (await res.json()) as any;
    const list = data.list || [];
    const valid: { id: string; title: string }[] = [];

    for (const item of list) {
      if (item.id && typeof item.duration === 'number' && item.duration >= minSeconds) {
        if (targetTitle) {
          const isTv = !isMovie;
          if (!isArabicTitleRelevant(item.title || '', targetTitle, isTv, episode || 1)) {
            continue;
          }
        }
        valid.push({ id: item.id, title: item.title });
        if (valid.length >= 2) break;
      }
    }

    return valid.map((v, idx) => ({
      label: idx === 0 ? 'ديلي موشن (HD)' : 'ديلي موشن (سيرفر 2)',
      url: `https://www.dailymotion.com/embed/video/${v.id}?autoplay=1`,
      type: 'embed' as const,
    }));
  } catch {
    return [];
  }
}

/**
 * 3. مزود الأرشيف العالمي Archive.org لاستخراج ملفات MP4 المباشرة مع مهلة 4 ثوانٍ
 */
async function searchArchiveProvider(
  title: string
): Promise<{ label: string; url: string; type: 'direct' }[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const cleanTitle = title.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
    if (!cleanTitle) return [];

    const searchUrl = `https://archive.org/advancedsearch.php?q=title:(${encodeURIComponent(cleanTitle)}) AND mediatype:(movies)&fl[]=identifier,title&rows=2&output=json`;
    const res = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const data = (await res.json()) as any;
    const docs = data.response?.docs || [];
    if (docs.length === 0) return [];

    const identifier = docs[0].identifier;
    if (!identifier) return [];

    // جلب ملفات العنصر لاستخراج رابط MP4 مباشر
    const metaController = new AbortController();
    const metaTimeout = setTimeout(() => metaController.abort(), 4000);
    const metaRes = await fetch(`https://archive.org/metadata/${identifier}`, {
      headers: { Accept: 'application/json' },
      signal: metaController.signal,
    });
    clearTimeout(metaTimeout);
    if (!metaRes.ok) return [];

    const metaData = (await metaRes.json()) as any;
    const files = metaData.files || [];
    const mp4File = files.find(
      (f: any) =>
        (f.name && f.name.toLowerCase().endsWith('.mp4')) ||
        f.format === 'h.264' ||
        f.format === '512Kb MPEG4'
    );

    if (mp4File && mp4File.name) {
      const directUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(mp4File.name)}`;
      return [
        {
          label: 'أرشيف مباشر (MP4)',
          url: directUrl,
          type: 'direct',
        },
      ];
    }
  } catch {
    // تجاهل الأخطاء بهدوء
  }
  return [];
}

/**
 * 4. مزود السيرفرات المدمجة المتعددة (VidLink, VidSrc.cc, VidSrc, Embed.su, AutoEmbed, 2Embed, VidSrc Me)
 */
function buildMultiEmbedSources(
  type: 'movie' | 'tv',
  tmdbId?: string,
  imdbId?: string,
  season: number = 1,
  episode: number = 1
): { label: string; url: string; type: 'embed' }[] {
  const list: { label: string; url: string; type: 'embed' }[] = [];

  if (type === 'movie') {
    if (tmdbId) {
      list.push({
        label: 'سيرفر 1 - VidLink',
        url: `https://vidlink.pro/movie/${tmdbId}?primaryColor=38bdf8&autoplay=true`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 2 - VidSrc CC',
        url: `https://vidsrc.cc/v2/embed/movie/${tmdbId}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 3 - VidSrc',
        url: `https://vidsrc.to/embed/movie/${tmdbId}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 4 - Embed.su',
        url: `https://embed.su/embed/movie/${tmdbId}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 5 - AutoEmbed',
        url: `https://player.autoembed.cc/embed/movie/${tmdbId}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 6 - 2Embed',
        url: `https://www.2embed.cc/embed/${tmdbId}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 7 - VidSrc Me',
        url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`,
        type: 'embed',
      });
    } else if (imdbId) {
      list.push({
        label: 'سيرفر 1 - VidLink',
        url: `https://vidlink.pro/movie/${imdbId}?primaryColor=38bdf8&autoplay=true`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 2 - VidSrc CC',
        url: `https://vidsrc.cc/v2/embed/movie/${imdbId}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 3 - VidSrc',
        url: `https://vidsrc.to/embed/movie/${imdbId}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 4 - Embed.su',
        url: `https://embed.su/embed/movie/${imdbId}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 5 - VidSrc Me',
        url: `https://vidsrc.me/embed/movie?imdb=${imdbId}`,
        type: 'embed',
      });
    }
  } else {
    // TV Series
    if (tmdbId) {
      list.push({
        label: 'سيرفر 1 - VidLink',
        url: `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?primaryColor=38bdf8&autoplay=true`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 2 - VidSrc CC',
        url: `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 3 - VidSrc',
        url: `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 4 - Embed.su',
        url: `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 5 - AutoEmbed',
        url: `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 6 - 2Embed',
        url: `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 7 - VidSrc Me',
        url: `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,
        type: 'embed',
      });
    } else if (imdbId) {
      list.push({
        label: 'سيرفر 1 - VidLink',
        url: `https://vidlink.pro/tv/${imdbId}/${season}/${episode}?primaryColor=38bdf8&autoplay=true`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 2 - VidSrc CC',
        url: `https://vidsrc.cc/v2/embed/tv/${imdbId}/${season}/${episode}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 3 - VidSrc',
        url: `https://vidsrc.to/embed/tv/${imdbId}/${season}/${episode}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 4 - Embed.su',
        url: `https://embed.su/embed/tv/${imdbId}/${season}/${episode}`,
        type: 'embed',
      });
      list.push({
        label: 'سيرفر 5 - VidSrc Me',
        url: `https://vidsrc.me/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`,
        type: 'embed',
      });
    }
  }

  return list;
}

/**
 * معالج نقطة النهاية الهجينة /api/vod/sources مع دعم التخزين المؤقت 12 ساعة
 */
async function handleVodSources(request: Request, url: URL): Promise<Response> {
  const cache = (caches as any).default;
  try {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
  } catch {
    // تجاهل أخطاء مطابقة الكاش
  }

  const tmdbId = url.searchParams.get('tmdbId') || '';
  const imdbId = url.searchParams.get('imdbId') || '';
  let title = (url.searchParams.get('title') || '').trim();
  const type = (url.searchParams.get('type') === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
  const rawLang = (url.searchParams.get('lang') || 'en').toLowerCase();
  const season = parseInt(url.searchParams.get('season') || '1', 10) || 1;
  const episode = parseInt(url.searchParams.get('episode') || '1', 10) || 1;

  // إزالة أي لواحق مواسم أو حلقات من العنوان لضمان دقة البحث
  title = title.replace(/\s*-\s*الموسم\s*\d+\s*الحلقة\s*\d+/g, '').replace(/\s*-\s*الحلقة\s*\d+/g, '').trim();

  // التحقق الصارم من اللغة الأصلية: لا يُعتبر العمل عربياً إلا إذا كانت لغته الأصلية صراحة 'ar'
  const isArabic = rawLang === 'ar';

  const embedSources = buildMultiEmbedSources(type, tmdbId, imdbId, season, episode);
  const targetId = tmdbId || imdbId || title || 'sample';
  const backupDirectSource = {
    label: 'سيرفر احتياطي (مباشر)',
    url: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4?id=${encodeURIComponent(targetId)}&s=${season}&e=${episode}`,
    type: 'direct' as const,
  };

  // للأعمال غير العربية: إيقاف يوتيوب وديلي موشن تماماً وإرجاع السيرفرات المدمجة الدقيقة فوراً
  if (!isArabic) {
    const finalSources = [...embedSources, backupDirectSource];
    const response = new Response(JSON.stringify({ sources: finalSources }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma, *',
        'Cache-Control': 'public, max-age=43200',
      },
    });

    try {
      await cache.put(request, response.clone());
    } catch {
      // تجاهل أخطاء وضع الكاش
    }

    return response;
  }

  // للأعمال العربية فقط: تشغيل يوتيوب وديلي موشن مع الفحص الدقيق لتطابق العنوان والحلقة
  let dmQuery = '';
  if (type === 'movie') {
    dmQuery = `${title} فيلم كامل`;
  } else {
    dmQuery =
      season > 1
        ? `${title} الجزء ${season} الحلقة ${episode}`
        : `${title} الحلقة ${episode}`;
  }

  const [ytRes, dmRes, archiveRes] = await Promise.allSettled([
    title ? searchYouTubeProvider(title, season, episode, type) : Promise.resolve([]),
    title ? searchDailymotionProvider(dmQuery, type === 'movie', title, episode) : Promise.resolve([]),
    title && type === 'movie' ? searchArchiveProvider(title) : Promise.resolve([]),
  ]);

  const ytSources = ytRes.status === 'fulfilled' ? ytRes.value : [];
  const dmSources = dmRes.status === 'fulfilled' ? dmRes.value : [];
  const archiveSources = archiveRes.status === 'fulfilled' ? archiveRes.value : [];

  const finalSources: { label: string; url: string; type: 'embed' | 'direct' }[] = [
    ...ytSources,
    ...dmSources,
    ...archiveSources,
    ...embedSources,
    backupDirectSource,
  ];

  const response = new Response(JSON.stringify({ sources: finalSources }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma, *',
      'Cache-Control': 'public, max-age=43200',
    },
  });

  try {
    await cache.put(request, response.clone());
  } catch {
    // تجاهل أخطاء وضع الكاش
  }

  return response;
}

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

/**
 * فك ترميز ملفات الترجمة مع اكتشاف وحل مشكلة الترميز العربي (Windows-1256 vs UTF-8)
 * لإصلاح ظهور أحرف الاستفهام (???) نهائياً
 */
function decodeSubtitleBuffer(buffer: ArrayBuffer): string {
  try {
    const utf8 = new TextDecoder('utf-8').decode(buffer);
    // إذا احتوى النص على رمز الاستبدال \uFFFD الناتج عن ترميز أحادي البايت كـ Windows-1256
    if (utf8.includes('\uFFFD')) {
      try {
        const win1256 = new TextDecoder('windows-1256').decode(buffer);
        return win1256;
      } catch {
        return utf8;
      }
    }
    return utf8;
  } catch {
    try {
      return new TextDecoder('windows-1256').decode(buffer);
    } catch {
      return '';
    }
  }
}

/**
 * تحويل ملفات الترجمة SRT / WebVTT إلى مصفوفة كتل زمنية JSON
 */
function parseSubtitlesToCues(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  const timeRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{3})/;

  function timeToSec(h?: string, m?: string, s?: string, ms?: string): number {
    const hours = parseInt(h || '0', 10);
    const minutes = parseInt(m || '0', 10);
    const seconds = parseInt(s || '0', 10);
    const millis = parseInt(ms || '0', 10);
    return Math.round((hours * 3600 + minutes * 60 + seconds + millis / 1000) * 100) / 100;
  }

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    let timeIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (timeRegex.test(lines[i])) {
        timeIndex = i;
        break;
      }
    }
    if (timeIndex === -1) continue;

    const match = lines[timeIndex].match(
      /(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!match) continue;

    const start = timeToSec(match[1], match[2], match[3], match[4]);
    const end = timeToSec(match[5], match[6], match[7], match[8]);
    const textLines = lines
      .slice(timeIndex + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '') // إزالة وسوم HTML
      .replace(/\{[^}]+\}/g, '') // إزالة وسوم SSA/ASS
      .trim();

    if (textLines && end > start) {
      cues.push({ start, end, text: textLines });
    }
  }

  return cues;
}

/**
 * جلب ملف الترجمة الثنائي كـ ArrayBuffer لدعم فك الترميز التلقائي
 */
async function fetchSubtitleBuffer(url: string, timeoutMs: number = 4000): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTVStream/1.0',
      },
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * جلب بيانات JSON بأمان مع مهلة زمنية
 */
async function fetchJsonWithTimeout<T = any>(
  url: string,
  timeoutMs: number = 3500,
  headers?: Record<string, string>,
  method: string = 'GET',
  body?: string
): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) IPTVStream/1.0',
        ...headers,
      },
      body,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * معالج نقطة النهاية /api/vod/subtitles لجلب وفك ترميز الترجمة العربية
 * وتخزينها مؤقتاً لمدة 24 ساعة (max-age=86400)
 */
async function handleVodSubtitles(
  request: Request,
  url: URL,
  env: Env
): Promise<Response> {
  const cache = (caches as any).default;
  try {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
  } catch {}

  const tmdbId = url.searchParams.get('tmdbId') || '';
  const season = url.searchParams.get('season') || '';
  const episode = url.searchParams.get('episode') || '';

  if (!tmdbId) {
    return jsonResponse({ success: false, count: 0, cues: [] });
  }

  let finalCues: SubtitleCue[] = [];

  try {
    // 1. محاولة جلب الترجمة من Wyzie Subs
    const wyzieKey = env.WYZIE_API_KEY ? `&key=${env.WYZIE_API_KEY}` : '';
    const seasonQuery = season && episode ? `&season=${season}&episode=${episode}` : '';
    const wyzieUrl = `https://sub.wyzie.io/search?id=${tmdbId}&language=ar${seasonQuery}${wyzieKey}`;

    const data = await fetchJsonWithTimeout<any>(wyzieUrl, 3500);
    if (data) {
      const subList = Array.isArray(data) ? data : data.subtitles || [];
      const arSub =
        subList.find(
          (s: any) =>
            s.lang === 'ar' ||
            s.lang === 'ara' ||
            s.language === 'ar' ||
            s.language === 'Arabic'
        ) || subList[0];

      if (arSub && arSub.url) {
        const buf = await fetchSubtitleBuffer(arSub.url, 4000);
        if (buf) {
          const decoded = decodeSubtitleBuffer(buf);
          finalCues = parseSubtitlesToCues(decoded);
        }
      }
    }
  } catch (err) {
    console.warn('[handleVodSubtitles] Wyzie fetch error:', err);
  }

  // 2. إذا لم نجد في Wyzie، نحاول عبر OpenSubtitles إن توفر المفتاح
  if (finalCues.length === 0 && env.OPENSUBTITLES_API_KEY) {
    try {
      const osQuery = season && episode ? `&season_number=${season}&episode_number=${episode}` : '';
      const osUrl = `https://api.opensubtitles.com/api/v1/subtitles?tmdb_id=${tmdbId}&languages=ar${osQuery}`;
      const osData = await fetchJsonWithTimeout<any>(osUrl, 3500, {
        'Api-Key': env.OPENSUBTITLES_API_KEY,
      });
      if (osData && osData.data && osData.data.length > 0) {
        const fileId = osData.data[0].attributes?.files?.[0]?.file_id;
        if (fileId) {
          const dlData = await fetchJsonWithTimeout<any>(
            'https://api.opensubtitles.com/api/v1/download',
            3500,
            {
              'Api-Key': env.OPENSUBTITLES_API_KEY,
              'Content-Type': 'application/json',
            },
            'POST',
            JSON.stringify({ file_id: fileId })
          );
          if (dlData && dlData.link) {
            const buf = await fetchSubtitleBuffer(dlData.link, 4000);
            if (buf) {
              const decoded = decodeSubtitleBuffer(buf);
              finalCues = parseSubtitlesToCues(decoded);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[handleVodSubtitles] OpenSubtitles fetch error:', err);
    }
  }

  // استجابة JSON مع تخزين مؤقت لمدة 24 ساعة (86400 ثانية)
  const response = new Response(
    JSON.stringify({
      success: finalCues.length > 0,
      count: finalCues.length,
      cues: finalCues,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=86400',
      },
    }
  );

  try {
    await cache.put(request, response.clone());
  } catch {}

  return response;
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

    // نقاط نهاية كتالوج وبحث ومصادر وحلقات الأفلام والمسلسلات VOD
    if (url.pathname === '/api/vod/catalog') {
      return handleVodCatalog(url, env);
    }

    if (url.pathname === '/api/vod/search') {
      return handleVodSearch(url, env);
    }

    if (url.pathname === '/api/vod/sources') {
      return handleVodSources(request, url);
    }

    if (url.pathname === '/api/vod/episodes') {
      return handleVodEpisodes(url, env);
    }

    if (url.pathname === '/api/vod/subtitles') {
      return handleVodSubtitles(request, url, env);
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
