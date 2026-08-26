/**
 * The two non-trivial survivors of the currency purge: cross-border payment
 * (gold must be conserved and never overdrawn) and loading a pre-purge save.
 */
import { KingdomEconomy } from '../src/civ/Economy';
import assert from 'node:assert/strict';

// ---- payAcrossBorder conserves gold and never overdraws ----
{
  const a = new KingdomEconomy();
  const b = new KingdomEconomy();
  a.treasury = 300;
  b.treasury = 50;
  const before = a.treasury + b.treasury;

  const paid = a.payAcrossBorder(b, 120);
  assert.equal(paid, 120);
  assert.equal(a.treasury + b.treasury, before, 'gold conserved on a normal payment');

  // Asking for more than the till holds pays only what is there.
  const overdraw = a.payAcrossBorder(b, 10_000);
  assert.equal(overdraw, 180);
  assert.equal(a.treasury, 0, 'till empties, never goes negative');
  assert.equal(a.treasury + b.treasury, before, 'gold conserved on an overdraw');

  // An empty till pays nothing, and a nonsense amount is refused.
  assert.equal(a.payAcrossBorder(b, 50), 0);
  assert.equal(b.payAcrossBorder(a, -5), 0);
  assert.equal(a.treasury + b.treasury, before);
}

// ---- a save written before the purge still loads ----
{
  const legacy = new KingdomEconomy();
  legacy.deserialize({
    treasury: 900,
    currency: { name: 'Real de Frostholm', symbol: 'R$', value: 2.5, supply: 4000, inflation: 0.07 },
    gdp: 640,
    gdpPerCapita: 12.5,
    stability: 0.61
  });
  assert.equal(legacy.treasury, 900);
  assert.equal(legacy.output, 640, 'old gdp reads back as output');
  assert.equal(legacy.outputPerCapita, 12.5);
  assert.equal(legacy.stability, 0.61);
  assert.equal((legacy as any).currency, undefined, 'no mint survives the load');

  // And a round trip through the new format keeps the numbers.
  const fresh = new KingdomEconomy();
  fresh.deserialize(JSON.parse(JSON.stringify(legacy.serialize())));
  assert.equal(fresh.output, 640);
  assert.equal(fresh.treasury, 900);
}

console.log('economy-gold.test: gold conserved, overdraw clamped, pre-purge saves load');
