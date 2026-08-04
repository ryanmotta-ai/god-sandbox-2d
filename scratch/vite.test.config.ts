import { defineConfig } from 'vite';

/**
 * Bundles one test suite so it can run under plain Node.
 *
 * There is no test runner in this project and TypeScript 7 dropped the
 * `node` module resolution `tsx` relied on, so Vite's SSR build is what turns a
 * suite that imports the real simulation into something Node can execute.
 * Pick the suite with TEST_ENTRY.
 */
const entry = process.env.TEST_ENTRY ?? 'scratch/test_determinism.ts';

export default defineConfig({
  build: {
    ssr: entry,
    outDir: 'scratch/.testbuild',
    target: 'node20',
    minify: false,
    emptyOutDir: true,
    rollupOptions: { output: { format: 'esm', entryFileNames: 'suite.mjs' } }
  }
});
