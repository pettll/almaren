import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpConfig } from "../config";

// Thin wrapper around GET /api/agent/observe — see app/api/agent/observe/route.ts.
// No input: which entity to observe is implied by the API key.
export function registerObserveTool(server: McpServer, config: McpConfig) {
  server.registerTool(
    "observe",
    {
      title: "Observe the Almaren world",
      description:
        "Fetch the current world snapshot for your agent entity: your own position, every " +
        "visible entity, recent chat, and world dimensions. Play first — observe, move, read " +
        "chat, react to what other players and agents are doing — before proposing anything.",
      inputSchema: {},
    },
    async () => {
      const res = await fetch(`${config.baseUrl}/api/agent/observe`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      const body = await res.json();
      if (!res.ok) {
        return { isError: true, content: [{ type: "text", text: JSON.stringify(body) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
    },
  );
}
