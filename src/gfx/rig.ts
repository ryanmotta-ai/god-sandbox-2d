/**
 * Humanoid skeleton: proportions, 2-bone IK and the gait/action curves.
 *
 * Motion is authored in body space — f = forward, l = lateral, h = height above ground — and projected
 * into the three drawn views (front S, back N, side W; E is W mirrored). Feet and hands follow real
 * trajectories and IK finds the knees and elbows, so a stride has weight instead of sliding sprites.
 */
export type View = 'S' | 'N' | 'W';
export type Anim = 'idle' | 'walk' | 'run' | 'chop' | 'mine' | 'farm' | 'hammer' | 'attack' | 'shoot' | 'cast' | 'carry' | 'die' | 'sleep';

export const ANIM_FRAMES: Record<Anim, number> = { idle: 4, walk: 6, run: 6, chop: 6, mine: 6, farm: 6, hammer: 6, attack: 6, shoot: 6, cast: 4, carry: 6, die: 6, sleep: 2 };

export interface Build {
  legLen: number; torsoH: number; torsoW: number; headR: number; armLen: number; shoulderW: number; limbW: number; hunch: number; scale: number;
}
export const BUILDS: Record<string, Build> = {
  human: { legLen: 11, torsoH: 9, torsoW: 8, headR: 4, armLen: 9, shoulderW: 9, limbW: 3, hunch: 0, scale: 1 },
  elf: { legLen: 11, torsoH: 8, torsoW: 7, headR: 3.8, armLen: 9.5, shoulderW: 8, limbW: 2.6, hunch: 0, scale: 1 },
  dwarf: { legLen: 6.5, torsoH: 8.5, torsoW: 10, headR: 4.4, armLen: 8, shoulderW: 12, limbW: 3.6, hunch: 0.5, scale: 1 },
  orc: { legLen: 10, torsoH: 9, torsoW: 11, headR: 3.9, armLen: 10.5, shoulderW: 13, limbW: 4, hunch: 1.2, scale: 1 },
};
export const childBuild = (b: Build): Build => ({ ...b, legLen: b.legLen * 0.62, torsoH: b.torsoH * 0.75, torsoW: b.torsoW * 0.78, armLen: b.armLen * 0.7, headR: b.headR * 1.0, shoulderW: b.shoulderW * 0.78, limbW: b.limbW * 0.85 });

export type V2 = [number, number];
export interface Pose {
  /** Body offset in screen px (bob / lunge). */
  dx: number; dy: number;
  /** Shoulders shifted forward (+) or back (−) in body space, px. */
  lean: number;
  crouch: number;
  /** Targets in (f, l, h): feet relative to the hip; hands relative to the shoulder. */
  footL: [number, number, number]; footR: [number, number, number];
  handL: [number, number, number]; handR: [number, number, number];
  /** Weapon/tool angle in radians, 0 = up, positive swings toward the facing direction. */
  weapon: number;
  headDy: number; headDx: number;
  /** 0 standing … 1 fully fallen (die). */
  fall: number;
  blink: boolean;
  glow: number;
}

export function proj(view: View, f: number, l: number, h: number): V2 {
  if (view === 'W') return [-f, -h];
  if (view === 'S') return [l, f * 0.55 - h];
  return [l, -f * 0.55 - h];
}

/** Two-bone IK in 2D. `bend` = +1 / −1 picks which side the middle joint falls on. */
export function ik2(rx: number, ry: number, tx: number, ty: number, a: number, b: number, bend: number): V2 {
  let dx = tx - rx, dy = ty - ry, d = Math.hypot(dx, dy);
  const max = a + b - 0.05;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  if (d < 0.5) d = 0.5;
  const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
  const ang = Math.acos(cosA) * bend, base = Math.atan2(dy, dx);
  return [rx + Math.cos(base + ang) * a, ry + Math.sin(base + ang) * a];
}

const TAU = Math.PI * 2;
const ease = (t: number): number => t * t * (3 - 2 * t);

/** Foot trajectory over one stride for a leg whose phase is p ∈ [0,1): stance slides back, swing lifts and carries forward. */
function gaitFoot(p: number, stride: number, lift: number): [number, number] {
  p = ((p % 1) + 1) % 1;
  if (p < 0.5) return [stride * (1 - p * 4), 0];
  const q = (p - 0.5) * 2;
  return [-stride + 2 * stride * ease(q), Math.sin(Math.PI * q) * lift];
}

const zero = (): Pose => ({
  dx: 0, dy: 0, lean: 0, crouch: 0, footL: [0, -1.2, 0], footR: [0, 1.2, 0], handL: [0, -1, -8], handR: [0, 1, -8], weapon: 0.35,
  headDy: 0, headDx: 0, fall: 0, blink: false, glow: 0,
});

