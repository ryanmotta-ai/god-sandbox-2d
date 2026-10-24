import assert from 'node:assert/strict';
import { generateWorld, DEFAULT_GEN } from '../src/world/gen';
import { Sim } from '../src/sim/sim';
import { newKingdom, declareWar } from '../src/sim/kingdom';
import { foundCity } from '../src/sim/city';
import { snapshot, restore } from '../src/core/save';
import type { Kingdom } from '../src/sim/kingdom';

// Realms that share an enemy become friends and ally; war on one drags in the other; allies persist in saves.
const sim = new Sim(generateWorld({ ...DEFAULT_GEN, size: 128, seed: 3 }), 3);
const land: { x: number; y: number }[] = [];
for (let y = 20; y < 108; y++) for (let x = 20; x < 108; x++) if (sim.world.t(x, y) === 4 && sim.world.obj[y * 128 + x] === 0) land.push({ x, y });
const pts = [0.15, 0.4, 0.7].map(f => land[Math.floor(land.length * f)]);
const [ka, kb, kc] = [newKingdom(sim, 'human'), newKingdom(sim, 'human'), newKingdom(sim, 'orc')];
const settle = (k: Kingdom, x: number, y: number): void => {
  const c = foundCity(sim, k.race, x, y, [], k);
  for (let i = 0; i < 6; i++) { const sp = sim.freeSpot(c.x + (i % 3) - 1, c.y + 2 + Math.floor(i / 3), 4)!; sim.spawn(k.race, sp.x, sp.y, { role: 'peasant', city: c.id, kingdom: k.id }); }
};
[ka, kb, kc].forEach((k, i) => { k.trait = 'diplomat'; settle(k, pts[i].x, pts[i].y); });
for (const k of [ka, kb]) k.relations.set(kc.id, -50), kc.relations.set(k.id, -50);
kc.trait = 'warlike';
declareWar(sim, kc, ka, 'teste');
assert.ok(!kb.wars.has(kc.id), 'unallied realm joined a war');
for (let i = 0; i < 20 * 600 && !ka.allies.has(kb.id); i++) { sim.tick(); if (!ka.wars.has(kc.id)) declareWar(sim, kc, ka, 'teste'); if (!kb.wars.has(kc.id)) declareWar(sim, kc, kb, 'teste'); }
assert.ok(ka.allies.has(kb.id) && kb.allies.has(ka.id), 'common enemy never produced an alliance');

const copy = restore(JSON.parse(JSON.stringify(snapshot(sim))));
assert.ok(copy.kingdoms.get(ka.id)!.allies.has(kb.id), 'alliance lost in save');

const kd = newKingdom(sim, 'human');
settle(kd, pts[0].x + 4, pts[0].y + 4);
ka.wars.delete(kc.id); kc.wars.delete(ka.id); kb.wars.delete(kc.id); kc.wars.delete(kb.id);
declareWar(sim, kd, kb, 'teste');
assert.ok(ka.wars.has(kd.id), 'ally did not answer the call');
console.log(`  alliance: ${ka.name} + ${kb.name}, war on one pulled in the other`);
