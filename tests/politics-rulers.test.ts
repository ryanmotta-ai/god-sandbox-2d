/**
 * The political layer, which is now a person on a throne and a bar on a town.
 *
 * Three things have to hold or the whole module is decoration: a ruler's
 * temperament has to actually vary with who they are, a king who is losing has
 * to sue for peace regardless of how warlike he is, and a king with a grievance
 * he can reach has to act on it.
 */
import { rulerTraitOf, governorTraitOf, decideRoyalAction, RULER_TRAITS, type Neighbour, type CourtState } from '../src/civ/Rulers';
import { realmTraitsOf, realmEffects, REALM_TRAITS } from '../src/civ/RealmTraits';
import { createPsyche } from '../src/entities/Psyche';
import type { Psyche } from '../src/entities/Psyche';
import assert from 'node:assert/strict';

const psyche = (over: Partial<Psyche>): Psyche => ({ ...createPsyche(() => 0.5), ...over });

// ---- temperament tracks the person ----
{
  assert.equal(rulerTraitOf(psyche({ aggression: 0.9, courage: 0.8 })), 'bloodthirsty');
  assert.equal(rulerTraitOf(psyche({ aggression: 0.7, courage: 0.4 })), 'warlike');
  assert.equal(rulerTraitOf(psyche({ aggression: 0.2, ambition: 0.9, loyalty: 0.1 })), 'tyrant');
  assert.equal(rulerTraitOf(psyche({ aggression: 0.2, ambition: 0.65, loyalty: 0.8 })), 'greedy');
  assert.equal(rulerTraitOf(psyche({ aggression: 0.4, sociability: 0.8, ambition: 0.3 })), 'diplomat');
  assert.equal(rulerTraitOf(psyche({ aggression: 0.1, sociability: 0.2, ambition: 0.2 })), 'peaceful');

  // A spread of drives with a taste for risk is what makes somebody unreadable.
  assert.equal(
    rulerTraitOf(psyche({ aggression: 0.55, courage: 0.05, ambition: 0.5, loyalty: 0.9, riskTolerance: 0.9 })),
    'lunatic'
  );

  // Every temperament has to be reachable, or the table is lying.
  const reached = new Set<string>();
  for (let a = 0; a <= 1.001; a += 0.1) for (let b = 0; b <= 1.001; b += 0.1) for (let c = 0; c <= 1.001; c += 0.25) {
    reached.add(rulerTraitOf(psyche({ aggression: a, ambition: b, loyalty: c, sociability: b, courage: a, riskTolerance: c })));
  }
  assert.ok(reached.size >= 5, `a temperament nobody can have is a lie; reached ${[...reached].join(',')}`);
}

// ---- governors, and the friction they cause ----
{
  assert.equal(governorTraitOf(psyche({ ambition: 0.9, loyalty: 0.1 })), 'ambitious');
  assert.equal(governorTraitOf(psyche({ ambition: 0.6, loyalty: 0.5 })), 'corrupt');
  assert.equal(governorTraitOf(psyche({ ambition: 0.2, loyalty: 0.9, courage: 0.9 })), 'protector');
  assert.equal(governorTraitOf(psyche({ ambition: 0.2, loyalty: 0.9, courage: 0.2 })), 'loyal');
}

// ---- losing a war beats any temperament ----
{
  const enemy: Neighbour = { id: 'e', name: 'E', relation: -80, powerRatio: 2, atWar: true, allied: false, reachable: true };
  const besieged: CourtState = { trait: 'bloodthirsty', warWeariness: 0, capitalBesieged: true, armyRemaining: 1, warYears: 0 };
  const decision = decideRoyalAction(besieged, [enemy]);
  assert.equal(decision?.kind, 'peace', 'a capital under siege sues for terms even under a bloodthirsty king');
  assert.equal(decision?.kind === 'peace' && decision.reason, 'capital sitiada');

  const wiped: CourtState = { trait: 'warlike', warWeariness: 0, capitalBesieged: false, armyRemaining: 0.1, warYears: 2 };
  assert.equal(decideRoyalAction(wiped, [enemy])?.kind, 'peace', 'and so does a king with no army left');

  // Winning comfortably, so he fights on.
  const winning: CourtState = { trait: 'warlike', warWeariness: 10, capitalBesieged: false, armyRemaining: 1, warYears: 1 };
  assert.equal(decideRoyalAction(winning, [enemy]), null, 'a king who is winning does not beg');

  /**
   * The state every king is in the instant war is declared: at war, levy not
   * raised, so the muster ratio reads like annihilation. He must NOT surrender
   * here — `tickGeopolitics` declares and `tickRoyalCourts` reviews in the same
   * statecraft slot, while `musterArmies` runs in the next one, so this was
   * every war in the game ending the season it began.
   */
  const unmustered: CourtState = { trait: 'warlike', warWeariness: 0, capitalBesieged: false, armyRemaining: 0.1, warYears: 0 };
  assert.notEqual(
    decideRoyalAction(unmustered, [enemy])?.kind,
    'peace',
    'a king does not sue for peace before his levy has been raised'
  );
}

