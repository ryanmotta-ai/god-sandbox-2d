import { defineConfig } from 'vite';

const tauriDevHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  // Keep Rust compiler errors visible while `tauri dev` owns the terminal.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: tauriDevHost || false,
    hmr: tauriDevHost
      ? {
          protocol: 'ws',
          host: tauriDevHost,
          port: 1421
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    // Preserve the project's existing ES2022 contract across browser and WebView builds.
    target: 'es2022',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG)
  }
});
