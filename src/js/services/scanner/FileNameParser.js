/**
 * FileNameParser - Smart file name parser
 */

export class FileNameParser {
  parse(filename) {
    const result = {
      title: filename,
      year: null,
      season: null,
      episode: null,
      quality: null,
      codec: null,
      audio: null,
      language: null,
      releaseGroup: null,
      extension: null,
      isEpisode: false,
      isMovie: true
    };

    // Extract extension
    const extMatch = filename.match(/\.([^.]+)$/);
    if (extMatch) {
      result.extension = extMatch[1].toLowerCase();
      result.container = this.getContainer(result.extension);
    }

    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

    // Quality patterns
    const qualityPatterns = [
      { regex: /\b(2160p|4K|UHD)\b/i, value: '4K' },
      { regex: /\b(1080p|FHD)\b/i, value: '1080p' },
      { regex: /\b(720p|HD)\b/i, value: '720p' },
      { regex: /\b(480p|SD)\b/i, value: '480p' },
      { regex: /\b(BluRay|Blu-Ray|BRRip|BDRip)\b/i, value: 'BluRay' },
      { regex: /\b(WEB-DL|WEBRip|WEB)\b/i, value: 'WEB-DL' },
      { regex: /\b(DVDRip|DVD)\b/i, value: 'DVD' },
      { regex: /\b(HDRip)\b/i, value: 'HDRip' }
    ];

    for (const pattern of qualityPatterns) {
      if (pattern.regex.test(nameWithoutExt)) {
        result.quality = pattern.value;
        break;
      }
    }

    // Codec patterns
    const codecPatterns = [
      { regex: /\b(x264|H\.?264|AVC)\b/i, value: 'H.264' },
      { regex: /\b(x265|H\.?265|HEVC)\b/i, value: 'H.265' },
      { regex: /\b(AV1)\b/i, value: 'AV1' },
      { regex: /\b(VP9)\b/i, value: 'VP9' }
    ];

    for (const pattern of codecPatterns) {
      if (pattern.regex.test(nameWithoutExt)) {
        result.codec = pattern.value;
        break;
      }
    }

    // Audio patterns
    const audioMatch = nameWithoutExt.match(/\b(AAC|AC3|DTS|TrueHD|Atmos|5\.1|7\.1)\b/i);
    if (audioMatch) {
      result.audio = audioMatch[0];
    }

    // Year
    const yearMatch = nameWithoutExt.match(/\b(19\d{2}|20[0-2]\d|2030)\b/);
    if (yearMatch) {
      result.year = parseInt(yearMatch[0]);
    }

    // Season/Episode - S01E02, S1E2, 1x02, Season 1 Episode 2
    const patterns = [
      /[Ss](\d{1,2})[Ee](\d{1,3})/,  // S01E02
      /(\d{1,2})x(\d{1,3})/,          // 1x02
      /[Ss]eason\s*(\d+)\s*[Ee]pisode\s*(\d+)/i, // Season 1 Episode 2
      /[Ee]pisode\s*(\d+)/i,          // Episode 2
      /\bS(\d{1,2})\b/                // S01 (season only)
    ];

    for (const pattern of patterns) {
      const match = nameWithoutExt.match(pattern);
      if (match) {
        if (match[2]) {
          result.season = parseInt(match[1]);
          result.episode = parseInt(match[2]);
          result.isEpisode = true;
          result.isMovie = false;
        } else if (pattern.toString().includes('Episode') && match[1]) {
          result.episode = parseInt(match[1]);
          result.isEpisode = true;
          result.isMovie = false;
        } else if (match[1] && pattern.toString().includes('S\\d')) {
          result.season = parseInt(match[1]);
        }
        break;
      }
    }

    // Language
    const langPatterns = [
      { regex: /\b(Arabic|AR|عربي)\b/i, value: 'Arabic' },
      { regex: /\b(English|EN|Eng)\b/i, value: 'English' },
      { regex: /\b(French|FR)\b/i, value: 'French' },
      { regex: /\b(Japanese|JA|JP)\b/i, value: 'Japanese' }
    ];

    for (const pattern of langPatterns) {
      if (pattern.regex.test(nameWithoutExt)) {
        result.language = pattern.value;
        break;
      }
    }

    // Clean title
    let cleanTitle = nameWithoutExt
      .replace(/\b(19\d{2}|20[0-2]\d)\b/g, '')
      .replace(/[Ss]\d{1,2}[Ee]\d{1,3}/g, '')
      .replace(/\d{1,2}x\d{1,3}/g, '')
      .replace(/\b(480p|720p|1080p|2160p|4K|UHD|BluRay|BRRip|BDRip|WEB-DL|WEBRip|HDRip|DVDRip)\b/gi, '')
      .replace(/\b(x264|x265|H\.?264|H\.?265|AVC|HEVC|AAC|AC3|DTS|TrueHD|Atmos|5\.1|7\.1)\b/gi, '')
      .replace(/\b(BluRay|WEB|HDRip)\b/gi, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/[._]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove release group (last word if all caps or with dash)
    const words = cleanTitle.split(' ');
    if (words.length > 1) {
      const lastWord = words[words.length - 1];
      if (/^[A-Z0-9-]{2,}$/.test(lastWord) && lastWord.length <= 10) {
        result.releaseGroup = lastWord;
        words.pop();
        cleanTitle = words.join(' ');
      }
    }

    result.title = cleanTitle || filename;
    result.originalFilename = filename;

    return result;
  }

  getContainer(extension) {
    const containers = {
      mp4: 'MPEG-4',
      mkv: 'Matroska',
      avi: 'AVI',
      mov: 'QuickTime',
      wmv: 'WMV',
      flv: 'Flash Video',
      webm: 'WebM',
      m4v: 'MPEG-4 Video',
      mp3: 'MP3',
      flac: 'FLAC',
      m4a: 'M4A',
      aac: 'AAC'
    };
    return containers[extension] || extension.toUpperCase();
  }

  // Batch parse
  parseBatch(filenames) {
    return filenames.map(f => this.parse(f));
  }

  // Group episodes by series
  groupEpisodes(parsedFiles) {
    const groups = {};
    
    parsedFiles.forEach(file => {
      if (file.isEpisode && file.title) {
        const seriesKey = file.title.toLowerCase();
        if (!groups[seriesKey]) {
          groups[seriesKey] = {
            title: file.title,
            episodes: []
          };
        }
        groups[seriesKey].episodes.push(file);
      }
    });

    // Sort episodes
    Object.values(groups).forEach(group => {
      group.episodes.sort((a, b) => {
        if (a.season !== b.season) return (a.season || 0) - (b.season || 0);
        return (a.episode || 0) - (b.episode || 0);
      });
    });

    return groups;
  }
}

export const fileNameParser = new FileNameParser();
export default fileNameParser;