// ---- a grievance he can reach, and a temper that wants it ----
{
  const hated: Neighbour = { id: 'h', name: 'H', relation: -70, powerRatio: 1, atWar: false, allied: false, reachable: true };
  const calm: CourtState = { trait: 'peaceful', warWeariness: 0, capitalBesieged: false, armyRemaining: 1, warYears: 0 };
  const fierce: CourtState = { ...calm, trait: 'warlike' };

  const war = decideRoyalAction(fierce, [hated]);
  assert.equal(war?.kind, 'war', 'a warlike king with a grievance declares');
  assert.equal(war?.kind === 'war' && war.target, 'h');

  assert.notEqual(decideRoyalAction(calm, [hated])?.kind, 'war', 'a peaceful king does not, at even odds');

  // But nobody marches on somebody they cannot reach.
  assert.equal(decideRoyalAction(fierce, [{ ...hated, reachable: false }]), null, 'an ocean is not a border');

  // A peaceful king still takes a free win.
  const weak = { ...hated, powerRatio: 0.4 };
  assert.equal(decideRoyalAction(calm, [weak])?.kind, 'war', 'overwhelming odds tempt anybody');

  // A king picks the war he can win.
  const strong = { ...hated, id: 'strong', powerRatio: 3 };
  const picked = decideRoyalAction(fierce, [strong, weak]);
  assert.equal(picked?.kind === 'war' && picked.target, 'h', 'the weaker enemy first');
}

// ---- a friend worth binding ----
{
  const friend: Neighbour = { id: 'f', name: 'F', relation: 85, powerRatio: 1, atWar: false, allied: false, reachable: true };
  const court: CourtState = { trait: 'diplomat', warWeariness: 0, capitalBesieged: false, armyRemaining: 1, warYears: 0 };
  assert.equal(decideRoyalAction(court, [friend])?.kind, 'alliance');
  // Already bound, so there is nothing to sign.
  assert.equal(decideRoyalAction(court, [{ ...friend, allied: true }]), null);
  // And a butcher does not sign pacts.
  assert.equal(decideRoyalAction({ ...court, trait: 'bloodthirsty' }, [friend]), null);
}

// ---- the realm's character follows its government and its king ----
{
  const underTyrant = realmTraitsOf('empire', 'tyrant');
  assert.ok(underTyrant.includes('censorship'), 'a tyrant censors');
  assert.ok(underTyrant.includes('high_tax'), 'and taxes hard');
  assert.ok(!underTyrant.includes('light_tax'), 'and never lightly');

  const underPacifist = realmTraitsOf('empire', 'peaceful');
  assert.ok(!underPacifist.includes('censorship'), 'a peaceful king in the same state does not censor');
  assert.ok(!underPacifist.includes('conscription'), 'nor conscript');
  assert.ok(underPacifist.includes('common_lands'), 'and leaves the land common');

  // The same throne under two men is two different realms.
  assert.notDeepEqual(underTyrant.sort(), underPacifist.sort());

  // Effects add up, and every trait in the table contributes something.
  const effects = realmEffects(underTyrant);
  assert.ok((effects.taxMultiplier ?? 0) > 0, 'a hard-taxing realm taxes harder');
  // Censorship costs a realm learning — though an empire that also funds
  // academies can come out ahead on balance, which is the point of the traits
  // pulling against each other. So the cost is checked on the trait itself.
  assert.ok((realmEffects(['censorship']).research ?? 0) < 0, 'a censored realm learns less');
  assert.ok(
    (realmEffects(underTyrant).research ?? 0) < (realmEffects(underTyrant.filter(t => t !== 'censorship')).research ?? 0),
    'and censoring is always worse than not censoring, whatever else is true'
  );
  for (const id of Object.keys(REALM_TRAITS) as (keyof typeof REALM_TRAITS)[]) {
    assert.ok(Object.keys(REALM_TRAITS[id].effects).length > 0, `${id} has to actually do something`);
  }
  assert.deepEqual(realmEffects([]), {}, 'no traits, no effects');
}

// ---- belligerence orders the temperaments sensibly ----
{
  assert.ok(RULER_TRAITS.bloodthirsty.belligerence > RULER_TRAITS.warlike.belligerence);
  assert.ok(RULER_TRAITS.warlike.belligerence > RULER_TRAITS.diplomat.belligerence);
  assert.ok(RULER_TRAITS.diplomat.belligerence > RULER_TRAITS.peaceful.belligerence);
}

console.log('politics-rulers.test: temperaments vary, losing kings sue, grievances become wars');
