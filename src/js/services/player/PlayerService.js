/**
 * PlayerService — ABSTRACTION ONLY (spec 02/73).
 *
 * This phase ships NO playback engine: no mpv, no libVLC, no FFmpeg,
 * no <video> runtime, no decoder. These contracts define the boundary the
 * future Player Engine phase plugs into WITHOUT restructuring the app:
 *
 *   zPopcorn UI → PlayerService → [future engine] → video/audio/subtitles
 *
 * In desktop mode the real capability descriptor comes from main
 * (window.zpopcorn.player.capability()); in browser mode we surface the same
 * "not implemented" state so behavior is identical everywhere.
 */
import { isDesktop, api } from '../../bridge.js';

export const PLAYER_NOT_IMPLEMENTED = 'PLAYER_NOT_IMPLEMENTED';

const NOT_IMPLEMENTED = () => {
  const err = new Error('مشغّل الوسائط غير مُفعّل في هذه المرحلة');
  err.code = PLAYER_NOT_IMPLEMENTED;
  return Promise.reject(err);
};

/** Future engine implements these; here they are contracts only. */
export class PlayerEngineContract {
  async load(/* session */) { return NOT_IMPLEMENTED(); }
  async play() { return NOT_IMPLEMENTED(); }
  async pause() { return NOT_IMPLEMENTED(); }
  async seek(/* seconds */) { return NOT_IMPLEMENTED(); }
  async setVolume(/* 0..1 */) { return NOT_IMPLEMENTED(); }
  async selectSubtitle(/* trackId */) { return NOT_IMPLEMENTED(); }
  async selectAudioTrack(/* trackId */) { return NOT_IMPLEMENTED(); }
  async setFullscreen(/* on */) { return NOT_IMPLEMENTED(); }
  destroy() { /* no-op */ }
}

/** A playback session describes WHAT to play; never HOW. */
export class PlaybackSession {
  constructor({ mediaRef, mediaFiles = [], resumePosition = 0, subtitleHints = [] }) {
    this.mediaRef = mediaRef;             // { store, key } — stable work identity
    this.mediaFiles = mediaFiles;         // candidate editions/files
    this.resumePosition = resumePosition; // seconds (from watch progress)
    this.subtitleHints = subtitleHints;
    this.createdAt = Date.now();
  }
}

export class PlayerService {
  constructor({ onUnavailable = null } = {}) {
    this.onUnavailable = onUnavailable;
    this.capabilityCache = null;
    this.activeSession = null;
  }

  /** {implemented:false, code:'PLAYER_NOT_IMPLEMENTED', message} — honest gate. */
  async capability() {
    if (this.capabilityCache) return this.capabilityCache;
    if (isDesktop) {
      try {
        this.capabilityCache = await api.player.capability();
        return this.capabilityCache;
      } catch { /* fall through */ }
    }
    this.capabilityCache = {
      implemented: false,
      code: PLAYER_NOT_IMPLEMENTED,
      phase: 'future',
      message: 'مشغّل الوسائط سيُضاف في مرحلة منفصلة قادمة',
    };
    return this.capabilityCache;
  }

  isReady() { return Promise.resolve(false); }

  /** Opening media: records the intent (watch history), shows availability, plays nothing. */
  async open(media) {
    const cap = await this.capability();
    if (!cap.implemented) {
      this.onUnavailable?.({ media, capability: cap });
      const err = new Error(cap.message || 'مشغّل الوسائط غير مُفعّل');
      err.code = PLAYER_NOT_IMPLEMENTED;
      err.capability = cap;
      throw err;
    }
    // Future phase: engine selection + session handoff happen behind this line only.
    this.activeSession = new PlaybackSession({
      mediaRef: { store: (media?.media_type === 'tv' ? 'tvshows' : 'movies'), key: String(media?.id ?? '') },
    });
    return this.activeSession;
  }

  close() { this.activeSession = null; return { closed: true }; }
  async play() { return NOT_IMPLEMENTED(); }
  async pause() { return NOT_IMPLEMENTED(); }
  async stop() { return NOT_IMPLEMENTED(); }
  async seek(v) { return NOT_IMPLEMENTED(); void v; }
  async volume(v) { return NOT_IMPLEMENTED(); void v; }
  async subtitles() { return NOT_IMPLEMENTED(); }
  async audioTracks() { return NOT_IMPLEMENTED(); }
  async fullscreen() { return NOT_IMPLEMENTED(); }

  getState() {
    return { status: 'not-implemented', session: this.activeSession, capability: this.capabilityCache };
  }
}

export const playerService = new PlayerService();
export default playerService;
