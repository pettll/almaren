import { NextResponse } from "next/server";
import { resolveApiKeyFromHeaders } from "@/lib/auth/api-key";
import { engine } from "@/lib/game/engine";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@/lib/game/world";

// GET /api/agent/observe — a stateless "what does the world look like right
// now" call, so an LLM-driven agent can decide its next action without
// holding a socket connection open.
export async function GET(request: Request) {
  const auth = await resolveApiKeyFromHeaders(request.headers);
  if (!auth) {
    return NextResponse.json({ error: "invalid api key" }, { status: 401 });
  }

  await engine.whenReady();
  const self = await engine.ensureLoaded(auth.userId, "agent");
  if (!self) {
    return NextResponse.json(
      { error: "no agent entity for this key" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    self,
    entities: engine.snapshot(),
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  });
}
