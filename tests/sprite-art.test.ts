/**
 * The PNG packs are wired to the canvas renderer by manifest path, and every
 * lookup in that path fails soft: a missing file, a renamed folder or a sheet of
 * the wrong size all resolve to null, the renderer quietly draws the generated
 * sprite instead, and the artwork simply never appears. Nothing throws and
 * nothing logs, so this is the check that fails loudly in its place.
 *
 *   npx tsx tests/sprite-art.test.ts
 */
import { existsSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { CITY_ASSET_MANIFEST } from '../src/assets/CityAssetManifest';
import {
  ENTITY_ASSET_MANIFEST, ENTITY_SHEET_ANIMATIONS, ENTITY_SHEET_CELL,
  ENTITY_SHEET_DIRECTIONS, ENTITY_SHEET_FRAMES
} from '../src/assets/EntityAssetManifest';
import { MASTER_ASSET_MANIFEST, masterBuildingAtlasKey } from '../src/assets/MasterAssetManifest';
import { resolveEntityVisualProfile } from '../src/renderer/EntityVisualResolver';
import type { Entity } from '../src/entities/Entity';
import { SpeciesType } from '../src/entities/Species';

const ASSETS = resolve(import.meta.dirname, '../src/assets');
const assetPath = (source: string) => resolve(ASSETS, source);

/** Width and height straight out of the IHDR, so no image decoder is needed. */
function pngSize(file: string): [number, number] {
  const fd = openSync(file, 'r');
  const header = Buffer.alloc(24);
  readSync(fd, header, 0, 24, 0);
  closeSync(fd);
  return [header.readUInt32BE(16), header.readUInt32BE(20)];
}

interface Manifest {
  assets: readonly { id: string; source: string; canvas: readonly [number, number] }[];
}

/**
 * A declared asset with no PNG yet is legal — the manifests are written ahead of
 * the art and the renderer falls back — so absences are counted, not failed on.
 * A file that *is* there at the wrong size is a real defect: the canvas path
 * scales it to fit and shows it, the WebGPU atlas rejects it outright, and the
 * two renderers then disagree about what the world looks like.
 */
function checkPack(name: string, manifest: Manifest): { present: number; absent: string[] } {
  const absent: string[] = [];
  let present = 0;
  for (const asset of manifest.assets) {
    const file = assetPath(asset.source);
    if (!existsSync(file)) { absent.push(asset.id); continue; }
    const [width, height] = pngSize(file);
    assert.deepEqual(
      [width, height], [...asset.canvas],
      `${name}/${asset.id}: manifest declares ${asset.canvas[0]}x${asset.canvas[1]} but the file is ${width}x${height}`
    );
    present++;
  }
  return { present, absent };
}

// 1. The two packs the renderer depends on are complete, so a renamed folder or
//    a dropped file fails here instead of silently reverting to generated art.
const city = checkPack('city', CITY_ASSET_MANIFEST);
const entity = checkPack('entity', ENTITY_ASSET_MANIFEST);
const master = checkPack('master', MASTER_ASSET_MANIFEST);
assert.deepEqual(city.absent, [], 'city pack is missing artwork it declares');
assert.deepEqual(entity.absent, [], 'entity pack is missing artwork it declares');
assert.ok(master.present > 0, 'library pack resolved no artwork at all');
const checked = city.present + entity.present + master.present;

// 2. The sheet grid divides its file exactly, so no cell can straddle two frames.
const [sheetWidth, sheetHeight] = ENTITY_ASSET_MANIFEST.assets[0].canvas;
assert.equal(ENTITY_SHEET_FRAMES * ENTITY_SHEET_CELL, sheetWidth, 'frame columns must fill the sheet width');
assert.equal(
  ENTITY_SHEET_DIRECTIONS.length * ENTITY_SHEET_ANIMATIONS.length * ENTITY_SHEET_CELL, sheetHeight,
  'direction/animation rows must fill the sheet height'
);

// 3. Every animation cell is distinct and inside the sheet.
const cells = new Set<string>();
for (const direction of ENTITY_SHEET_DIRECTIONS) {
  for (const animation of ENTITY_SHEET_ANIMATIONS) {
    for (let frame = 0; frame < ENTITY_SHEET_FRAMES; frame++) {
      const row = ENTITY_SHEET_DIRECTIONS.indexOf(direction) * ENTITY_SHEET_ANIMATIONS.length
        + ENTITY_SHEET_ANIMATIONS.indexOf(animation);
      const x = frame * ENTITY_SHEET_CELL, y = row * ENTITY_SHEET_CELL;
      assert.ok(x + ENTITY_SHEET_CELL <= sheetWidth && y + ENTITY_SHEET_CELL <= sheetHeight,
        `cell ${direction}/${animation}/${frame} falls outside the sheet`);
      cells.add(`${x},${y}`);
    }
  }
}
assert.equal(cells.size, ENTITY_SHEET_DIRECTIONS.length * ENTITY_SHEET_ANIMATIONS.length * ENTITY_SHEET_FRAMES,
  'two animation cells resolved to the same place in the sheet');

// 4. Every profile the resolver can name has a sheet behind it. Without this a
//    whole life stage or profession silently keeps the generated sprite.
const PROFILES = new Set(ENTITY_ASSET_MANIFEST.assets.map(asset => asset.profile));
const person = (over: Partial<Entity>): Entity => ({
  id: 'seed-entity-1', species: SpeciesType.HUMAN, lifeStage: 'adult',
  isPregnant: false, profession: 'none', ...over
} as Entity);

const cases: Entity[] = [
  ...(['infant', 'child', 'adolescent', 'elder', 'adult'] as const).map(lifeStage => person({ lifeStage })),
  person({ isPregnant: true }),
  ...(['farmer', 'woodcutter', 'miner', 'builder', 'soldier', 'archer', 'scout', 'healer', 'leader', 'king'] as const)
    .map(profession => person({ profession })),
  ...Object.values(SpeciesType).filter(species => species !== SpeciesType.HUMAN)
    .flatMap(species => (['adult', 'child'] as const).map(lifeStage => person({ species, lifeStage })))
];
// Many ids, because adult humans and deer pick their sheet by hashing the id.
for (const base of cases) {
  for (let n = 0; n < 24; n++) {
    const entity = { ...base, id: `${base.id}-${n}` } as Entity;
    const profile = resolveEntityVisualProfile(entity);
    assert.ok(PROFILES.has(profile), `resolver asked for "${profile}", which no sheet provides`);
    const mothered = resolveEntityVisualProfile(entity, new Set([entity.id]));
    assert.ok(PROFILES.has(mothered), `resolver asked for "${mothered}", which no sheet provides`);
  }
}

// 5. The library tier is reachable: it must answer for building types the city
//    pack has no artwork for, or the second lookup in the renderer is dead code.
const masterKeys = new Set(
  MASTER_ASSET_MANIFEST.assets.map(masterBuildingAtlasKey).filter((key): key is string => !!key)
);
for (const type of ['refinery', 'oil_well']) {
  assert.ok([...masterKeys].some(key => key.startsWith(`building:${type}:`)),
    `library pack answers for no ${type}, so the renderer's fallback tier never runs`);
}

const reachable = city.present + entity.present
  + MASTER_ASSET_MANIFEST.assets.filter(a => existsSync(assetPath(a.source)) && masterBuildingAtlasKey(a)).length;
console.log(
  `sprite-art: ${checked} PNGs verified (city ${city.present}, entity ${entity.present}, library ${master.present})`
  + `, ${cells.size} sheet cells, ${PROFILES.size} entity profiles, ${masterKeys.size} library building keys`
);
console.log(`sprite-art: ${reachable} reachable from the canvas renderer; ${master.absent.length} library assets declared but not yet drawn`);
