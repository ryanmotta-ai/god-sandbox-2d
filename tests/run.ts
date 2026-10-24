import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** `npm test`: runs every *.test.ts in this folder. Each file is plain asserts; a throw fails the run. */
const dir = dirname(fileURLToPath(import.meta.url));
let failed = 0;
for (const f of readdirSync(dir).filter((f: string) => f.endsWith('.test.ts')).sort()) {
  const t0 = performance.now();
  try { await import(join(dir, f)); console.log(`ok   ${f} (${Math.round(performance.now() - t0)}ms)`); }
  catch (e) { failed++; console.log(`FAIL ${f}\n${(e as Error).stack}`); }
}
if (failed) { console.log(`${failed} failed`); process.exit(1); }
