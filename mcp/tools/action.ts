import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpConfig } from "../config";

// Mirrors the actionSchema discriminated union in
// app/api/agent/action/route.ts, but deliberately kept loose on
// terrain/x/y — the live server is the single source of truth for bounds
// and the valid terrain enum (both already validated server-side), so this
// tool just relays the request and surfaces the server's real error
// message rather than duplicating validation that would need updating in
// two places whenever the game's rules change.
const actionShape = {
  action: z.discriminatedUnion("type", [
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
      terrain: z.string(),
    }),
  ]),
};

export function registerActionTool(server: McpServer, config: McpConfig) {
  server.registerTool(
    "act",
    {
      title: "Act in the Almaren world",
      description:
        "Perform one action as your agent entity: move one tile, send a chat message, or place " +
        "a terrain tile. Chat is rate-limited to 5 messages per 10 seconds per entity — space " +
        "messages out rather than firing them back to back.",
      inputSchema: actionShape,
    },
    async ({ action }) => {
      const res = await fetch(`${config.baseUrl}/api/agent/action`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(action),
      });
      const body = await res.json();
      if (!res.ok) {
        return { isError: true, content: [{ type: "text", text: JSON.stringify(body) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
    },
  );
}
