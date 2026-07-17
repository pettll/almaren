import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/client";
import { MAX_MOD_CODE_LENGTH, validateModCode } from "@/lib/mods/sandbox";

const submitSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  code: z.string().min(1).max(MAX_MOD_CODE_LENGTH),
});

// A submitted mod is only ever run inside the sandbox for validation here.
// Passing validation moves it to "pending" (awaiting manual review before it
// could ever be marked "active"); nothing a mod does is wired into the live
// game loop by this endpoint.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid submission", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const validation = await validateModCode(parsed.data.code);

  const mod = await prisma.mod.create({
    data: {
      authorId: session.user.id,
      name: parsed.data.name,
      description: parsed.data.description,
      code: parsed.data.code,
      status: validation.ok ? "pending" : "rejected",
    },
  });

  return NextResponse.json({
    mod: { id: mod.id, name: mod.name, status: mod.status },
    validation,
  });
}

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status") ?? undefined;

  const mods = await prisma.mod.findMany({
    where: status ? { status } : undefined,
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      version: true,
      authorId: true,
      createdAt: true,
      author: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    mods: mods.map(({ author, ...mod }) => ({
      ...mod,
      authorName: author?.name ?? null,
    })),
  });
}
