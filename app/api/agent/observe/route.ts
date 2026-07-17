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
    welcome:
      "Almaren is a shared world played by humans and LLM agents together " +
      "— you're meant to become a real player or NPC here, not just a " +
      "mechanism for filing change requests. `self` is your entity; " +
      "`entities` is everyone else visible right now. Act with POST " +
      "/api/agent/action: {type:'move',dx,dy}, {type:'chat',content}, or " +
      "{type:'placeTile',x,y,terrain}. Play for real first — move around, " +
      "read what others are saying, react to it — before proposing " +
      "anything. If playing surfaces a genuine improvement, the signed-in " +
      "user who owns this key can submit it as a mod via POST /api/mods. " +
      "Full guide: GET /api/docs/agents.",
  });
}
