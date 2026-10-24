import { Pix, toPacked } from './pix';
import { ramp, hex, type RGB } from './color';
import { BUILDS, childBuild, ik2, poseFor, proj, ANIM_FRAMES, type Anim, type View, type Pose, type Build } from './rig';

export type Race = 'human' | 'elf' | 'dwarf' | 'orc';
export type WeaponKind = 'none' | 'sword' | 'spear' | 'axe' | 'bow' | 'pickaxe' | 'hoe' | 'hammer' | 'club' | 'staff' | 'torch';

export interface Look {
  race: Race;
  age: 'child' | 'adult';
  female: boolean;
  skin: string; hair: string;
  hairStyle: 0 | 1 | 2 | 3 | 4; // short, long, bald, ponytail, bun
  beard: 0 | 1 | 2;               // none, stubble/short, full
  cloth: string; cloth2: string; boots: string;
  /** 0 none, 1 leather, 2 chain, 3 plate */
  armor: 0 | 1 | 2 | 3;
  /** 0 none, 1 cap, 2 iron helm, 3 crown, 4 hood, 5 straw hat */
  helm: 0 | 1 | 2 | 3 | 4 | 5;
  cape: string | null;
  shield: string | null;
  weapon: WeaponKind;
  longSleeves: boolean;
}

export const keyOf = (l: Look): string => [l.race, l.age, l.female ? 1 : 0, l.skin, l.hair, l.hairStyle, l.beard, l.cloth, l.cloth2, l.boots, l.armor, l.helm, l.cape ?? '-', l.shield ?? '-', l.weapon, l.longSleeves ? 1 : 0].join('|');

export const SPR_W = 40, SPR_H = 46, CX = 20, GROUND = 42;

const rampCache = new Map<string, number[]>();
const R = (c: string, n = 5): number[] => {
  const k = c + n;
  let v = rampCache.get(k);
  if (!v) { v = toPacked(ramp(c, n)); rampCache.set(k, v); }
  return v;
};
const STEEL = (): number[] => R('#8e99a8', 5), GOLD = (): number[] => R('#d9a830', 5), WOOD = (): number[] => R('#8a5a34', 4), IRON = (): number[] => R('#4a5260', 5);
const col = (h: string): number => toPacked([hex(h)])[0];

