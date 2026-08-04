import { defineConfig } from 'vite';

/** Bundles a headless diagnostic script so it can run under plain Node. */
export default defineConfig({
  build: {
    ssr: 'scratch/perf_sim.ts',
    outDir: 'scratch/.perfbase',
    target: 'node20',
    minify: false,
    emptyOutDir: true,
    rollupOptions: { output: { format: 'esm', entryFileNames: 'perf.mjs' } }
  }
});
