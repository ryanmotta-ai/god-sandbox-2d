import { defineConfig } from 'vite';

/** Bundles a headless worldgen probe so it can run under plain Node. */
export default defineConfig({
  build: {
    ssr: 'scratch/probe_worlds.ts',
    outDir: 'scratch/.worldbase',
    target: 'node20',
    minify: false,
    emptyOutDir: true,
    rollupOptions: { output: { format: 'esm', entryFileNames: 'probe.mjs' } }
  }
});