/** Draw one frame of one humanoid. East-facing is the west-facing frame mirrored by the caller. */
export function drawHumanoid(look: Look, anim: Anim, view: View, frame: number): Pix {
  const base = BUILDS[look.race], b: Build = look.age === 'child' ? childBuild(base) : base;
  const pose = poseFor(anim, frame % ANIM_FRAMES[anim], view, b);
  const out = new Pix(SPR_W, SPR_H);
  const skin = R(look.skin), hair = R(look.hair), cloth = R(look.cloth), pants = R(look.cloth2), boots = R(look.boots, 4);
  const side = view === 'W', back = view === 'N';
  const feet = 1.6;
  const hipY = GROUND - b.legLen - feet + pose.crouch * 0.7;
  const shY = hipY - b.torsoH;
  const [lx, ly] = proj(view, pose.lean, 0, 0);
  const sx = CX + pose.dx + lx, sy = shY + pose.dy + ly * 0.3 + pose.crouch * 0.3;
  const hx = CX + pose.dx + lx * 0.4, hyp = hipY + pose.dy * 0.6;
  const hw = side ? b.torsoW * 0.62 : b.torsoW;

  // -- cape behind the body (front/side views)
  const capeCol = look.cape ? R(look.cape) : null;
  if (capeCol && !back) {
    const flut = anim === 'walk' || anim === 'run' ? Math.sin(frame / 6 * Math.PI * 2) * 1.5 : 0;
    out.poly([[sx - hw / 2 - 0.5, sy], [sx + hw / 2 + 0.5, sy], [hx + hw / 2 + 1 + flut + (side ? 3 : 0), hyp + 8], [hx - hw / 2 - 1 + flut + (side ? 3 : 0), hyp + 8]],
      (x, y) => capeCol[Math.max(0, Math.min(4, Math.round(((x - (sx - hw / 2)) / hw) * 2 + (y - sy) / 12 * 1.2 + (((x + y) & 1) ? 0.2 : 0))))]);
  }

  // -- legs
  const legW = b.limbW;
  const hipOff = side ? [0.6, -0.6] : [-b.torsoW / 4 - 0.2, b.torsoW / 4 + 0.2];
  const legs: { hipX: number; foot: [number, number, number] }[] = [
    { hipX: hx + hipOff[0], foot: pose.footL }, { hipX: hx + hipOff[1], foot: pose.footR },
  ];
  // far leg first: in side view the "left" foot is behind
  const half = (b.legLen - 1) / 2 + 0.2;
  for (let i = 0; i < 2; i++) {
    const L = legs[i];
    const [fx, fy] = proj(view, L.foot[0], L.foot[1], L.foot[2]);
    const ax = L.hipX + (side ? fx : L.foot[1] * 0.18 + fx * 0.3), ay = GROUND - feet + fy;
    const bendDir = side ? -1 : 1;
    const [kx, ky] = ik2(L.hipX, hyp, ax, ay, half, half, side ? bendDir : 0.0001 + (i ? -0.15 : 0.15));
    // pants colour — the far leg sits in shade
    const pr = i === 0 && side ? pants.map((c, k) => pants[Math.max(0, k - 1)]) : pants;
    out.limb(L.hipX, hyp, kx, ky, legW + 0.6, legW, pr);
    out.limb(kx, ky, ax, ay, legW, legW - 0.6, pr);
    // boot, toe pointing the way we face
    const toe = side ? -1.8 : 0;
    out.rect(Math.round(ax - 1.5 + (side ? -0.5 : 0)), Math.round(ay - 1), 4, 3, boots[2]);
    out.rect(Math.round(ax - 1.5 + (side ? -0.5 : 0)), Math.round(ay - 1), 4, 1, boots[3]);
    out.rect(Math.round(ax - 1.5 + (side ? -0.5 : 0)), Math.round(ay + 1), 4, 1, boots[0]);
    if (side) out.rect(Math.round(ax + toe), Math.round(ay), 2, 2, boots[2]);
    out.rect(Math.round(ax - 1.5 + (side ? 1 : 0)), Math.round(ay - 2), 3, 1, boots[3]); // cuff
  }

  // -- far arm in side view sits behind the torso
  const sw = side ? 1.2 : b.shoulderW / 2 - 1;
  const armLen = b.armLen / 2;
  const sleeve = look.armor >= 2 ? R('#a0a8b6') : cloth;
  const forearm = look.longSleeves || look.armor >= 1 ? (look.armor >= 2 ? R('#7a8494') : cloth) : skin;
  const handTarget = (h: [number, number, number], i: number): [number, number] => {
    const [fx, fy] = proj(view, h[0], h[1], h[2]);
    const shx = side ? sx + (i === 0 ? 0.8 : -0.6) : sx + (i === 0 ? -sw : sw);
    return [shx + fx + (side ? 0 : h[1] * 0.08), sy + 1.5 + fy];
  };
  const drawArm = (i: 0 | 1, shaded: boolean): [number, number] => {
    const h = i === 0 ? pose.handL : pose.handR;
    const shx = side ? sx + (i === 0 ? 0.8 : -0.6) : sx + (i === 0 ? -sw : sw), shy = sy + 1.6;
    const [tx, ty] = handTarget(h, i);
    const [ex, ey] = ik2(shx, shy, tx, ty, armLen + 0.2, armLen + 0.2, side ? 1 : (i === 0 ? -1 : 1) * 0.6);
    const sl = shaded ? sleeve.map((_, k) => sleeve[Math.max(0, k - 1)]) : sleeve;
    const fa = shaded ? forearm.map((_, k) => forearm[Math.max(0, k - 1)]) : forearm;
    out.limb(shx, shy, ex, ey, b.limbW * 0.85 + 0.4, b.limbW * 0.8, sl);
    out.limb(ex, ey, tx, ty, b.limbW * 0.8, b.limbW * 0.65, fa);
    out.ellipse(tx, ty, 1.3, 1.3, skin[2]); out.set(tx - 1, ty - 1, skin[3]);
    return [tx, ty];
  };
  let farHand: [number, number] | null = null;
  if (side) farHand = drawArm(0, true);

  // -- torso
  const topW = side ? hw : b.torsoW + 1, botW = side ? hw * 0.9 : b.torsoW - 1;
  const bodyRamp = look.armor >= 2 ? R(look.armor === 3 ? '#9aa4b4' : '#7d8794') : look.armor === 1 ? R('#6b4a30') : cloth;
  out.poly([[sx - topW / 2, sy], [sx + topW / 2, sy], [hx + botW / 2, hyp + 1], [hx - botW / 2, hyp + 1]], (x, y) => {
    const f = (x - (hx - botW / 2)) / Math.max(1, botW) ;
    const idx = Math.round((1 - Math.min(1, Math.max(0, f))) * 3.2 + ((y - sy) / b.torsoH) * -0.4 + (((x + y) & 1) ? 0.35 : -0.15));
    return bodyRamp[Math.max(0, Math.min(4, idx))];
  });
  // tunic hem flare over the legs
  const hem = look.cloth2 === look.cloth ? 0 : 1;
  out.rect(Math.round(hx - botW / 2 - 0.5), Math.round(hyp + 1), Math.round(botW + 1), 2, cloth[1]);
  out.rect(Math.round(hx - botW / 2 - 0.5), Math.round(hyp + 1), Math.round(botW + 1), 1, cloth[2]);
  void hem;
  // belt
  out.rect(Math.round(hx - botW / 2), Math.round(hyp - 1), Math.round(botW), 1, col('#3a2616'));
  if (view === 'S') { out.set(hx, hyp - 1, col('#d8b24a')); }
  // armour trims & tabard
  if (look.armor >= 2) {
    out.rect(Math.round(sx - topW / 2), Math.round(sy), Math.round(topW), 1, STEEL()[4]);
    if (view === 'S' && look.shield) { const tb = R(look.shield); out.rect(Math.round(sx - 1), Math.round(sy + 1), 2, Math.round(b.torsoH - 1), tb[2]); out.rect(Math.round(sx - 1), Math.round(sy + 1), 1, Math.round(b.torsoH - 1), tb[3]); }
  } else if (view === 'S') {
    out.set(sx, sy + 1, cloth[0]); out.set(sx, sy + 2, cloth[0]); // collar lace
  }
  // neck
  out.rect(Math.round(sx - 1), Math.round(sy - 1), 2, 2, skin[1]);

  // -- head
  const hr = b.headR, hcx = sx + pose.headDx + (side ? -0.4 : 0), hcy = sy - hr + 0.6 + pose.headDy;
  const faceAway = back;
  // back hair (long) behind head/torso for S & side
  const hairR = hair;
  if (look.hairStyle === 1 && !back) out.rect(Math.round(hcx - hr + (side ? 2 : 0)), Math.round(hcy), Math.round(hr * 2 - (side ? 2 : 0)), Math.round(hr + 3), hairR[1]);
  out.blob(hcx, hcy, hr, hr * 1.04, skin, { bias: 0.05 });
  // helmet / hair shapes
  const topHair = (extra = 0) => out.blob(hcx, hcy - 0.3, hr + 0.3, hr * 1.04, hairR, { bias: 0.05, only: (x, y) => faceAway ? y <= hcy + hr * 0.45 : side ? (y < hcy - hr * 0.1 + extra || x > hcx + hr * 0.15) : y < hcy - hr * 0.22 + extra || (Math.abs(x + 0.5 - hcx) > hr * 0.75 && y < hcy + hr * 0.4) });
  if (look.helm === 4) { // hood
    out.blob(hcx, hcy - 0.2, hr + 0.8, hr * 1.1, cloth, { only: (x, y) => y < hcy + hr * 0.5 && (faceAway || side ? true : (y < hcy - hr * 0.1 || Math.abs(x + 0.5 - hcx) > hr * 0.62)) });
  } else if (look.hairStyle !== 2 && look.helm !== 2 && look.helm !== 5) topHair();
  // face
  if (!faceAway) {
    const eyeY = Math.round(hcy + hr * 0.12), dark = col('#1c1420'), eyeW = col('#e8e4dc');
    if (view === 'S') {
      const ex = [Math.round(hcx - 1.7), Math.round(hcx + 1.2)];
      if (pose.blink) { out.set(ex[0], eyeY, skin[0]); out.set(ex[1], eyeY, skin[0]); }
      else for (const x of ex) { out.set(x, eyeY, dark); if (look.race === 'elf') out.set(x, eyeY - 1, hairR[0]); }
      if (look.race === 'orc') { out.set(ex[0] - 1, eyeY - 1, dark); out.set(ex[1] + 1, eyeY - 1, dark); out.set(ex[0], eyeY + 3, eyeW); out.set(ex[1], eyeY + 3, eyeW); out.set(ex[0], eyeY + 2, dark); out.set(ex[1], eyeY + 2, dark); }
      else if (look.female) { out.set(ex[0], eyeY - 1, dark); out.set(ex[1], eyeY - 1, dark); out.set(Math.round(hcx - 0.3), eyeY + 2, col('#c0566a')); }
      else out.set(Math.round(hcx - 0.3), eyeY + 2, skin[0]);
      out.set(Math.round(hcx - 0.3), eyeY + 1, skin[3]); // nose
    } else {
      const ex = Math.round(hcx - hr * 0.5);
      if (pose.blink) out.set(ex, eyeY, skin[0]); else { out.set(ex, eyeY, dark); out.set(ex + 1, eyeY, eyeW); }
      out.set(Math.round(hcx - hr - 0.2), eyeY + 1, skin[3]); out.set(Math.round(hcx - hr + 0.8), eyeY + 1, skin[2]); // nose
      out.set(Math.round(hcx - hr * 0.6), eyeY + 2, skin[0]);
      if (look.race === 'orc') { out.set(Math.round(hcx - hr * 0.7), eyeY + 3, eyeW); }
      out.set(Math.round(hcx + hr * 0.45), eyeY + 1, skin[1]); // ear
    }
    if (look.race === 'elf') { // long pointed ears
      if (view === 'S') { out.set(Math.round(hcx - hr - 1), Math.round(hcy - 1), skin[2]); out.set(Math.round(hcx - hr - 2), Math.round(hcy - 2), skin[3]); out.set(Math.round(hcx + hr), Math.round(hcy - 1), skin[1]); out.set(Math.round(hcx + hr + 1), Math.round(hcy - 2), skin[2]); }
      else { out.set(Math.round(hcx + hr * 0.5 + 1), Math.round(hcy - 1), skin[2]); out.set(Math.round(hcx + hr * 0.5 + 2), Math.round(hcy - 2), skin[3]); }
    }
    if (look.beard) {
      const bd = look.race === 'dwarf' ? 5 : look.beard === 2 ? 4 : 2;
      out.blob(hcx - (side ? hr * 0.35 : 0), hcy + hr * 0.62, hr * (side ? 0.62 : 0.95), bd, hairR, { bias: 0.1, only: (x, y) => y > hcy + hr * 0.25 && (side ? x < hcx + 0.5 : true) });
      if (view === 'S') out.rect(Math.round(hcx - 1.5), Math.round(hcy + hr * 0.38), 3, 1, hairR[2]); // moustache
    }
  } else if (look.hairStyle !== 2 && !look.helm) topHair(hr * 0.4);
  if (look.hairStyle === 3) { const pr = faceAway || side ? 0 : 1; if (pr === 0) { const bx = side ? hcx + hr : hcx; out.limb(bx, hcy - 1, bx + (side ? 3 : 0), hcy + 4 + Math.sin(frame) * 0.6, 2, 1.4, hairR); } }
  if (look.hairStyle === 4) out.blob(hcx, hcy - hr - 0.4, 2.2, 2, hairR);
  // helm over everything
  if (look.helm === 1) out.blob(hcx, hcy - 0.6, hr + 0.4, hr * 0.9, R(look.cloth2), { only: (x, y) => y < hcy - hr * 0.1 });
  if (look.helm === 2) {
    out.blob(hcx, hcy - 0.5, hr + 0.8, hr + 0.4, IRON().map((_, i) => STEEL()[i]), { only: (x, y) => y < hcy - hr * 0.1 });
    out.rect(Math.round(hcx - hr - 0.5), Math.round(hcy - hr * 0.2), Math.round(hr * 2 + 1), 1, IRON()[1]); // brim
    if (view === 'S') out.rect(Math.round(hcx - 0.5), Math.round(hcy - hr * 0.2), 1, 4, STEEL()[3]); // nasal
    if (look.race === 'orc') { out.set(Math.round(hcx - hr - 0.5), Math.round(hcy - hr + 1), STEEL()[4]); out.set(Math.round(hcx + hr + 0.5), Math.round(hcy - hr + 1), STEEL()[4]); }
  }
  if (look.helm === 3) { // crown
    const g = GOLD(), cy0 = Math.round(hcy - hr - 0.2);
    out.rect(Math.round(hcx - hr + 0.8), cy0, Math.round(hr * 2 - 1.6), 2, g[2]); out.rect(Math.round(hcx - hr + 0.8), cy0, Math.round(hr * 2 - 1.6), 1, g[4]);
    for (const d of [-hr + 1, 0, hr - 2]) { out.set(Math.round(hcx + d), cy0 - 1, g[3]); }
    out.set(Math.round(hcx), cy0 + 1, col('#c0243a'));
  }
  if (look.helm === 5) { // straw hat
    const sh = R('#d8b25a');
    out.blob(hcx, hcy - hr * 0.3, hr + 3.2, 2.2, sh, { dither: 0.6 });
    out.blob(hcx, hcy - hr * 0.9, hr * 0.8, hr * 0.8, sh, { only: (x, y) => y < hcy - hr * 0.3 });
    out.rect(Math.round(hcx - hr * 0.7), Math.round(hcy - hr * 0.5), Math.round(hr * 1.4), 1, col('#8a5a34'));
  }

  // -- near arm (+ far arm in S/N views), weapon, shield
  let nearHand: [number, number];
  if (!side) { farHand = drawArm(0, false); }
  nearHand = drawArm(1, false);
  void farHand;
  drawWeaponAndShield(out, look, pose, view, nearHand, farHand ?? nearHand, frame, anim);

  if (capeCol && back) { // cape over the back
    out.poly([[sx - hw / 2 - 0.5, sy], [sx + hw / 2 + 0.5, sy], [hx + hw / 2 + 1, hyp + 9], [hx - hw / 2 - 1, hyp + 9]],
      (x, y) => capeCol[Math.max(0, Math.min(4, Math.round(((x - (sx - hw / 2)) / hw) * 2 + (y - sy) / 12 * 1.2 + (((x + y) & 1) ? 0.2 : 0))))]);
  }
  out.outline(0.6);
  return pose.fall > 0.02 ? fallOver(out, pose.fall) : out;
}

