/**
 * Gold is a physical good now, so the money path is a stockpile path.
 *
 * There is no treasury number to go negative and no mint to paper over an empty
 * vault: a realm has the gold it has, a payment moves metal from one till to
 * another, and a till has a capacity like any other store. Those are the ways
 * gold could quietly be created or destroyed, so they are worth a test.
 */
import { Kingdom } from '../src/civ/Kingdom';
import { KingdomEconomy } from '../src/civ/Economy';
import { SpeciesType } from '../src/entities/Species';
import assert from 'node:assert/strict';

const realm = (id: string) => new Kingdom(id, `Realm ${id}`, SpeciesType.HUMAN, '#888888', `${id}-capital`, 1);

// ---- gold in, gold out, and the mirror stays honest ----
{
  const a = realm('a');
  const held = a.gold;
  assert.equal(a.addGold(250), 250);
  assert.equal(a.gold, held + 250);
  assert.equal(a.wealth, a.gold, 'wealth mirrors the metal');

  assert.equal(a.takeGold(100), 100);
  assert.equal(a.gold, held + 150);
  assert.equal(a.wealth, a.gold);

  // Nonsense amounts are refused rather than inverted.
  assert.equal(a.addGold(-50), 0);
  assert.equal(a.takeGold(-50), 0);
  assert.equal(a.gold, held + 150);
}

// ---- a payment moves metal; it never creates or destroys it ----
{
  const payer = realm('p');
  const payee = realm('q');
  payer.addGold(500);
  const before = payer.gold + payee.gold;

  payee.addGold(payer.takeGold(120));
  assert.equal(payer.gold + payee.gold, before, 'gold conserved on a normal payment');

  // Asking for more than the till holds pays only what is there.
  const paid = payer.takeGold(1_000_000);
  payee.addGold(paid);
  assert.equal(payer.gold, 0, 'the till empties, it never goes negative');
  assert.equal(payer.gold + payee.gold, before, 'gold conserved on an overdraw');

  // An empty till pays nothing at all.
  assert.equal(payer.takeGold(50), 0);
}

// ---- a vault has a capacity, and what will not fit is not silently eaten ----
{
  const rich = realm('r');
  const capacity = (rich.treasury as unknown as { capacity: number }).capacity;
  const stored = rich.addGold(capacity * 10);
  assert.ok(stored < capacity * 10, 'a hoard is limited by the vault that holds it');
  assert.equal(rich.gold, stored, 'and what was stored is exactly what it reports');
  assert.equal(rich.addGold(1000), 0, 'a full vault takes nothing more');
}

// ---- the realm's condition carries no money at all ----
{
  const economy = new KingdomEconomy();
  assert.equal((economy as unknown as { treasury?: number }).treasury, undefined, 'no treasury number survives');
  economy.output = 640;
  economy.outputPerCapita = 12.5;
  economy.stability = 0.61;

  const back = new KingdomEconomy();
  back.deserialize(JSON.parse(JSON.stringify(economy.serialize())));
  assert.equal(back.output, 640);
  assert.equal(back.outputPerCapita, 12.5);
  assert.equal(back.stability, 0.61);

  // A save from before either rename still loads.
  const legacy = new KingdomEconomy();
  legacy.deserialize({ gdp: 400, gdpPerCapita: 9, stability: 0.5, treasury: 9999, currency: { value: 2 } });
  assert.equal(legacy.output, 400, 'old gdp reads back as output');
  assert.equal(legacy.outputPerCapita, 9);
  assert.equal((legacy as unknown as { treasury?: number }).treasury, undefined, 'and the old treasury is ignored');
}

console.log('economy-gold.test: gold conserved, vault bounded, no treasury number left');
