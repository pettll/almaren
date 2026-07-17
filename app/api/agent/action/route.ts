import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiKeyFromHeaders } from "@/lib/auth/api-key";
import { engine } from "@/lib/game/engine";

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move"),
    dx: z.number().int().min(-1).max(1),
    dy: z.number().int().min(-1).max(1),
  }),
  z.object({ type: z.literal("chat"), content: z.string().min(1).max(500) }),
  z.object({
    type: z.literal("placeTile"),
    x: z.number().int(),
    y: z.number().int(),
    terrain: z.string().min(1).max(40),
  }),
]);

// POST /api/agent/action — the single entry point LLM agents use to act in
// the world. Same underlying engine calls the socket server uses, so agents
// and human players are indistinguishable to the game logic.
export async function POST(request: Request) {
  const auth = await resolveApiKeyFromHeaders(request.headers);
  if (!auth) {
    return NextResponse.json({ error: "invalid api key" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid action", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await engine.whenReady();
  const self = await engine.ensureLoaded(auth.userId, "agent");
  if (!self) {
    return NextResponse.json(
      { error: "no agent entity for this key" },
      { status: 404 },
    );
  }

  const action = parsed.data;
  switch (action.type) {
    case "move": {
      const entity = engine.move(self.id, action.dx, action.dy);
      return NextResponse.json({ ok: true, entity });
    }
    case "chat": {
      const event = await engine.chat(self.id, auth.userId, action.content);
      return NextResponse.json({ ok: true, event });
    }
    case "placeTile": {
      const event = await engine.placeTile(action.x, action.y, action.terrain);
      return NextResponse.json({ ok: true, event });
    }
  }
}