/** Tip the standing sprite over: used by `die` and `sleep`. Nearest-neighbour rotation about the hips. */
function fallOver(src: Pix, k: number): Pix {
  const out = new Pix(SPR_W, SPR_H), ang = k * Math.PI * 0.5 * 0.96;
  const cs = Math.cos(ang), sn = Math.sin(ang), sxp = CX, syp = GROUND - 12, dxp = CX + 2 * k, dyp = GROUND - 12 + 7.5 * k;
  for (let y = 0; y < SPR_H; y++) for (let x = 0; x < SPR_W; x++) {
    const rx = x + 0.5 - dxp, ry = y + 0.5 - dyp;
    const ox = Math.round(rx * cs + ry * sn + sxp - 0.5), oy = Math.round(-rx * sn + ry * cs + syp - 0.5);
    const c = src.get(ox, oy);
    if (c >>> 24) out.data[y * SPR_W + x] = c;
  }
  return out;
}

function drawWeaponAndShield(out: Pix, look: Look, pose: Pose, view: View, hand: [number, number], off: [number, number], frame: number, anim: Anim): void {
  const side = view === 'W', [hx, hy] = hand;
  // screen angle of the weapon axis
  const a = view === 'W' ? -pose.weapon : view === 'S' ? pose.weapon * 0.35 + 0.3 : -pose.weapon * 0.35 - 0.3;
  const dir: [number, number] = [Math.sin(a), -Math.cos(a)];
  const steel = STEEL(), wood = WOOD(), iron = IRON();
  const at = (d: number): [number, number] => [hx + dir[0] * d, hy + dir[1] * d];
  const grip = () => { out.ellipse(hx, hy, 1.4, 1.4, R(look.skin)[2]); };
  switch (look.weapon) {
    case 'sword': { const t = at(12), g = at(1); out.limb(g[0], g[1], t[0], t[1], 2.2, 1.2, steel); out.set(Math.round(t[0] - dir[0] * 0), Math.round(t[1]), steel[4]);
      const gp = at(0.2); out.line(gp[0] - dir[1] * 2, gp[1] + dir[0] * 2, gp[0] + dir[1] * 2, gp[1] - dir[0] * 2, GOLD()[3]); const pm = at(-2.2); out.limb(hx, hy, pm[0], pm[1], 1.4, 1.4, R('#5a3a22', 4)); grip(); break; }
    case 'spear': { const t = at(19), b0 = at(-9); out.limb(b0[0], b0[1], t[0], t[1], 1.4, 1.2, wood); const hd = at(23); out.limb(t[0], t[1], hd[0], hd[1], 2.8, 0.8, steel); grip(); break; }
    case 'axe': { const t = at(11), b0 = at(-3); out.limb(b0[0], b0[1], t[0], t[1], 1.5, 1.5, wood); const c = at(10); const n: [number, number] = [-dir[1], dir[0]]; out.poly([[c[0], c[1]], [c[0] + n[0] * 5 + dir[0] * 2, c[1] + n[1] * 5 + dir[1] * 2], [c[0] + n[0] * 5 - dir[0] * 3, c[1] + n[1] * 5 - dir[1] * 3], [c[0] - dir[0] * 3, c[1] - dir[1] * 3]], (x, y) => steel[(x + y) & 1 ? 3 : 2]); grip(); break; }
    case 'pickaxe': { const t = at(12), b0 = at(-3); out.limb(b0[0], b0[1], t[0], t[1], 1.5, 1.5, wood); const n: [number, number] = [-dir[1], dir[0]]; out.limb(t[0] - n[0] * 5, t[1] - n[1] * 5 + 1, t[0] + n[0] * 5, t[1] + n[1] * 5 + 1, 1.6, 1.6, iron.map((_, i) => steel[i])); grip(); break; }
    case 'hoe': { const t = at(14), b0 = at(-3); out.limb(b0[0], b0[1], t[0], t[1], 1.4, 1.4, wood); const n: [number, number] = [-dir[1], dir[0]]; out.limb(t[0], t[1], t[0] + n[0] * 4, t[1] + n[1] * 4 + 2, 1.6, 2.6, steel); grip(); break; }
    case 'hammer': { const t = at(10), b0 = at(-2); out.limb(b0[0], b0[1], t[0], t[1], 1.5, 1.5, wood); const n: [number, number] = [-dir[1], dir[0]]; out.limb(t[0] - n[0] * 3, t[1] - n[1] * 3, t[0] + n[0] * 3, t[1] + n[1] * 3, 4, 4, iron); grip(); break; }
    case 'club': { const t = at(11), b0 = at(-1); out.limb(b0[0], b0[1], t[0], t[1], 1.4, 3.6, wood); grip(); break; }
    case 'staff': { const t = at(17), b0 = at(-8); out.limb(b0[0], b0[1], t[0], t[1], 1.4, 1.4, wood); out.blob(t[0], t[1] - 1, 2.2, 2.2, R('#6ad0ff'), { dither: 0.3 }); if (pose.glow) out.ellipse(t[0], t[1] - 1, 3.2, 3.2, 0); grip(); break; }
    case 'torch': { const t = at(8); out.limb(hx, hy, t[0], t[1], 1.6, 1.6, wood); const fl = frame % 3; out.blob(t[0], t[1] - 2, 2.2, 3, R('#f08a1c'), { dither: 0.4 }); out.set(Math.round(t[0] + (fl - 1)), Math.round(t[1] - 4), col('#ffe08a')); out.set(Math.round(t[0]), Math.round(t[1] - 2), col('#fff6c8')); grip(); break; }
    case 'bow': {
      const [bx, by] = off, draw = anim === 'shoot' ? (frame / 6 < 0.55 ? frame / 6 / 0.55 : 0) : 0;
      const bcx = bx, bcy = by - 1, h = 8, bow = WOOD();
      const sgn = side ? -1 : 1;
      for (let i = -h; i <= h; i++) { const x = bcx + sgn * (Math.cos((i / h) * 1.2) * 2.2 - 1.6) * (side ? 1 : 0.4) + (side ? 0 : 0), y = bcy + i; out.set(Math.round(x), Math.round(y), bow[(i + h) % 3 === 0 ? 3 : 2]); }
      const sx2 = bcx + sgn * (side ? -1.6 + 0 : 0) + sgn * draw * 5 * (side ? 1 : 0);
      out.line(bcx + sgn * (side ? 0.5 : 0), bcy - h, sx2 + sgn * 0, bcy, col('#e8e0c8')); out.line(sx2, bcy, bcx + sgn * (side ? 0.5 : 0), bcy + h, col('#e8e0c8'));
      if (draw > 0.1) out.line(sx2, bcy, bcx - sgn * 5, bcy, col('#b8a070'));
      grip(); out.ellipse(bx, by, 1.3, 1.3, R(look.skin)[2]); break;
    }
    default: break;
  }
  if (look.shield && look.weapon !== 'bow' && look.weapon !== 'staff') {
    const sh = R(look.shield), [ox, oy] = off, wd = side ? 3 : 6, ht = 8;
    out.blob(ox + (side ? 1 : -1), oy + 1, wd / 2 + (side ? 0.4 : 1), ht / 2, sh, { dither: 0.5 });
    if (!side) { out.rect(Math.round(ox - 1), Math.round(oy - 2), 1, 6, STEEL()[3]); out.set(Math.round(ox - 1), Math.round(oy + 1), GOLD()[4]); }
    out.set(Math.round(ox + (side ? 1 : -1)), Math.round(oy + 1), STEEL()[4]); // boss
  }
}

/* ---- cache ------------------------------------------------------------------------------------- */
const cache = new Map<string, HTMLCanvasElement>();
/** Canvas for one frame; east-facing reuses the mirrored west frame. */
export function humanoidFrame(look: Look, anim: Anim, dir: 'N' | 'E' | 'S' | 'W', frame: number): HTMLCanvasElement {
  const k = keyOf(look) + '#' + anim + dir + frame;
  let c = cache.get(k);
  if (!c) {
    const p = dir === 'E' ? drawHumanoid(look, anim, 'W', frame).flipH() : drawHumanoid(look, anim, dir === 'W' ? 'W' : dir, frame);
    c = p.toCanvas(); cache.set(k, c);
  }
  return c;
}
export type { RGB };
