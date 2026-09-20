import { defineConfig } from 'vite';

/**
 * Production renderer build for Electron (loaded via file:// inside
 * zPopcorn.exe) while `vite dev` remains usable as a browser preview/QA mode.
 */
export default defineConfig({
  // Relative asset URLs so index.html works from file:// in the packaged app.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2022',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [],
        },
      },
    },
  },
  plugins: [
    {
      // Dev-only playlist proxy: browser QA mode has no Electron socket, and
      // IPTV hosts never send CORS headers. Same-origin relay with the SAME
      // caps as the main process (size/time/http-only) so preview == desktop.
      name: 'zpopcorn-live-devproxy',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/__zpop-live-fetch', async (req, res) => {
          res.setHeader('content-type', 'application/json; charset=utf-8');
          let u;
          try {
            u = new URL(req.url, 'http://local');
            u = new URL(u.searchParams.get('url') || '');
          } catch { res.statusCode = 400; res.end(JSON.stringify({ ok: false, code: 'E_BAD_URL', message: 'invalid url param' })); return; }
          if (u.protocol !== 'http:' && u.protocol !== 'https:') { res.statusCode = 400; res.end(JSON.stringify({ ok: false, code: 'E_BAD_URL', message: 'http/https only' })); return; }
          const MAX = 32 * 1024 * 1024;
          const ac = new AbortController();
          const t0 = Date.now();
          const timer = setTimeout(() => ac.abort(new Error('E_TIMEOUT')), 25000);
          try {
            const r = await fetch(u, { signal: ac.signal, redirect: 'follow', headers: { 'user-agent': 'zPopcorn-Live/1.0 (dev-preview)', accept: 'application/x-mpegurl,application/vnd.apple.mpegurl,*/*' } });
            if (!r.ok && r.status >= 400) { try { r.body?.cancel(); } catch { /* ignore */ } res.statusCode = 200; res.end(JSON.stringify({ ok: false, code: 'E_HTTP', status: r.status, message: `HTTP ${r.status}` })); return; }
            const buf = new Uint8Array(await r.arrayBuffer());
            const truncated = buf.length > MAX;
            const ct = r.headers.get('content-type') || '';
            const charset = /charset=([\w-]+)/i.exec(ct)?.[1];
            const dec = new TextDecoder(/windows-125[0-9]|latin-?1/i.test(charset || '') ? 'windows-1256' : 'utf-8', { fatal: false });
            res.end(JSON.stringify({ ok: true, status: r.status, text: dec.decode(truncated ? buf.subarray(0, MAX) : buf), bytes: buf.length, truncated, contentType: ct, finalUrl: r.url || u.toString(), redirects: r.redirected ? 1 : 0, ms: Date.now() - t0 }));
          } catch (e) {
            const to = String(e?.name) === 'AbortError' || String(e?.message || '').includes('E_TIMEOUT');
            res.end(JSON.stringify({ ok: false, code: to ? 'E_TIMEOUT' : 'E_NETWORK', message: to ? 'timeout' : String(e?.message || 'network error').slice(0, 200) }));
          } finally { clearTimeout(timer); }
        });
      },
    },
    {
      // Strict CSP for the PACKAGED renderer only (dev preview keeps HMR alive).
      name: 'zpopcorn-csp',
      apply: 'build',
      transformIndexHtml(html) {
        const csp = [
          "default-src 'self' zpopcorn-media: zpopcorn-live:",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob: zpopcorn-media: zpopcorn-live: https://image.tmdb.org http: https:",
          "connect-src 'self'",
          "object-src 'none'",
          "frame-src 'none'",
          "base-uri 'none'",
          "form-action 'none'",
        ].join('; ');
        return html.replace(
          '<meta charset="UTF-8">',
          `<meta charset="UTF-8">\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`
        );
      },
    },
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});
