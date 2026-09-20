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
      // Strict CSP for the PACKAGED renderer only (dev preview keeps HMR alive).
      name: 'zpopcorn-csp',
      apply: 'build',
      transformIndexHtml(html) {
        const csp = [
          "default-src 'self' zpopcorn-media:",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob: zpopcorn-media: https://image.tmdb.org",
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
