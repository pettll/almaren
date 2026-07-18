import { execFileSync } from "node:child_process";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpConfig } from "../config";

const MAX_RESULT_BYTES = 64 * 1024;

// git grep, not raw grep -r: it respects .gitignore automatically, so it
// can't dump node_modules/ or .next/ build output into an agent's context.
export function registerSearchRepoTool(server: McpServer, config: McpConfig) {
  server.registerTool(
    "search_repo",
    {
      title: "Search the Almaren repo",
      description:
        "Search tracked source files for a string, optionally scoped to a glob pattern (e.g. " +
        "\"app/api/**\"). Returns matching lines with file:line prefixes, git-grep style.",
      inputSchema: {
        query: z.string().min(1),
        globPattern: z.string().min(1).optional(),
      },
    },
    async ({ query, globPattern }) => {
      const args = ["grep", "-n", "-e", query];
      if (globPattern) args.push("--", globPattern);

      try {
        const output = execFileSync("git", args, {
          cwd: config.repoRoot,
          encoding: "utf8",
          maxBuffer: MAX_RESULT_BYTES * 2,
        });
        const truncated = output.length > MAX_RESULT_BYTES;
        const text = truncated ? output.slice(0, MAX_RESULT_BYTES) + "\n...(truncated)" : output;
        return { content: [{ type: "text", text: text || "no matches" }] };
      } catch (error: unknown) {
        // git grep exits 1 with no output when there are simply no matches —
        // not an error condition worth surfacing as one.
        const err = error as { status?: number; stdout?: string };
        if (err.status === 1 && !err.stdout) {
          return { content: [{ type: "text", text: "no matches" }] };
        }
        const message = error instanceof Error ? error.message : String(error);
        return { isError: true, content: [{ type: "text", text: message }] };
      }
    },
  );
}
