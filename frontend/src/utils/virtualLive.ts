/**
 * Virtual Live TV Timing Utility (بث المسلسلات 24/7)
 * Calculates the exact episode and playback position (in seconds) for continuous 24/7 simulated live streaming.
 */

export interface VirtualLiveEpisode {
  title: string;
  youtubeId: string;
  duration: number; // in seconds
}

export interface VirtualLivePosition {
  currentEpisode: VirtualLiveEpisode | null;
  episodeIndex: number;
  startAt: number; // in seconds
  totalDuration: number; // in seconds
}

/**
 * Computes the virtual live episode and seek position based on current epoch time and channel creation time.
 * When createdAt is provided, the channel starts at Episode 1, Second 0 at creation time,
 * and progresses synchronously and cyclically across all clients worldwide.
 */
export function getVirtualLivePosition(
  episodes: VirtualLiveEpisode[],
  createdAt?: number | string | null
): VirtualLivePosition {
  if (!episodes || episodes.length === 0) {
    return {
      currentEpisode: null,
      episodeIndex: 0,
      startAt: 0,
      totalDuration: 0,
    };
  }

  // Calculate total cycle duration (fallback to 20 minutes if duration is missing or 0)
  const totalDuration = episodes.reduce((acc, ep) => {
    const dur = ep.duration && ep.duration > 0 ? ep.duration : 1200;
    return acc + dur;
  }, 0);

  if (totalDuration <= 0) {
    return {
      currentEpisode: episodes[0],
      episodeIndex: 0,
      startAt: 0,
      totalDuration: 0,
    };
  }

  let elapsedSeconds: number;
  if (createdAt !== undefined && createdAt !== null && createdAt !== '') {
    const startMs = typeof createdAt === 'string' ? new Date(createdAt).getTime() : Number(createdAt);
    if (!isNaN(startMs) && startMs > 0) {
      elapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    } else {
      elapsedSeconds = Math.floor(Date.now() / 1000);
    }
  } else {
    elapsedSeconds = Math.floor(Date.now() / 1000);
  }

  const positionInCycle = elapsedSeconds % totalDuration;

  let accumulated = 0;
  for (let i = 0; i < episodes.length; i++) {
    const epDuration = episodes[i].duration && episodes[i].duration > 0 ? episodes[i].duration : 1200;
    if (positionInCycle < accumulated + epDuration) {
      const startAt = positionInCycle - accumulated;
      return {
        currentEpisode: episodes[i],
        episodeIndex: i,
        startAt: Math.max(0, Math.floor(startAt)),
        totalDuration,
      };
    }
    accumulated += epDuration;
  }

  return {
    currentEpisode: episodes[0],
    episodeIndex: 0,
    startAt: 0,
    totalDuration,
  };
}

/**
 * Helper to extract YouTube video ID from various YouTube URL formats.
 */
export function extractYouTubeId(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  // If it's already an 11-char ID without slashes/question marks
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = trimmed.match(regExp);
    if (match && match[1]) {
      return match[1];
    }
  } catch {
    // fallback
  }

  return trimmed;
}
