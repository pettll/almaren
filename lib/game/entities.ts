import { prisma } from "@/lib/db/client";
import type { EntityKind, EntityState } from "./types";
import { randomSpawnPoint } from "./world";

function toEntityState(row: {
  id: string;
  ownerId: string;
  kind: string;
  name: string;
  x: number;
  y: number;
  data: string;
}): EntityState {
  return {
    id: row.id,
    ownerId: row.ownerId,
    kind: row.kind as EntityKind,
    name: row.name,
    x: row.x,
    y: row.y,
    data: JSON.parse(row.data),
  };
}

// Returns the user's existing player entity, or creates one at a random
// spawn point. Called on guest creation and on first GitHub login.
export async function spawnEntityForUser(
  userId: string,
  name: string,
  kind: EntityKind = "player",
): Promise<EntityState> {
  const existing = await prisma.entity.findFirst({
    where: { ownerId: userId, kind },
  });
  if (existing) return toEntityState(existing);

  const { x, y } = randomSpawnPoint();
  const created = await prisma.entity.create({
    data: { ownerId: userId, kind, name, x, y },
  });
  return toEntityState(created);
}

export async function loadAllEntities(): Promise<EntityState[]> {
  const rows = await prisma.entity.findMany();
  return rows.map(toEntityState);
}

export async function persistEntityPosition(
  entityId: string,
  x: number,
  y: number,
) {
  await prisma.entity.update({ where: { id: entityId }, data: { x, y } });
}