/** Pose for `anim` at frame `i` of N. `view` matters only for how much a stride reads on screen. */
export function poseFor(anim: Anim, i: number, view: View, b: Build): Pose {
  const n = ANIM_FRAMES[anim], t = i / n, p = zero();
  const side = view === 'W';
  switch (anim) {
    case 'idle': {
      const br = Math.sin(t * TAU);
      p.dy = br > 0.3 ? -0.5 : 0; p.headDy = br > 0.5 ? -0.5 : 0; p.handL[2] = -8 + (br > 0.5 ? 0.5 : 0); p.handR[2] = -8 + (br > 0.5 ? 0.5 : 0);
      p.blink = i === 3; p.footL = [0, -1.4, 0]; p.footR = [0, 1.4, 0];
      if (side) { p.footL = [1.2, 0, 0]; p.footR = [-1.2, 0, 0]; }
      break;
    }
    case 'walk': case 'run': case 'carry': {
      const run = anim === 'run', stride = (run ? 6.5 : 4.4) * (side ? 1 : 0.8) * (b.legLen / 10 * 0.5 + 0.5), lift = run ? 4.2 : 2.6;
      const fl = gaitFoot(t, stride, lift), fr = gaitFoot(t + 0.5, stride, lift);
      p.footL = [fl[0], -1.4, fl[1]]; p.footR = [fr[0], 1.4, fr[1]];
      p.dy = -Math.abs(Math.cos(t * TAU)) * (run ? 1.8 : 1.1) + 0.6; // lowest at heel strike, highest mid-stance
      p.lean = run ? 1.8 : 0.4 + b.hunch;
      if (anim === 'carry') { p.handL = [3, -2, -6]; p.handR = [3, 2, -6]; p.lean = 0.2; }
      else {
        const a = (run ? 5.5 : 3.2) * (side ? 1 : 0.6);
        p.handL = [-fr[0] * a / stride, -1.2, -8 + (run ? 2.2 : 0.4) + (fr[1] > 0 ? 0 : 0)]; p.handR = [-fl[0] * a / stride, 1.2, -8 + (run ? 2.2 : 0.4)];
        if (run) { p.handL[2] += 1.6; p.handR[2] += 1.6; }
      }
      break;
    }
    case 'chop': case 'mine': case 'hammer': case 'farm': {
      // raise tool (0–.4), strike (.4–.6), recover. Both hands grip.
      const up = t < 0.4 ? ease(t / 0.4) : t < 0.6 ? 1 - ease((t - 0.4) / 0.2) : ease((t - 0.6) / 0.4) * 0; // 0..1 raised
      const swing = t < 0.4 ? -1.9 * ease(t / 0.4) : t < 0.6 ? -1.9 + 2.9 * ease((t - 0.4) / 0.2) : 1 - ease((t - 0.6) / 0.4) * 1.0;
      p.weapon = swing; p.lean = up * -1.2 + (t >= 0.4 && t < 0.7 ? 2 : 0);
      p.crouch = t >= 0.45 && t < 0.7 ? 1.5 : 0;
      p.footL = [1.5, -2.2, 0]; p.footR = [-1.5, 2.2, 0];
      p.handR = [2 + (t >= 0.4 && t < 0.7 ? 3 : 0), 2.5, -9 + up * 5 - (t >= 0.4 && t < 0.7 ? 3 : 0)];
      p.handL = [p.handR[0] - 1, -1, p.handR[2] + 1.5];
      p.dx = 0;
      break;
    }
    case 'attack': {
      // wind-up (0–.35) → strike (.35–.55) → recover. A lunge steps the front foot forward.
      const wind = t < 0.35 ? ease(t / 0.35) : 0, strike = t >= 0.35 && t < 0.55 ? ease((t - 0.35) / 0.2) : t >= 0.55 ? 1 - ease((t - 0.55) / 0.45) : 0;
      p.weapon = t < 0.35 ? -1.8 * wind : t < 0.55 ? -1.8 + 3.3 * strike : 0.2 + 1.3 * strike;
      p.lean = -1.5 * wind + 3.2 * strike; p.crouch = 1 + strike;
      p.footL = [-2 - strike, -2.4, 0]; p.footR = [3 + strike * 2, 2.4, 0];
      p.handR = [1 + 5 * strike - 2 * wind, 2.5, -9 + 5 * wind - 4 * strike];
      p.handL = [-2 + 2 * strike, -2, -6 + 3 * wind - 2 * strike];
      break;
    }
    case 'shoot': {
      const draw = t < 0.55 ? ease(t / 0.55) : 0, rel = t >= 0.55 ? Math.max(0, 1 - (t - 0.55) / 0.15) : 1;
      p.footL = [1.5, -2.4, 0]; p.footR = [-2, 2.4, 0];
      p.handL = [8, -2, -9]; p.handR = [8 - 6 * (t < 0.55 ? draw : rel), 2, -9];
      p.weapon = 0; p.lean = -0.5;
      break;
    }
    case 'cast': {
      const up = Math.sin(t * Math.PI * 0.5 + 0.2);
      p.handL = [3, -3, -4 + 8 * up]; p.handR = [3, 3, -4 + 8 * up]; p.glow = 0.4 + 0.6 * Math.abs(Math.sin(t * Math.PI));
      p.footL = [0, -2, 0]; p.footR = [0, 2, 0]; p.dy = -up; p.headDy = -0.5;
      break;
    }
    case 'sleep': { p.fall = 1; p.blink = true; break; }
    case 'die': {
      const k = i / (n - 1);
      p.fall = k < 0.2 ? 0 : (k - 0.2) / 0.8;
      p.lean = -2 * Math.min(1, k * 4); p.crouch = 3 * Math.min(1, k * 2.5); p.dy = k * 1.5;
      p.handL = [-2, -3, -5]; p.handR = [-2, 3, -5]; p.blink = k > 0.5; p.headDy = k * 1.5;
      p.footL = [-1, -2, 0]; p.footR = [1, 2, 0];
      break;
    }
  }
  return p;
}
