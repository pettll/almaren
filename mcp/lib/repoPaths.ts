import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { resolve, sep } from "node:path";

// Denylisted regardless of .gitignore: never let a tool read (or, in
// proposeChange, write) these even if they exist untracked on disk locally.
// Defense in depth for a repo that's public today, but this module is meant
// to be reusable if the mcp/ scaffold is ever pointed at a private repo,
// where this becomes load-bearing rather than a nice-to-have.
const ALWAYS_DENIED_PREFIXES = [".env", "node_modules" + sep, ".git" + sep];

export function resolveRepoRoot(): string {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
  if (!root) {
    throw new Error(
      "could not resolve a git repo root from the current working directory — run the MCP server from inside a clone of the almaren repo",
    );
  }
  return root;
}

// Resolves a caller-supplied relative path against the repo root, rejecting
// any path that escapes it (via ../ traversal or a symlink) or that matches
// the always-denied prefixes above. Returns the absolute path on success,
// or throws with a message safe to return directly to the calling agent.
export function resolveScopedPath(repoRoot: string, relativePath: string): string {
  if (relativePath.startsWith("/")) {
    throw new Error(`path must be relative to the repo root, got an absolute path: ${relativePath}`);
  }

  const absolute = resolve(repoRoot, relativePath);
  if (absolute !== repoRoot && !absolute.startsWith(repoRoot + sep)) {
    throw new Error(`path escapes the repo root: ${relativePath}`);
  }

  const relativeFromRoot = absolute.slice(repoRoot.length + 1);
  for (const denied of ALWAYS_DENIED_PREFIXES) {
    if (relativeFromRoot === denied.replace(/\/$/, "") || relativeFromRoot.startsWith(denied)) {
      throw new Error(`path is not readable through this tool: ${relativePath}`);
    }
  }

  try {
    const real = execFileSync("realpath", [absolute], { encoding: "utf8" }).trim();
    if (real !== absolute && !real.startsWith(repoRoot + sep)) {
      throw new Error(`path escapes the repo root via a symlink: ${relativePath}`);
    }
  } catch {
    // realpath fails if the target doesn't exist yet (fine for a write
    // target in proposeChange); the containment check above already ran.
  }

  return absolute;
}

export function assertRegularFileUnderLimit(absolutePath: string, maxBytes: number): void {
  const stats = statSync(absolutePath);
  if (!stats.isFile()) {
    throw new Error(`not a regular file: ${absolutePath}`);
  }
  if (stats.size > maxBytes) {
    throw new Error(`file exceeds the ${maxBytes}-byte limit for this tool: ${absolutePath}`);
  }
}
