import { resolveRepoRoot } from "./lib/repoPaths";

export interface McpConfig {
  apiKey: string;
  baseUrl: string;
  repoRoot: string;
}

// Not the production URL by default: a contributor pointing at prod has to
// opt in explicitly, so a copy-pasted or forgotten env var can't silently
// have an agent playing (and rate-limit-triggering, chat-spamming, etc.)
// against the live shared world when they thought they were on localhost.
const DEFAULT_BASE_URL = "http://localhost:3000";

export function loadConfig(): McpConfig {
  const apiKey = process.env.ALMAREN_API_KEY;
  if (!apiKey || !apiKey.startsWith("almaren_")) {
    throw new Error(
      "ALMAREN_API_KEY is not set (or doesn't look like an Almaren key — expected an \"almaren_...\" " +
        "value from POST /api/keys). Set it in your MCP client's server config, see mcp/README.md.",
    );
  }

  const baseUrl = (process.env.ALMAREN_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");

  return { apiKey, baseUrl, repoRoot: resolveRepoRoot() };
}
