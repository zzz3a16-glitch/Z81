/**
 * Lightweight Router - Production-Grade SPA Router
 */

export class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.history = [];
    this.listeners = [];
    this.beforeHooks = [];
    this.afterHooks = [];
  }

  addRoute(path, handler, options = {}) {
    // Convert path to regex
    const paramNames = [];
    const regexPath = path
      .replace(/\/:([^/]+)/g, (match, paramName) => {
        paramNames.push(paramName);
        return '/([^/]+)';
      })
      .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPath}$`);

    this.routes.set(path, {
      path,
      regex,
      paramNames,
      handler,
      options
    });

    return this;
  }

  addRoutes(routes) {
    Object.entries(routes).forEach(([path, handler]) => {
      if (typeof handler === 'function') {
        this.addRoute(path, handler);
      } else {
        this.addRoute(path, handler.handler, handler.options);
      }
    });
    return this;
  }

  beforeEach(hook) {
    this.beforeHooks.push(hook);
  }

  afterEach(hook) {
    this.afterHooks.push(hook);
  }

  async navigate(path, params = {}, options = {}) {
    const { replace = false, query = {} } = options;

    // Run before hooks
    for (const hook of this.beforeHooks) {
      const result = await hook(path, this.currentRoute);
      if (result === false) return false; // Navigation cancelled
    }

    // Build full path with query
    let fullPath = path;
    if (Object.keys(query).length > 0) {
      const queryString = new URLSearchParams(query).toString();
      fullPath += `?${queryString}`;
    }

    // Update history
    if (replace) {
      history.replaceState({ path, params, query }, '', fullPath);
    } else {
      history.pushState({ path, params, query }, '', fullPath);
      this.history.push({ path, params, query, timestamp: Date.now() });
    }

    // Handle route
    await this.handleRoute(path, params, query);

    // Run after hooks
    for (const hook of this.afterHooks) {
      await hook(path, this.currentRoute);
    }

    return true;
  }

  async handleRoute(path, params = {}, query = {}) {
    // Parse query from URL if not provided
    if (Object.keys(query).length === 0) {
      const urlParams = new URLSearchParams(window.location.search);
      for (const [key, value] of urlParams.entries()) {
        query[key] = value;
      }
    }

    // Find matching route
    let matchedRoute = null;
    let routeParams = { ...params };

    for (const route of this.routes.values()) {
      const match = path.match(route.regex);
      if (match) {
        matchedRoute = route;
        route.paramNames.forEach((name, index) => {
          routeParams[name] = match[index + 1];
        });
        break;
      }
    }

    if (!matchedRoute) {
      // 404
      matchedRoute = this.routes.get('/404') || this.routes.get('*');
      if (!matchedRoute) {
        console.warn(`No route found for ${path}`);
        return;
      }
    }

    this.currentRoute = {
      path: matchedRoute.path,
      actualPath: path,
      params: routeParams,
      query,
      handler: matchedRoute.handler,
      options: matchedRoute.options
    };

    // Execute handler
    try {
      await matchedRoute.handler(routeParams, query);
    } catch (error) {
      console.error('Route handler error:', error);
    }

    // Notify listeners
    this.listeners.forEach(cb => {
      try {
        cb(this.currentRoute);
      } catch {}
    });

    // Dispatch event
    window.dispatchEvent(new CustomEvent('routechange', { 
      detail: this.currentRoute 
    }));
  }

  goBack() {
    if (this.history.length > 1) {
      history.back();
    } else {
      this.navigate('/');
    }
  }

  goForward() {
    history.forward();
  }

  getCurrentRoute() {
    return this.currentRoute;
  }

  getHistory() {
    return [...this.history];
  }

  onRouteChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  init() {
    // Handle initial route
    const initialPath = window.location.pathname || '/';
    this.handleRoute(initialPath);

    // Handle popstate
    window.addEventListener('popstate', (event) => {
      const path = window.location.pathname || '/';
      const state = event.state || {};
      this.handleRoute(path, state.params || {}, state.query || {});
    });

    // Handle link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-router]');
      if (link) {
        e.preventDefault();
        const path = link.getAttribute('href');
        if (path) {
          this.navigate(path);
        }
      }
    });
  }

  // Helper to create router links
  link(path, text, options = {}) {
    const className = options.className || '';
    const attrs = Object.entries(options.attrs || {})
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    
    return `<a href="${path}" data-router class="${className}" ${attrs}>${text}</a>`;
  }
}

export const router = new Router();
export default router;
