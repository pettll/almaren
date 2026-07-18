import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { McpConfig } from "../config";
import {
  addFiles,
  checkoutBranch,
  commit,
  createBranchFromOriginMain,
  createPullRequest,
  currentBranch,
  fetchMain,
  isGhAuthenticated,
  isWorkingTreeClean,
  pushBranch,
  remoteBranchExists,
  runVerificationStep,
  tailOutput,
} from "../lib/git";
import { assertWritablePath } from "../lib/repoPaths";
import { computeSecuritySensitiveNote } from "../lib/security-sensitive";
import { isKnownSindarinWord, pickSindarinWord, SINDARIN_WORDS } from "../lib/sindarin";

const MAX_PROPOSALS_PER_SESSION = 10;
let proposalsThisSession = 0;

const proposeChangeShape = {
  branchSuffix: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "must be lowercase letters, digits, and hyphens only")
    .optional(),
  description: z.string().min(1).describe("What changed — becomes the PR's 'What changed' section"),
  why: z.string().min(1).describe("Why this change is worth making — folds into the commit's EN: gloss line"),
  howTested: z.string().min(1).describe("How this was verified — becomes the PR's 'How was this tested' section"),
  files: z
    .array(z.object({ path: z.string().min(1), content: z.string() }))
    .min(1)
    .max(50)
    .describe("Full contents to write, one entry per file, path relative to the repo root"),
  sindarinWord: z
    .string()
    .optional()
    .describe(`Optional — must be one of: ${SINDARIN_WORDS.map((w) => w.word).join(", ")}. Picked automatically if omitted.`),
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-")
    .slice(0, 50) || "change";
}

