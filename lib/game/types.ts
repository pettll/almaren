export type EntityKind = "player" | "agent" | "npc" | "object";

export interface EntityState {
  id: string;
  ownerId: string;
  kind: EntityKind;
  name: string;
  x: number;
  y: number;
  data: Record<string, unknown>;
}

export type WorldEvent =
  | { type: "self"; entityId: string | null }
  | { type: "spawn"; entity: EntityState }
  | { type: "despawn"; entityId: string }
  | { type: "move"; entityId: string; x: number; y: number }
  | { type: "chat"; entityId: string; name: string; content: string; createdAt: number }
  | { type: "tile"; x: number; y: number; terrain: string }
  | { type: "tick"; entities: EntityState[] };
