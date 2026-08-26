import assert from 'node:assert';
import { DiplomacyManager, NEUTRAL_WARMTH_CEILING } from '../src/civ/Diplomacy';

const d = new DiplomacyManager();

// Pure drift: a hundred years of two realms liking each other a little.
for (let i = 0; i < 200; i++) d.changeRelation('a', 'b', 5);
console.log(`deriva pura apos 200 aquecimentos de +5: ${d.getRelation('a', 'b')}`);
assert.equal(d.getRelation('a', 'b'), NEUTRAL_WARMTH_CEILING, 'deriva tem que parar no teto');

// Hostility is never capped.
for (let i = 0; i < 200; i++) d.changeRelation('a', 'b', -5);
console.log(`e depois de 200 esfriamentos de -5: ${d.getRelation('a', 'b')}`);
assert.equal(d.getRelation('a', 'b'), -100, 'odio nao tem teto');

// A deliberate act sets whatever it says, and drift cannot climb back past it.
d.setRelation('c', 'd', 100);
d.changeRelation('c', 'd', 5);
console.log(`ato deliberado em 100, mais uma deriva de +5: ${d.getRelation('c', 'd')}`);
assert.equal(d.getRelation('c', 'd'), 100, 'um pacto nao e derrubado pelo teto, nem elevado pela deriva');

// Allies are exempt, which is what buys devotion.
d.setRelation('e', 'f', 50);
d.createAlliance('e', 'f', 'Liga', 1);
console.log(`aliados apos alianca: ${d.getRelation('e', 'f')}`);
for (let i = 0; i < 20; i++) d.changeRelation('e', 'f', 5);
console.log(`aliados apos 20 aquecimentos: ${d.getRelation('e', 'f')}`);
assert.ok(d.getRelation('e', 'f') > NEUTRAL_WARMTH_CEILING, 'aliados passam do teto');

console.log('\ndiplomacy-ceiling.test: deriva para em 55, odio nao tem piso, pactos e aliados sao isentos');
