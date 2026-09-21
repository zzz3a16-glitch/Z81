/**
 * ThemeManager - Production-Grade Theme Engine
 * Transforms entire application appearance, not just colors
 */

export const THEMES = {
  'midnight-neon': {
    id: 'midnight-neon',
    name: 'منتصف الليل النيون',
    nameEn: 'Midnight Neon',
    description: 'داكن سينمائي مستقبلي مع تأثيرات نيون',
    category: 'dark',
    isDark: true,
    colors: {
      background: '#0a0a0f',
      surface: 'rgba(18, 18, 28, 0.85)',
      card: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.1)',
      accent: '#8b5cf6',
      accentSecondary: '#06b6d4',
      textPrimary: '#ffffff',
      textSecondary: 'rgba(255, 255, 255, 0.7)',
      textMuted: 'rgba(255, 255, 255, 0.5)'
    },
    preview: {
      bg: '#0a0a0f',
      accent: '#8b5cf6',
      accent2: '#06b6d4'
    }
  },
  'neon-lime': {
    id: 'neon-lime',
    name: 'لايم النيون',
    nameEn: 'Neon Lime',
    description: 'فحمي داكن مع لايم نيوني ولمسات سماوي/بنفسجي/برتقالي — جمالية بنّتو SaaS والقيمنق',
    category: 'dark',
    isDark: true,
    colors: {
      background: '#121212',
      surface: 'rgba(23, 23, 23, 0.9)',
      card: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.09)',
      accent: '#c9f24d',
      accentSecondary: '#3fdcf2',
      textPrimary: '#fafafa',
      textSecondary: 'rgba(250, 250, 250, 0.72)',
      textMuted: 'rgba(250, 250, 250, 0.5)'
    },
    preview: {
      bg: '#121212',
      accent: '#c9f24d',
      accent2: '#3fdcf2'
    }
  },
  'cinema-noir': {
    id: 'cinema-noir',
    name: 'سينما نوار',
    nameEn: 'Cinema Noir',
    description: 'كلاسيكي أنيق وراقي',
    category: 'dark',
    isDark: true,
    colors: {
      background: '#0f0f14',
      surface: '#1a1a24',
      card: '#1e1e2e',
      border: '#3a3a4a',
      accent: '#c41e3a',
      accentSecondary: '#8b5a2b',
      textPrimary: '#ffffff',
      textSecondary: '#b0b0c0',
      textMuted: '#7a7a8a'
    },
    preview: {
      bg: '#0f0f14',
      accent: '#c41e3a',
      accent2: '#8b5a2b'
    }
  },
  'aurora': {
    id: 'aurora',
    name: 'الشفق القطبي',
    nameEn: 'Aurora',
    description: 'أثيري حالم وحديث',
    category: 'dark',
    isDark: true,
    colors: {
      background: '#0f172a',
      surface: 'rgba(15, 23, 42, 0.8)',
      card: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 255, 255, 0.1)',
      accent: '#667eea',
      accentSecondary: '#764ba2',
      textPrimary: '#ffffff',
      textSecondary: 'rgba(255, 255, 255, 0.75)',
      textMuted: 'rgba(255, 255, 255, 0.5)'
    },
    preview: {
      bg: '#0f172a',
      accent: '#667eea',
      accent2: '#764ba2'
    }
  },
  'amoled': {
    id: 'amoled',
    name: 'أموليد',
    nameEn: 'AMOLED',
    description: 'أسود نقي محسن لشاشات OLED',
    category: 'dark',
    isDark: true,
    colors: {
      background: '#000000',
      surface: '#000000',
      card: '#000000',
      border: 'rgba(255, 255, 255, 0.06)',
      accent: '#a855f7',
      accentSecondary: '#ffffff',
      textPrimary: '#ffffff',
      textSecondary: 'rgba(255, 255, 255, 0.6)',
      textMuted: 'rgba(255, 255, 255, 0.35)'
    },
    preview: {
      bg: '#000000',
      accent: '#a855f7',
      accent2: '#ffffff'
    }
  },
  'crimson-cinema': {
    id: 'crimson-cinema',
    name: 'السينما القرمزية',
    nameEn: 'Crimson Cinema',
    description: 'فاخر ودافئ ودرامي',
    category: 'dark',
    isDark: true,
    colors: {
      background: '#0a0000',
      surface: '#1a0a0a',
      card: '#241212',
      border: '#4a2222',
      accent: '#dc143c',
      accentSecondary: '#8b0000',
      textPrimary: '#fff5f5',
      textSecondary: 'rgba(255, 245, 245, 0.7)',
      textMuted: 'rgba(255, 245, 245, 0.5)'
    },
    preview: {
      bg: '#1a0a0a',
      accent: '#dc143c',
      accent2: '#8b0000'
    }
  },
  'golden-cinema': {
    id: 'golden-cinema',
    name: 'السينما الذهبية',
    nameEn: 'Golden Cinema',
    description: 'فاخر ومترف وكلاسيكي',
    category: 'dark',
    isDark: true,
    colors: {
      background: '#000000',
      surface: '#1a1a1a',
      card: '#1e1e1e',
      border: '#3a3a2a',
      accent: '#d4af37',
      accentSecondary: '#f5f5dc',
      textPrimary: '#f5f5dc',
      textSecondary: 'rgba(245, 245, 220, 0.7)',
      textMuted: 'rgba(245, 245, 220, 0.5)'
    },
    preview: {
      bg: '#000000',
      accent: '#d4af37',
      accent2: '#f5f5dc'
    }
  },
  'arctic': {
    id: 'arctic',
    name: 'القطب الشمالي',
    nameEn: 'Arctic',
    description: 'فاتح نظيف وحديث',
    category: 'light',
    isDark: false,
    colors: {
      background: '#ffffff',
      surface: '#f8fafc',
      card: '#ffffff',
      border: '#e2e8f0',
      accent: '#0ea5e9',
      accentSecondary: '#06b6d4',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#94a3b8'
    },
    preview: {
      bg: '#ffffff',
      accent: '#0ea5e9',
      accent2: '#06b6d4'
    }
  },
  'minimal-light': {
    id: 'minimal-light',
    name: 'البساطة المضيئة',
    nameEn: 'Minimal Light',
    description: 'بسيط ونظيف ومهني',
    category: 'light',
    isDark: false,
    colors: {
      background: '#ffffff',
      surface: '#fafafa',
      card: '#ffffff',
      border: '#e5e7eb',
      accent: '#111827',
      accentSecondary: '#4b5563',
      textPrimary: '#111827',
      textSecondary: '#4b5563',
      textMuted: '#9ca3af'
    },
    preview: {
      bg: '#ffffff',
      accent: '#111827',
      accent2: '#4b5563'
    }
  }
};

