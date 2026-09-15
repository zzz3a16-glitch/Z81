/**
 * MediaScanner - Intelligent media scanner with fingerprinting
 */

import { fileNameParser } from './FileNameParser.js';
import { db } from '../storage/Database.js';

export class MediaScanner {
  constructor() {
    this.isScanning = false;
    this.progress = { scanned: 0, total: 0, currentFile: null };
    this.listeners = [];
    this.sources = [];
  }

  async loadSources() {
    try {
      const settings = await db.getSetting('librarySources', []);
      this.sources = settings || [];
      return this.sources;
    } catch {
      this.sources = [];
      return [];
    }
  }

  async addSource(path, options = {}) {
    const source = {
      id: `source-${Date.now()}`,
      name: options.name || path.split('/').pop() || 'مكتبة',
      path,
      enabled: true,
      lastScan: null,
      scanStatus: 'idle',
      fileCount: 0,
      missingCount: 0,
      schedule: options.schedule || 'manual',
      watchEnabled: options.watchEnabled || false,
      createdAt: Date.now()
    };

    this.sources.push(source);
    await this.saveSources();
    return source;
  }

  async removeSource(sourceId) {
    this.sources = this.sources.filter(s => s.id !== sourceId);
    await this.saveSources();
  }

  async saveSources() {
    try {
      await db.setSetting('librarySources', this.sources);
    } catch (e) {
      console.warn('Failed to save sources:', e);
    }
  }

  async scan(options = {}) {
    if (this.isScanning) {
      return { success: false, error: 'Already scanning' };
    }

    this.isScanning = true;
    this.progress = { scanned: 0, total: 0, currentFile: null, errors: [] };

    try {
      const { incremental = true, sourceId = null } = options;
      
      let sourcesToScan = this.sources;
      if (sourceId) {
        sourcesToScan = this.sources.filter(s => s.id === sourceId);
      }

      sourcesToScan = sourcesToScan.filter(s => s.enabled);

      // In Electron, this would scan real filesystem
      // In web version, we simulate with file input or drag & drop
      const results = {
        newFiles: 0,
        updatedFiles: 0,
        missingFiles: 0,
        errors: [],
        scanned: []
      };

      // For web demo, we check if we have FileSystem Access API
      if (window.showDirectoryPicker) {
        // Modern browser with file system access
        results.message = 'File System Access API available - would scan real folders in Electron';
      } else {
        results.message = 'Web version - use file picker to add media';
      }

      // Simulate scanning process
      this.notifyProgress({ status: 'scanning', ...this.progress });

      // In real Electron implementation:
      // 1. Enumerate files in source paths
      // 2. Calculate fingerprint (size + mtime + hash)
      // 3. Compare with database
      // 4. Parse filename
      // 5. Resolve media identity via TMDB
      // 6. Update database

      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work

      this.progress.scanned = 100;
      this.progress.total = 100;

      this.notifyProgress({ status: 'completed', ...this.progress, results });

      return { success: true, results };

    } catch (error) {
      console.error('Scan failed:', error);
      this.notifyProgress({ status: 'error', error: error.message });
      return { success: false, error: error.message };
    } finally {
      this.isScanning = false;
    }
  }

  async scanFile(file) {
    // Parse filename
    const parsed = fileNameParser.parse(file.name || file.path || '');
    
    // Calculate fingerprint
    const fingerprint = await this.calculateFingerprint(file);
    
    const mediaFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      path: file.path || file.name,
      name: file.name,
      size: file.size || 0,
      mtime: file.lastModified || Date.now(),
      fingerprint,
      parsed,
      addedAt: Date.now(),
      status: 'available'
    };

    // Check if already exists
    const existing = await this.findExistingFile(fingerprint, file.path);
    
    if (existing) {
      // Update if changed
      if (existing.fingerprint !== fingerprint || existing.mtime !== mediaFile.mtime) {
        await db.put('metadata', { key: `file-${existing.id}`, value: mediaFile });
        return { action: 'updated', file: mediaFile };
      }
      return { action: 'skipped', file: existing };
    }

    // New file
    await db.put('metadata', { key: `file-${mediaFile.id}`, value: mediaFile });
    return { action: 'added', file: mediaFile };
  }

  async calculateFingerprint(file) {
    // In real implementation, calculate hash of file
    // For demo, use size + name + mtime
    const data = `${file.name}-${file.size}-${file.lastModified || ''}`;
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `fp-${Math.abs(hash).toString(16)}-${file.size || 0}`;
  }

  async findExistingFile(fingerprint, path) {
    try {
      const allFiles = await db.getAll('metadata').catch(() => []);
      return allFiles.find(f => 
        f.value?.fingerprint === fingerprint || 
        f.value?.path === path
      )?.value || null;
    } catch {
      return null;
    }
  }

  async detectMissingFiles() {
    const allFiles = await db.getAll('metadata').catch(() => []);
    const missing = [];
    
    for (const item of allFiles) {
      const file = item.value;
      if (file && file.path) {
        // In Electron, check if file exists
        // In web, we can't check
        if (file.status === 'missing') {
          missing.push(file);
        }
      }
    }
    
    return missing;
  }

  async detectDuplicates() {
    const allFiles = await db.getAll('metadata').catch(() => []);
    const seen = new Map();
    const duplicates = [];
    
    for (const item of allFiles) {
      const file = item.value;
      if (!file || !file.fingerprint) continue;
      
      const key = `${file.parsed?.title?.toLowerCase()}-${file.parsed?.year}-${file.parsed?.season}-${file.parsed?.episode}`;
      
      if (seen.has(key)) {
        duplicates.push({
          original: seen.get(key),
          duplicate: file,
          probability: this.calculateDuplicateProbability(seen.get(key), file)
        });
      } else {
        seen.set(key, file);
      }
    }
    
    return duplicates;
  }

  calculateDuplicateProbability(file1, file2) {
    let score = 0;
    
    if (file1.parsed?.title?.toLowerCase() === file2.parsed?.title?.toLowerCase()) score += 40;
    if (file1.parsed?.year === file2.parsed?.year) score += 20;
    if (file1.parsed?.season === file2.parsed?.season && file1.parsed?.episode === file2.parsed?.episode) score += 30;
    if (file1.size === file2.size) score += 10;
    
    return Math.min(100, score);
  }

  onProgress(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyProgress(progress) {
    this.progress = { ...this.progress, ...progress };
    this.listeners.forEach(cb => {
      try {
        cb(this.progress);
      } catch {}
    });
    
    window.dispatchEvent(new CustomEvent('scannerprogress', { detail: this.progress }));
  }

  async getStats() {
    const allFiles = await db.getAll('metadata').catch(() => []);
    
    return {
      totalFiles: allFiles.length,
      totalSize: allFiles.reduce((sum, item) => sum + (item.value?.size || 0), 0),
      sources: this.sources.length,
      lastScan: this.sources.reduce((latest, s) => Math.max(latest, s.lastScan || 0), 0),
      missing: await this.detectMissingFiles().then(m => m.length),
      duplicates: await this.detectDuplicates().then(d => d.length)
    };
  }
}

export const mediaScanner = new MediaScanner();
export default mediaScanner;
