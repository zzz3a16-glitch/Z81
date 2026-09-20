/**
 * Helper utilities
 */

export function formatDate(date, locale = 'ar-SA') {
  try {
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return date;
  }
}

export function formatRuntime(minutes) {
  if (!minutes) return 'غير معروف';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} دقيقة`;
  if (mins === 0) return `${hours} ساعة`;
  return `${hours} ساعة ${mins} دقيقة`;
}

export function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export function getYear(dateString) {
  if (!dateString) return null;
  try {
    return new Date(dateString).getFullYear();
  } catch {
    return null;
  }
}

export function truncate(text, length = 100) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

export function debounce(func, delay = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

export function throttle(func, delay = 300) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func.apply(this, args);
    }
  };
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function isRTL() {
  return document.documentElement.dir === 'rtl';
}

export function getMediaTitle(media) {
  if (!media) return 'بدون عنوان';
  
  // Try Arabic first if available
  if (media.title_ar || media.name_ar) {
    return media.title_ar || media.name_ar;
  }
  
  return media.title || media.name || media.original_title || media.original_name || 'بدون عنوان';
}

export function getMediaYear(media) {
  const date = media.release_date || media.first_air_date;
  return getYear(date) || media.year || null;
}


export function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function copyToClipboard(text) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return Promise.resolve();
  }
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseFileName(filename) {
  // Smart file name parser
  const result = {
    title: filename,
    year: null,
    season: null,
    episode: null,
    quality: null,
    codec: null
  };

  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // Extract year
  const yearMatch = nameWithoutExt.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    result.year = parseInt(yearMatch[0]);
  }

  // Extract season/episode S01E02 or 1x02
  const seasonEpisodeMatch = nameWithoutExt.match(/[Ss](\d+)[Ee](\d+)|(\d+)x(\d+)/);
  if (seasonEpisodeMatch) {
    if (seasonEpisodeMatch[1] && seasonEpisodeMatch[2]) {
      result.season = parseInt(seasonEpisodeMatch[1]);
      result.episode = parseInt(seasonEpisodeMatch[2]);
    } else if (seasonEpisodeMatch[3] && seasonEpisodeMatch[4]) {
      result.season = parseInt(seasonEpisodeMatch[3]);
      result.episode = parseInt(seasonEpisodeMatch[4]);
    }
  }

  // Extract quality
  const qualityMatch = nameWithoutExt.match(/\b(480p|720p|1080p|2160p|4K|BluRay|WEB-DL|HDRip)\b/i);
  if (qualityMatch) {
    result.quality = qualityMatch[0];
  }

  // Clean title
  let cleanTitle = nameWithoutExt
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/[Ss]\d+[Ee]\d+|\d+x\d+/g, '')
    .replace(/\b(480p|720p|1080p|2160p|4K|BluRay|WEB-DL|HDRip|x264|x265|AAC|DTS)\b/gi, '')
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  result.title = cleanTitle || filename;

  return result;
}
