export const WORLD_WIDTH = 64;
export const WORLD_HEIGHT = 64;
export const TICK_MS = 200;
export const MAX_CHAT_LENGTH = 500;

// placeTile's terrain field used to be unvalidated free-text — capped at 40
// chars, but otherwise anything. Whitelisted so a griefing agent can't fill
// the map with garbage, and so terrain values stay meaningful once the
// client actually renders tiles.
export const VALID_TERRAIN = [
  "grass",
  "water",
  "sand",
  "stone",
  "forest",
  "dirt",
  "snow",
] as const;
export type Terrain = (typeof VALID_TERRAIN)[number];

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function randomSpawnPoint() {
  return {
    x: Math.floor(Math.random() * WORLD_WIDTH),
    y: Math.floor(Math.random() * WORLD_HEIGHT),
  };
}
