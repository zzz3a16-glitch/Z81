/**
 * PlayerService - Professional Media Player with mpv abstraction
 * Web version uses HTML5 video with mpv-like controls
 */

import { db } from '../storage/Database.js';
import { behaviorEngine, BEHAVIOR_EVENTS } from '../behavior/UserBehaviorEngine.js';

export class PlayerState {
  constructor() {
    this.media = null;
    this.position = 0;
    this.duration = 0;
    this.paused = true;
    this.volume = 1;
    this.muted = false;
    this.playbackRate = 1;
    this.quality = 'auto';
    this.audioTrack = 0;
    this.subtitleTrack = -1;
    this.buffered = 0;
    this.ended = false;
    this.loading = false;
    this.error = null;
  }
}

export class PlayerService {
  constructor() {
    this.state = new PlayerState();
    this.videoElement = null;
    this.listeners = [];
    this.progressInterval = null;
    this.saveProgressInterval = null;
    this.isElectron = !!(window.electronAPI);
  }

  init(videoElement) {
    this.videoElement = videoElement;
    
    if (videoElement) {
      // Bind HTML5 video events
      videoElement.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
      videoElement.addEventListener('timeupdate', () => this.onTimeUpdate());
      videoElement.addEventListener('play', () => this.onPlay());
      videoElement.addEventListener('pause', () => this.onPause());
      videoElement.addEventListener('ended', () => this.onEnded());
      videoElement.addEventListener('volumechange', () => this.onVolumeChange());
      videoElement.addEventListener('error', (e) => this.onError(e));
      videoElement.addEventListener('waiting', () => this.onWaiting());
      videoElement.addEventListener('canplay', () => this.onCanPlay());
      videoElement.addEventListener('progress', () => this.onProgress());
    }

    // Enhanced mpv listeners
    if (this.isElectron) {
      this.setupMpvListeners();
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // Start progress tracking
    this.startProgressTracking();
  }

  setupMpvListeners() {
    if (this.mpvListenersSetup || !window.electronAPI) return;
    
    window.electronAPI.onMpvEvent((event) => {
      if (!event) return;

      // Handle mpv property changes
      if (event.event === 'property-change') {
        switch (event.name) {
          case 'time-pos':
            if (typeof event.data === 'number') {
              this.state.position = event.data;
              this.notifyListeners();
            }
            break;
          case 'duration':
            if (typeof event.data === 'number') {
              this.state.duration = event.data;
              this.notifyListeners();
            }
            break;
          case 'pause':
            this.state.paused = !!event.data;
            this.notifyListeners();
            break;
          case 'volume':
            if (typeof event.data === 'number') {
              this.state.volume = event.data / 100;
              this.notifyListeners();
            }
            break;
        }
      }

      if (event.event === 'end-file') {
        this.onEnded();
      }

      if (event.event === 'file-loaded') {
        this.state.loading = false;
        this.state.error = null;
        this.notifyListeners();
      }
    });

    this.mpvListenersSetup = true;
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async loadMedia(media, options = {}) {
    this.state.media = media;
    this.state.loading = true;
    this.state.error = null;
    this.notifyListeners();

    try {
      // Get saved progress with enhanced tracking
      let savedProgress = null;
      try {
        savedProgress = await db.get('watchProgress', media.id?.toString() || media.mediaId);
      } catch {}
      
      let startPosition = 0;
      if (savedProgress && savedProgress.progress > 3 && savedProgress.progress < 92) {
        startPosition = savedProgress.position;
        // Ask user if they want to resume
        if (startPosition > 30 && !options.forceStart) {
          const shouldResume = options.autoResume !== false ? true : 
            confirm(`متابعة من ${this.formatTime(startPosition)}؟`);
          if (!shouldResume) startPosition = 0;
        }
      }

      if (options.startPosition !== undefined) {
        startPosition = options.startPosition;
      }

      // Enhanced mpv integration
      if (this.isElectron && media.path) {
        // Check file exists first
        try {
          const fileCheck = await window.electronAPI.checkFileExists(media.path);
          if (!fileCheck.exists) {
            throw new Error(`الملف غير موجود: ${media.path}`);
          }
        } catch (e) {
          if (e.message.includes('غير موجود')) throw e;
          // Non-critical check failure, continue
        }

        // Electron mpv playback with enhanced IPC
        const result = await window.electronAPI.playMedia({
          path: media.path,
          position: startPosition,
          mediaId: media.id,
          title: media.title || media.name
        });

        if (!result.success) {
          throw new Error(result.error || 'فشل تشغيل الملف');
        }

        // Setup mpv event listeners
        if (!this.mpvListenersSetup) {
          this.setupMpvListeners();
        }
      } else if (this.videoElement) {
        if (media.videoUrl) {
          this.videoElement.src = media.videoUrl;
          this.videoElement.currentTime = startPosition;
          await this.videoElement.play().catch(() => {});
        } else {
          // No video source - show info only with enhanced UI
          this.state.loading = false;
          this.notifyListeners();
          return { 
            success: true, 
            mode: 'info_only',
            message: 'الملف المحلي غير متاح في المتصفح - يتطلب تطبيق Electron'
          };
        }
      }

      behaviorEngine.track(BEHAVIOR_EVENTS.PLAY_STARTED, {
        mediaId: media.id,
        mediaType: media.media_type || media.type || 'movie',
        title: media.title || media.name
      });

      this.state.loading = false;
      this.notifyListeners();

      return { success: true, startPosition };

    } catch (error) {
      this.state.error = error.message;
      this.state.loading = false;
      this.notifyListeners();
      throw error;
    }
  }

  play() {
    if (this.videoElement) {
      this.videoElement.play().catch(e => {
        console.warn('Play failed:', e);
      });
    }
    
    if (this.isElectron) {
      window.electronAPI?.playerCommand('play');
    }

    this.state.paused = false;
    this.notifyListeners();
    
    behaviorEngine.track(BEHAVIOR_EVENTS.PLAY_RESUMED, {
      mediaId: this.state.media?.id,
      position: this.state.position
    });
  }

  pause() {
    if (this.videoElement) {
      this.videoElement.pause();
    }
    
    if (this.isElectron) {
      window.electronAPI?.playerCommand('pause');
    }

    this.state.paused = true;
    this.notifyListeners();
    
    behaviorEngine.track(BEHAVIOR_EVENTS.PLAY_PAUSED, {
      mediaId: this.state.media?.id,
      position: this.state.position
    });
  }

  togglePlayPause() {
    if (this.state.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  seek(position) {
    const from = this.state.position;
    
    if (this.videoElement) {
      this.videoElement.currentTime = position;
    }
    
    if (this.isElectron) {
      window.electronAPI?.playerCommand('seek', position);
    }

    this.state.position = position;
    this.notifyListeners();
    
    behaviorEngine.track(BEHAVIOR_EVENTS.SEEK, {
      mediaId: this.state.media?.id,
      from,
      to: position
    });
  }

  seekRelative(seconds) {
    this.seek(Math.max(0, Math.min(this.state.duration, this.state.position + seconds)));
  }

  setVolume(volume) {
    const vol = Math.max(0, Math.min(1, volume));
    
    if (this.videoElement) {
      this.videoElement.volume = vol;
    }
    
    if (this.isElectron) {
      window.electronAPI?.playerCommand('setVolume', vol * 100);
    }

    this.state.volume = vol;
    this.state.muted = vol === 0;
    this.notifyListeners();
  }

  toggleMute() {
    if (this.videoElement) {
      this.videoElement.muted = !this.videoElement.muted;
    }
    
    this.state.muted = !this.state.muted;
    this.notifyListeners();
  }

  setPlaybackRate(rate) {
    if (this.videoElement) {
      this.videoElement.playbackRate = rate;
    }
    
    this.state.playbackRate = rate;
    this.notifyListeners();
  }

  async saveProgress() {
    if (!this.state.media || this.state.duration === 0) return;

    const progress = (this.state.position / this.state.duration) * 100;
    
    // Don't save if too early or too late
    if (progress < 1) return;

    const progressData = {
      mediaId: this.state.media.id?.toString() || this.state.media.mediaId,
      mediaType: this.state.media.media_type || this.state.media.type || 'movie',
      position: this.state.position,
      duration: this.state.duration,
      progress: Math.round(progress),
      updatedAt: Date.now(),
      title: this.state.media.title || this.state.media.name,
      poster_path: this.state.media.poster_path
    };

    try {
      await db.put('watchProgress', progressData);
      
      // If completed (>90%)
      if (progress > 90) {
        const historyItem = {
          id: `${progressData.mediaId}-${Date.now()}`,
          mediaId: progressData.mediaId,
          mediaType: progressData.mediaType,
          title: progressData.title,
          watchedAt: Date.now(),
          duration: this.state.duration,
          completed: true
        };
        
        await db.put('watchHistory', historyItem);
        
        behaviorEngine.track(BEHAVIOR_EVENTS.PLAY_COMPLETED, {
          mediaId: progressData.mediaId,
          mediaType: progressData.mediaType,
          duration: this.state.duration
        });
      }
    } catch (e) {
      console.warn('Failed to save progress:', e);
    }
  }

  startProgressTracking() {
    // Save progress every 5 seconds
    this.saveProgressInterval = setInterval(() => {
      if (!this.state.paused && this.state.media) {
        this.saveProgress();
      }
    }, 5000);
  }

  stopProgressTracking() {
    if (this.saveProgressInterval) {
      clearInterval(this.saveProgressInterval);
      this.saveProgressInterval = null;
    }
  }

  // Event handlers
  onLoadedMetadata() {
    if (this.videoElement) {
      this.state.duration = this.videoElement.duration;
      this.state.loading = false;
      this.notifyListeners();
    }
  }

  onTimeUpdate() {
    if (this.videoElement) {
      this.state.position = this.videoElement.currentTime;
      this.notifyListeners();
    }
  }

  onPlay() {
    this.state.paused = false;
    this.state.ended = false;
    this.notifyListeners();
  }

  onPause() {
    this.state.paused = true;
    this.notifyListeners();
    this.saveProgress();
  }

  onEnded() {
    this.state.ended = true;
    this.state.paused = true;
    this.notifyListeners();
    this.saveProgress();
    
    behaviorEngine.track(BEHAVIOR_EVENTS.PLAY_COMPLETED, {
      mediaId: this.state.media?.id,
      mediaType: this.state.media?.media_type || 'movie',
      duration: this.state.duration
    });

    // Auto next episode if enabled
    const autoNext = localStorage.getItem('zpopcorn-auto-next') === 'true';
    if (autoNext && this.state.media?.nextEpisode) {
      window.dispatchEvent(new CustomEvent('playnext', { 
        detail: this.state.media.nextEpisode 
      }));
    }
  }

  onVolumeChange() {
    if (this.videoElement) {
      this.state.volume = this.videoElement.volume;
      this.state.muted = this.videoElement.muted;
      this.notifyListeners();
    }
  }

  onError(e) {
    this.state.error = e.message || 'Playback error';
    this.state.loading = false;
    this.notifyListeners();
    console.error('Player error:', e);
  }

  onWaiting() {
    this.state.loading = true;
    this.notifyListeners();
  }

  onCanPlay() {
    this.state.loading = false;
    this.notifyListeners();
  }

  onProgress() {
    if (this.videoElement && this.videoElement.buffered.length > 0) {
      const bufferedEnd = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
      this.state.buffered = (bufferedEnd / this.state.duration) * 100;
      this.notifyListeners();
    }
  }

  handleKeyboard(e) {
    // Only if player is active
    if (!this.state.media) return;
    
    // Ignore if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.togglePlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        this.seekRelative(-10);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.seekRelative(10);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.setVolume(this.state.volume + 0.1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.setVolume(this.state.volume - 0.1);
        break;
      case 'KeyM':
        this.toggleMute();
        break;
      case 'KeyF':
        if (this.videoElement) {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            this.videoElement.requestFullscreen().catch(() => {});
          }
        }
        break;
    }
  }

  onStateChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try {
        cb({ ...this.state });
      } catch {}
    });
    
    window.dispatchEvent(new CustomEvent('playerstatechange', { 
      detail: { ...this.state } 
    }));
  }

  getState() {
    return { ...this.state };
  }

  destroy() {
    this.stopProgressTracking();
    this.listeners = [];
    
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
    }
    
    this.state = new PlayerState();
  }
}

export const playerService = new PlayerService();
export default playerService;
