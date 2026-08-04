import { defineConfig } from 'vite';

/** Bundles a headless diagnostic script so it can run under plain Node. */
export default defineConfig({
  build: {
    ssr: 'scratch/audit_systems.ts',
    outDir: 'scratch/.auditbase',
    target: 'node20',
    minify: false,
    emptyOutDir: true,
    rollupOptions: { output: { format: 'esm', entryFileNames: 'audit.mjs' } }
  }
});
