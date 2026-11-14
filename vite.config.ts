/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Production-only Content Security Policy, injected as a <meta> tag.
 *
 * Why a meta tag: GitHub Pages can't send HTTP security headers. (On Firebase
 * Hosting, firebase.json sends real headers too; both apply.) Not added in
 * dev, where Vite's hot reload needs a websocket.
 *
 * Allows only: our own files, Google/Firebase APIs, and the Firebase Auth
 * frame (needed only if Google sign-in is ever enabled).
 */
function contentSecurityPolicy(authDomain: string | undefined, extraFrameDomain: string | undefined): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self' https://apis.google.com",
    "style-src 'self' 'unsafe-inline'", // Radix UI positions popups with inline styles
    "img-src 'self' data: https://*.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self' https://*.googleapis.com",
    `frame-src ${[authDomain, extraFrameDomain].filter(Boolean).map((d) => `https://${d}`).join(' ') || "'none'"}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'pacuhub-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' }],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
  // "/" for Firebase Hosting; "/pacuhub/" for GitHub Pages (set by its workflow).
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), contentSecurityPolicy(env.VITE_FIREBASE_AUTH_DOMAIN, env.VITE_SNV2_FIREBASE_AUTH_DOMAIN)],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Vendor code changes rarely; app code changes every deploy. Splitting them
    // means a routine release only re-downloads the small app chunk.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](firebase|@firebase)[\\/]/.test(id)) return 'vendor-firebase';
          if (/[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
};
});
