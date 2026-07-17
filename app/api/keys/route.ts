import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { generateApiKey } from "@/lib/auth/api-key";
import { prisma } from "@/lib/db/client";
import { spawnEntityForUser } from "@/lib/game/entities";

// Issues a new agent API key for the signed-in user, and makes sure they
// have an "agent" entity in the world for that key to control. The
// plaintext key is only ever returned here, once — only its hash is stored.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.slice(0, 100) : null;

  const { plaintext, hash } = generateApiKey();

  await prisma.apiKey.create({
    data: { key: hash, label, userId: session.user.id },
  });

  const entity = await spawnEntityForUser(
    session.user.id,
    `${session.user.name ?? "Agent"}'s agent`,
    "agent",
  );

  return NextResponse.json({
    apiKey: plaintext,
    warning: "Save this key now. It will not be shown again.",
    entityId: entity.id,
    docs: "/api/docs/agents",
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      label: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}
