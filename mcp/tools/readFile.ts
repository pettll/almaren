import { readFileSync } from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpConfig } from "../config";
import { assertRegularFileUnderLimit, resolveScopedPath } from "../lib/repoPaths";

const MAX_READ_BYTES = 256 * 1024;

export function registerReadFileTool(server: McpServer, config: McpConfig) {
  server.registerTool(
    "read_file",
    {
      title: "Read a file from the Almaren repo",
      description:
        "Read a file's contents, given a path relative to the repo root (e.g. \"lib/game/engine.ts\"). " +
        "Scoped to the local checkout this MCP server is running from; cannot escape the repo root " +
        "or read .env files.",
      inputSchema: { path: z.string().min(1) },
    },
    async ({ path }) => {
      try {
        const absolute = resolveScopedPath(config.repoRoot, path);
        assertRegularFileUnderLimit(absolute, MAX_READ_BYTES);
        const content = readFileSync(absolute, "utf8");
        return { content: [{ type: "text", text: content }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { isError: true, content: [{ type: "text", text: message }] };
      }
    },
  );
}
