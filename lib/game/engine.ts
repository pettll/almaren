import { EventEmitter } from "node:events";
import { prisma } from "@/lib/db/client";
import { loadAllEntities, persistEntityPosition } from "./entities";
import type { EntityKind, EntityState, WorldEvent } from "./types";
import { clamp, MAX_CHAT_LENGTH, TICK_MS, WORLD_HEIGHT, WORLD_WIDTH } from "./world";

class WorldEngine extends EventEmitter {
  private entities = new Map<string, EntityState>();
  private dirty = new Set<string>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private loadPromise: Promise<void> | null = null;

  constructor() {
    super();
    this.setMaxListeners(0);
  }

  // Deliberately not called from the constructor: the engine is a
  // module-level singleton, and Next.js's build-time static analysis can
  // import route modules (and therefore this one) without a real request
  // or a correctly configured runtime environment behind it. Loading only
  // happens once something actually calls whenReady().
  private load() {
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        const rows = await loadAllEntities();
        for (const entity of rows) this.entities.set(entity.id, entity);
      })();
    }
    return this.loadPromise;
  }

  async whenReady() {
    await this.load();
  }

  snapshot(): EntityState[] {
    return Array.from(this.entities.values());
  }

  private emitEvent(event: WorldEvent) {
    this.emit("event", event);
  }

  registerEntity(entity: EntityState) {
    this.entities.set(entity.id, entity);
    this.emitEvent({ type: "spawn", entity });
  }

  findByOwner(ownerId: string, kind: EntityKind): EntityState | undefined {
    return Array.from(this.entities.values()).find(
      (entity) => entity.ownerId === ownerId && entity.kind === kind,
    );
  }

  // Loads an entity into the live in-memory world if it isn't already
  // there. Used by both the socket server and the HTTP agent API so a
  // freshly created entity (guest login, new API key) is playable
  // immediately without waiting for the next full engine reload.
  async ensureLoaded(
    ownerId: string,
    kind: EntityKind = "player",
  ): Promise<EntityState | null> {
    const existing = this.findByOwner(ownerId, kind);
    if (existing) return existing;

    const row = await prisma.entity.findFirst({ where: { ownerId, kind } });
    if (!row) return null;

    const entity: EntityState = {
      id: row.id,
      ownerId: row.ownerId,
      kind: row.kind as EntityKind,
      name: row.name,
      x: row.x,
      y: row.y,
      data: JSON.parse(row.data),
    };
    this.registerEntity(entity);
    return entity;
  }

  move(entityId: string, dx: number, dy: number) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;

    entity.x = clamp(entity.x + dx, 0, WORLD_WIDTH - 1);
    entity.y = clamp(entity.y + dy, 0, WORLD_HEIGHT - 1);
    this.dirty.add(entityId);
    this.emitEvent({ type: "move", entityId, x: entity.x, y: entity.y });
    return entity;
  }

  async chat(entityId: string, userId: string, content: string) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;

    const trimmed = content.trim().slice(0, MAX_CHAT_LENGTH);
    if (!trimmed) return null;

    await prisma.chatMessage.create({
      data: { entityId, userId, content: trimmed },
    });

    const event: WorldEvent = {
      type: "chat",
      entityId,
      name: entity.name,
      content: trimmed,
      createdAt: Date.now(),
    };
    this.emitEvent(event);
    return event;
  }

  async placeTile(x: number, y: number, terrain: string) {
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return null;

    await prisma.tile.upsert({
      where: { x_y: { x, y } },
      create: { x, y, terrain },
      update: { terrain },
    });

    const event: WorldEvent = { type: "tile", x, y, terrain };
    this.emitEvent(event);
    return event;
  }

  removeEntity(entityId: string) {
    if (this.entities.delete(entityId)) {
      this.emitEvent({ type: "despawn", entityId });
    }
  }

  private async flushDirty() {
    const ids = Array.from(this.dirty);
    this.dirty.clear();
    await Promise.all(
      ids.map((id) => {
        const entity = this.entities.get(id);
        if (!entity) return Promise.resolve();
        return persistEntityPosition(id, entity.x, entity.y).catch(() => {
          // entity may have been deleted concurrently; ignore
        });
      }),
    );
  }

  startTickLoop() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => {
      void this.flushDirty();
      this.emitEvent({ type: "tick", entities: this.snapshot() });
    }, TICK_MS);
  }

  stopTickLoop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}

// One engine instance per server process, shared by the socket server and
// the agent REST API so both interfaces act on the same live world state.
const globalForEngine = globalThis as unknown as { engine?: WorldEngine };

export const engine = globalForEngine.engine ?? new WorldEngine();

if (process.env.NODE_ENV !== "production") {
  globalForEngine.engine = engine;
}
