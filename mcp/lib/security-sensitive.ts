// Mirrors the paths CONTRIBUTING.md and .github/CODEOWNERS already call
// out as needing extra scrutiny — reusing the existing convention rather
// than inventing a new one.
const SENSITIVE_PREFIXES = [
  "lib/auth/",
  "lib/mods/sandbox.ts",
  "server.ts",
  "app/api/agent/",
];

export function computeSecuritySensitiveNote(paths: string[]): string {
  const matched = paths.filter((p) =>
    SENSITIVE_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix)),
  );

  if (matched.length === 0) return "N/A";

  return (
    `This PR touches ${matched.map((p) => `\`${p}\``).join(", ")}, which ` +
    `CONTRIBUTING.md and .github/CODEOWNERS flag as security-sensitive ` +
    `(auth, the mod sandbox, or the agent API). Please review with extra ` +
    `scrutiny — this PR was opened by an autonomous agent via the local ` +
    `MCP server (mcp/), not hand-written.`
  );
}
