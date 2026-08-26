/**
 * An age is the whole technology model, so it has to be airtight in three ways:
 * a realm knows exactly what its age carries and nothing beyond it, an age turns
 * over only when the realm has actually grown into it, and a save from the tree
 * era still knows how far it had come.
 */
import { ResearchState, TECH_ERAS, TECHNOLOGIES, ALL_TECH_IDS, ERA_ORDER } from '../src/civ/TechTree';
import assert from 'node:assert/strict';

// ---- a realm knows its age, and no further ----
{
  const r = new ResearchState();
  assert.equal(r.era, 'stone', 'everybody starts in the stone age');
  assert.ok(r.knows('tribalism'), 'and knows what the stone age carries');

  const laterThanStone = ALL_TECH_IDS.filter(id => TECH_ERAS[TECHNOLOGIES[id].era].order > 0);
  assert.ok(laterThanStone.length > 0, 'the table has to span more than one age');
  for (const id of laterThanStone) {
    assert.ok(!r.knows(id), `a stone-age realm must not know ${id}`);
  }

  // Everything the stone age carries, it knows.
  for (const id of ALL_TECH_IDS.filter(i => TECHNOLOGIES[i].era === 'stone')) {
    assert.ok(r.knows(id), `a stone-age realm has to know ${id}`);
  }
}

// ---- an age turns over on growth, not on a timer ----
{
  const r = new ResearchState();
  assert.equal(r.advance(0, 0), null, 'an empty realm stays where it is');
  assert.equal(r.advance(39, 500), null, 'buildings alone are not enough');
  assert.equal(r.advance(500, 11), null, 'and neither are people alone');
  assert.equal(r.era, 'stone');

  assert.equal(r.advance(40, 12), 'bronze', 'a realm that has grown into the bronze age reaches it');
  assert.equal(r.era, 'bronze');
  assert.ok(r.knows('bronze_working'), 'and gains what that age carries');

  // One age at a time, however big the realm is.
  assert.equal(r.advance(100_000, 100_000), 'iron', 'a huge realm still steps one age at a time');
  assert.equal(r.era, 'iron');
}

// ---- the last age is the last age ----
{
  const r = new ResearchState();
  for (let i = 0; i < ERA_ORDER.length * 2; i++) r.forceAdvance();
  assert.equal(r.era, ERA_ORDER[ERA_ORDER.length - 1], 'forcing past the end stops at the end');
  assert.equal(r.forceAdvance(), null, 'and reports that there is nowhere to go');
  assert.equal(r.advance(1e9, 1e9), null);
}

// ---- what an age unlocks actually widens as ages pass ----
{
  const stone = new ResearchState();
  const modern = new ResearchState();
  for (let i = 0; i < ERA_ORDER.length; i++) modern.forceAdvance();

  assert.ok(modern.known.size > stone.known.size, 'a later age knows more');
  assert.ok(
    modern.unlockedBuildings().size > stone.unlockedBuildings().size,
    'and can build more'
  );
  assert.ok(
    modern.unlockedGovernments().length >= stone.unlockedGovernments().length,
    'and is governed by more than a chiefdom'
  );
  assert.ok(modern.modifiers().military > stone.modifiers().military, 'and fights better');
}

// ---- a save round-trips, and a save from the tree era still loads ----
{
  const r = new ResearchState();
  r.forceAdvance();
  r.forceAdvance();
  const back = new ResearchState();
  back.deserialize(JSON.parse(JSON.stringify(r.serialize())));
  assert.equal(back.era, r.era, 'an era survives a save');

  // The old format stored a list of known technologies. The age it had reached
  // is the furthest age anything on that list belongs to.
  const legacy = new ResearchState();
  legacy.deserialize({ known: ['tribalism', 'agriculture', 'bronze_working', 'iron_working'], current: null, progress: 40 });
  assert.equal(legacy.era, TECHNOLOGIES.iron_working.era, 'a tree-era save keeps the age it had reached');
  assert.ok(legacy.knows('bronze_working'), 'and everything below it');

  const empty = new ResearchState();
  empty.deserialize({ known: [] });
  assert.equal(empty.era, 'stone', 'an empty save is a stone-age realm');
}

console.log('tech-eras.test: an age knows its own, grows into the next, and survives a save');