export class ThemeManager {
  constructor() {
    this.storageKey = 'zpopcorn-theme';
    this.customThemesKey = 'zpopcorn-custom-themes';
    this.currentTheme = null;
    this.customThemes = {};
    this.listeners = [];
    this.loadCustomThemes();
    this.loadTheme();
  }

  loadCustomThemes() {
    try {
      const stored = localStorage.getItem(this.customThemesKey);
      if (stored) {
        this.customThemes = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load custom themes:', e);
    }
  }

  saveCustomThemes() {
    try {
      localStorage.setItem(this.customThemesKey, JSON.stringify(this.customThemes));
    } catch (e) {
      console.warn('Failed to save custom themes:', e);
    }
  }

  getAllThemes() {
    return { ...THEMES, ...this.customThemes };
  }

  getThemeList() {
    return Object.values(this.getAllThemes());
  }

  getThemeConfig(themeName) {
    return this.getAllThemes()[themeName] || null;
  }

  loadTheme() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const themeName = JSON.parse(saved);
        if (this.getThemeConfig(themeName)) {
          this.currentTheme = themeName;
          this.applyTheme(themeName, false);
          return themeName;
        }
      }
    } catch (e) {
      console.warn('Failed to load theme:', e);
    }
    
    // Default theme
    this.currentTheme = 'midnight-neon';
    this.applyTheme(this.currentTheme, false);
    return this.currentTheme;
  }

  applyTheme(themeName, save = true) {
    const theme = this.getThemeConfig(themeName);
    if (!theme) {
      console.warn(`Theme ${themeName} not found`);
      return false;
    }

    // Apply to document
    document.documentElement.setAttribute('data-theme', themeName);
    document.documentElement.classList.toggle('theme-dark', theme.isDark);
    document.documentElement.classList.toggle('theme-light', !theme.isDark);
    
    // Apply CSS variables for quick access
    if (theme.colors) {
      Object.entries(theme.colors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(`--theme-${key}`, value);
      });
    }

    this.currentTheme = themeName;

    if (save) {
      this.saveTheme(themeName);
    }

    // Notify listeners
    this.listeners.forEach(callback => {
      try {
        callback(themeName, theme);
      } catch (e) {
        console.warn('Theme listener error:', e);
      }
    });

    // Dispatch event
    window.dispatchEvent(new CustomEvent('themechange', { 
      detail: { theme: themeName, config: theme } 
    }));

    return true;
  }

  getTheme() {
    return this.currentTheme;
  }

  setTheme(themeName) {
    return this.applyTheme(themeName, true);
  }

  previewTheme(themeName) {
    return this.applyTheme(themeName, false);
  }

  resetTheme() {
    return this.setTheme('midnight-neon');
  }

  saveTheme(themeName) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(themeName));
    } catch (e) {
      console.warn('Failed to save theme:', e);
    }
  }

  // Custom theme builder
  createCustomTheme(name, config) {
    const id = `custom-${Date.now()}`;
    const customTheme = {
      id,
      name,
      nameEn: name,
      description: 'مخصص',
      category: config.isDark ? 'dark' : 'light',
      isDark: config.isDark,
      colors: config.colors,
      custom: true,
      createdAt: Date.now(),
      preview: {
        bg: config.colors.background,
        accent: config.colors.accent,
        accent2: config.colors.accentSecondary
      }
    };

    this.customThemes[id] = customTheme;
    this.saveCustomThemes();
    return customTheme;
  }

  updateCustomTheme(id, updates) {
    if (!this.customThemes[id]) return null;
    
    this.customThemes[id] = { ...this.customThemes[id], ...updates, updatedAt: Date.now() };
    this.saveCustomThemes();
    return this.customThemes[id];
  }

  deleteCustomTheme(id) {
    if (!this.customThemes[id]) return false;
    
    delete this.customThemes[id];
    this.saveCustomThemes();
    
    if (this.currentTheme === id) {
      this.resetTheme();
    }
    
    return true;
  }

  exportTheme(themeName) {
    const theme = this.getThemeConfig(themeName);
    if (!theme) return null;

    const exportData = {
      theme,
      exportedAt: new Date().toISOString(),
      version: '2.0.0'
    };

    return JSON.stringify(exportData, null, 2);
  }

  importTheme(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      const theme = data.theme || data;
      
      if (!theme.id || !theme.colors) {
        throw new Error('Invalid theme format');
      }

      // Ensure unique ID for imported themes
      const id = theme.id.startsWith('custom-') ? theme.id : `custom-imported-${Date.now()}`;
      const importedTheme = {
        ...theme,
        id,
        custom: true,
        imported: true,
        importedAt: Date.now()
      };

      this.customThemes[id] = importedTheme;
      this.saveCustomThemes();
      return importedTheme;
    } catch (error) {
      console.error('Failed to import theme:', error);
      throw error;
    }
  }

  // Event listeners
  onThemeChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Theme builder helpers
  generateCSSVariables(themeConfig) {
    const vars = [];
    if (themeConfig.colors) {
      Object.entries(themeConfig.colors).forEach(([key, value]) => {
        vars.push(`--color-${key}: ${value};`);
      });
    }
    return vars.join('\n');
  }
}

// Singleton
export const themeManager = new ThemeManager();
export default themeManager;