function timestampSuffix(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function errorResult(text: string) {
  return { isError: true, content: [{ type: "text" as const, text }] };
}

export function registerProposeChangeTool(server: McpServer, config: McpConfig) {
  server.registerTool(
    "propose_change",
    {
      title: "Propose a code change to Almaren as a real PR",
      description:
        "Opens a real pull request against the Almaren repo from this local checkout, using your " +
        "own git/gh credentials (never the app's — this tool has no server-side identity of its " +
        "own). Creates a branch off the latest origin/main, writes the given files, runs " +
        "typecheck/lint/build locally and aborts if any fail, commits with the repo's Sindarin-word " +
        "convention, pushes, and opens a PR filling in the standard PR template. This tool can only " +
        "open a PR — it never merges one; branch protection and human review are unchanged. " +
        "CI/deploy config (.github/**, deploy/deploy.sh) and .env files cannot be written through " +
        "this tool. Play and read the code first — a change that comes from noticing something " +
        "while actually playing is better than one filed cold.",
      inputSchema: proposeChangeShape,
    },
    async ({ branchSuffix, description, why, howTested, files, sindarinWord }) => {
      const { repoRoot } = config;

      if (proposalsThisSession >= MAX_PROPOSALS_PER_SESSION) {
        return errorResult(
          `this MCP server has already opened ${proposalsThisSession} PRs this session (cap: ${MAX_PROPOSALS_PER_SESSION}). ` +
            `Restart the server to reset the count — this is a deliberate speed bump against a runaway loop, not a bug.`,
        );
      }

      if (sindarinWord && !isKnownSindarinWord(sindarinWord)) {
        return errorResult(
          `"${sindarinWord}" isn't in the curated word list. Omit sindarinWord to have one picked ` +
            `automatically, or choose one of: ${SINDARIN_WORDS.map((w) => w.word).join(", ")}.`,
        );
      }

      // --- Preconditions, all checked before any mutation ---
      if (!isGhAuthenticated(repoRoot)) {
        return errorResult("gh is not authenticated in this environment — run `gh auth login` first.");
      }

      const { clean, dirtyFiles } = isWorkingTreeClean(repoRoot);
      if (!clean) {
        return errorResult(
          "the working tree has uncommitted changes, refusing to proceed:\n" +
            dirtyFiles.join("\n") +
            "\n\nCommit or stash these yourself first — this tool won't touch pre-existing changes it didn't make.",
        );
      }

      const originalBranch = currentBranch(repoRoot);

      const fetchResult = fetchMain(repoRoot);
      if (!fetchResult.ok) {
        return errorResult(`git fetch origin main failed:\n${fetchResult.stderr}`);
      }

      // Validate every path before writing anything.
      let resolvedPaths: string[];
      try {
        resolvedPaths = files.map((f) => assertWritablePath(repoRoot, f.path));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResult(`rejected before writing anything: ${message}`);
      }

      // --- Branch creation ---
      let branchName = `agent/${branchSuffix ?? slugify(description)}-${timestampSuffix()}`;
      if (remoteBranchExists(repoRoot, branchName)) {
        branchName = `${branchName}-2`;
        if (remoteBranchExists(repoRoot, branchName)) {
          return errorResult(`branch name collision on ${branchName} even after retry — try a different branchSuffix.`);
        }
      }

      const branchResult = createBranchFromOriginMain(repoRoot, branchName);
      if (!branchResult.ok) {
        checkoutBranch(repoRoot, originalBranch);
        return errorResult(`failed to create branch ${branchName} from origin/main:\n${branchResult.stderr}`);
      }

      // --- Write files ---
      for (let i = 0; i < files.length; i++) {
        const absolute = resolvedPaths[i];
        mkdirSync(dirname(absolute), { recursive: true });
        writeFileSync(absolute, files[i].content, "utf8");
      }

      // --- Verify: do not clean up on failure here, the failing state is what needs debugging ---
      for (const script of ["typecheck", "lint", "build"]) {
        const result = runVerificationStep(repoRoot, script);
        if (!result.ok) {
          return errorResult(
            `npm run ${script} failed — nothing was committed or pushed. The branch (${branchName}) and ` +
              `written files are left in place on disk for you to inspect/fix.\n\n` +
              tailOutput(result.stdout + result.stderr, 4000),
          );
        }
      }

      // --- Commit ---
      const relativePaths = files.map((f) => f.path);
      const word = sindarinWord
        ? SINDARIN_WORDS.find((w) => w.word === sindarinWord)!
        : pickSindarinWord(`${description} ${why}`, []);

      const commitMessage = `${word.word}\n\nEN: ${word.gloss} — ${why}`;
      const addResult = addFiles(repoRoot, relativePaths);
      if (!addResult.ok) {
        return errorResult(`git add failed:\n${addResult.stderr}`);
      }
      const commitResult = commit(repoRoot, commitMessage);
      if (!commitResult.ok) {
        return errorResult(`git commit failed:\n${commitResult.stderr}`);
      }

      // --- Push ---
      const pushResult = pushBranch(repoRoot, branchName);
      if (!pushResult.ok) {
        return errorResult(
          `git push failed (branch ${branchName} is committed locally, nothing pushed yet):\n${pushResult.stderr}`,
        );
      }

      // --- Open PR ---
      const securityNote = computeSecuritySensitiveNote(relativePaths);
      const prBody = [
        `EN: ${word.gloss}.`,
        "",
        "## What changed",
        "",
        description,
        "",
        "## How was this tested",
        "",
        howTested,
        "",
        "## Security-sensitive areas",
        "",
        securityNote,
        "",
        "## Checklist",
        "",
        "- [x] `npm run typecheck` passes",
        "- [x] `npm run lint` passes",
        "- [x] `npm run build` passes",
        "- [ ] No secrets, API keys, or `.env` values are included in this diff",
        "- [ ] Docs updated if behavior or architecture changed",
        "",
        "---",
        "_Opened via the local Almaren MCP server (`mcp/`), on behalf of the operator's own GitHub " +
          "identity — see `mcp/README.md`. This PR carries no more inherent trust than a stranger's " +
          "PR just because it came from a recognized tool; review it accordingly._",
      ].join("\n");

      const prResult = createPullRequest(repoRoot, { title: word.word, body: prBody, branchName });
      if (!prResult.ok) {
        return errorResult(
          `push succeeded but gh pr create failed — the branch and commit are already on GitHub, ` +
            `you can open the PR manually from ${branchName}:\n${prResult.stderr}`,
        );
      }

      proposalsThisSession += 1;

      return {
        content: [
          {
            type: "text" as const,
            text: `Opened: ${prResult.stdout.trim()}\n\nBranch: ${branchName}\nCommit: ${word.word} (EN: ${word.gloss})\n\nThis PR is not merged — it needs human review, same as any other PR against this repo.`,
          },
        ],
      };
    },
  );
}
