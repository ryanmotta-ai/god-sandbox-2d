import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { generateWorld, DEFAULT_GEN, type Preset } from '../src/world/gen';
import { TERRAIN, OBJECTS } from '../src/world/defs';

/** `npx tsx tools/mapdump.ts out.png [preset] [seed] [size]` — flat-colour PNG of a generated world. */
const [out = 'map.png', preset = 'continents', seed = '1', size = '192'] = process.argv.slice(2);
const w = generateWorld({ ...DEFAULT_GEN, preset: preset as Preset, seed: +seed, size: +size });
const S = 3, W = w.w * S, H = w.h * S, raw = Buffer.alloc((W * 3 + 1) * H);
const hex = (s: string) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    const i = ((y / S) | 0) * w.w + ((x / S) | 0);
    let c = hex(TERRAIN[w.terrain[i]].ramp[2]);
    if (OBJECTS[w.obj[i]].tree && (x % S === 1 && y % S === 1)) c = [20, 70, 25];
    raw.set(c, y * (W * 3 + 1) + 1 + x * 3);
  }
}
const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
const chunk = (t: string, d: Buffer) => { const b = Buffer.alloc(8 + d.length + 4); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
