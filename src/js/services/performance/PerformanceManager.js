/**
 * Performance Manager - Production-Grade Performance Optimization
 */

export class PerformanceManager {
  constructor() {
    this.metrics = {
      fcp: null,
      lcp: null,
      fid: null,
      cls: 0,
      tbt: 0
    };
    this.observers = [];
    this.cache = new Map();
    this.imageCache = new Map();
  }

  init() {
    if (typeof window === 'undefined') return;

    // Measure FCP
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = entry.startTime;
            console.log(` FCP: ${entry.startTime.toFixed(2)}ms`);
          }
        }
      });
      fcpObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(fcpObserver);
    } catch {}

    // Measure LCP
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.lcp = lastEntry.startTime;
        console.log(` LCP: ${lastEntry.startTime.toFixed(2)}ms`);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    } catch {}

    // Measure CLS
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.metrics.cls = clsValue;
          }
        }
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    } catch {}

    // Lazy loading observer
    this.initLazyLoading();
    this.initImageOptimization();
  }

  initLazyLoading() {
    if (!('IntersectionObserver' in window)) return;

    const lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          
          // Load image
          if (el.dataset.src) {
            el.src = el.dataset.src;
            el.removeAttribute('data-src');
          }
          
          // Load background
          if (el.dataset.bg) {
            el.style.backgroundImage = `url(${el.dataset.bg})`;
            el.removeAttribute('data-bg');
          }

          // Trigger load callback
          if (el.dataset.lazyCallback) {
            try {
              const callback = new Function(el.dataset.lazyCallback);
              callback.call(el);
            } catch {}
          }

          lazyObserver.unobserve(el);
        }
      });
    }, {
      rootMargin: '100px 0px',
      threshold: 0.01
    });

    // Auto observe lazy elements
    const observeLazyElements = () => {
      document.querySelectorAll('[data-src], [data-bg], [data-lazy]').forEach(el => {
        lazyObserver.observe(el);
      });
    };

    // Initial observe
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observeLazyElements);
    } else {
      observeLazyElements();
    }

    // Observe on route changes
    window.addEventListener('popstate', () => {
      setTimeout(observeLazyElements, 100);
    });

    this.lazyObserver = lazyObserver;
  }

  initImageOptimization() {
    // Use native lazy loading where supported
    if ('loading' in HTMLImageElement.prototype) {
      const images = document.querySelectorAll('img[loading="lazy"]');
      images.forEach(img => {
        if (img.dataset.src) {
          img.src = img.dataset.src;
        }
      });
    }
  }

  // Debounce utility
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle utility
  throttle(func, limit = 100) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Memoization
  memoize(fn, maxSize = 100) {
    const cache = new Map();
    
    return function(...args) {
      const key = JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = fn.apply(this, args);
      cache.set(key, result);

      if (cache.size > maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      return result;
    };
  }

  // Virtual scrolling for large lists
  createVirtualScroller(container, items, renderItem, itemHeight = 300) {
    let visibleStart = 0;
    let visibleEnd = 0;
    let scrollTop = 0;

    const updateVisible = () => {
      const containerHeight = container.clientHeight;
      visibleStart = Math.floor(scrollTop / itemHeight);
      visibleEnd = Math.min(
        items.length,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + 2
      );

      // Render only visible items
      const fragment = document.createDocumentFragment();
      const spacerTop = document.createElement('div');
      spacerTop.style.height = `${visibleStart * itemHeight}px`;
      fragment.appendChild(spacerTop);

      for (let i = visibleStart; i < visibleEnd; i++) {
        const el = renderItem(items[i], i);
        if (el) fragment.appendChild(el);
      }

      const spacerBottom = document.createElement('div');
      spacerBottom.style.height = `${(items.length - visibleEnd) * itemHeight}px`;
      fragment.appendChild(spacerBottom);

      container.innerHTML = '';
      container.appendChild(fragment);
    };

    const onScroll = this.throttle(() => {
      scrollTop = container.scrollTop;
      updateVisible();
    }, 16);

    container.addEventListener('scroll', onScroll);
    updateVisible();

    return {
      update: (newItems) => {
        items = newItems;
        updateVisible();
      },
      destroy: () => {
        container.removeEventListener('scroll', onScroll);
      }
    };
  }

  // Image caching
  async cacheImage(url) {
    if (this.imageCache.has(url)) {
      return this.imageCache.get(url);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(url, img);
        // Limit cache size
        if (this.imageCache.size > 200) {
          const firstKey = this.imageCache.keys().next().value;
          this.imageCache.delete(firstKey);
        }
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  // Preload critical resources
  preloadImages(urls) {
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    });
  }

  // Measure function performance
  measure(name, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    if (end - start > 16) { // More than 1 frame
      console.warn(`! Slow function ${name}: ${(end - start).toFixed(2)}ms`);
    }

    return result;
  }

  async measureAsync(name, fn) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    
    if (end - start > 100) {
      console.warn(`! Slow async ${name}: ${(end - start).toFixed(2)}ms`);
    }

    return result;
  }

  // Bundle size tracking
  getBundleStats() {
    const scripts = Array.from(document.scripts);
    let totalSize = 0;
    
    scripts.forEach(script => {
      if (script.src) {
        // Estimate from performance entries
        const entry = performance.getEntriesByName(script.src)[0];
        if (entry) {
          totalSize += entry.transferSize || 0;
        }
      }
    });

    return {
      scriptCount: scripts.length,
      estimatedSize: totalSize,
      metrics: { ...this.metrics }
    };
  }

  // Cleanup
  destroy() {
    this.observers.forEach(obs => {
      try {
        obs.disconnect();
      } catch {}
    });
    this.observers = [];
    
    if (this.lazyObserver) {
      this.lazyObserver.disconnect();
    }
  }

  // Report
  report() {
    return {
      metrics: this.metrics,
      cacheSize: this.cache.size,
      imageCacheSize: this.imageCache.size,
      bundle: this.getBundleStats(),
      memory: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null,
      timestamp: Date.now()
    };
  }
}

export const performanceManager = new PerformanceManager();
