/** Scale contract: one tile is 32×32 source pixels. Sprites are authored 1:1; zoom is integer. */
export const TILE = 32;
/** Fixed simulation rate. Rendering is decoupled and interpolates. */
export const TICK_HZ = 20;
export const TICK_DT = 1 / TICK_HZ;
