import { execFileSync } from "node:child_process";

export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

// Every subprocess call in this module goes through here: argv array,
// never a shell string, so nothing in a description/content field an
// agent supplies can be interpreted as shell syntax.
export function run(
  command: string,
  args: string[],
  options: { cwd: string; maxBuffer?: number },
): CommandResult {
  try {
    const stdout = execFileSync(command, args, {
      cwd: options.cwd,
      encoding: "utf8",
      maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, stdout, stderr: "" };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message: string };
    return {
      ok: false,
      stdout: err.stdout ?? "",
      stderr: err.stderr || err.message,
    };
  }
}

export function isGhAuthenticated(repoRoot: string): boolean {
  return run("gh", ["auth", "status"], { cwd: repoRoot }).ok;
}

export function isWorkingTreeClean(repoRoot: string): { clean: boolean; dirtyFiles: string[] } {
  const result = run("git", ["status", "--porcelain"], { cwd: repoRoot });
  const dirtyFiles = result.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return { clean: dirtyFiles.length === 0, dirtyFiles };
}

export function currentBranch(repoRoot: string): string {
  return run("git", ["branch", "--show-current"], { cwd: repoRoot }).stdout.trim();
}

export function fetchMain(repoRoot: string): CommandResult {
  return run("git", ["fetch", "origin", "main"], { cwd: repoRoot });
}

export function remoteBranchExists(repoRoot: string, branchName: string): boolean {
  const result = run("git", ["ls-remote", "--exit-code", "--heads", "origin", branchName], {
    cwd: repoRoot,
  });
  return result.ok;
}

export function createBranchFromOriginMain(repoRoot: string, branchName: string): CommandResult {
  return run("git", ["checkout", "-B", branchName, "origin/main"], { cwd: repoRoot });
}

export function checkoutBranch(repoRoot: string, branchName: string): CommandResult {
  return run("git", ["checkout", branchName], { cwd: repoRoot });
}

export function addFiles(repoRoot: string, paths: string[]): CommandResult {
  return run("git", ["add", "--", ...paths], { cwd: repoRoot });
}

export function commit(repoRoot: string, message: string): CommandResult {
  return run("git", ["commit", "-m", message], { cwd: repoRoot });
}

export function pushBranch(repoRoot: string, branchName: string): CommandResult {
  return run("git", ["push", "-u", "origin", branchName], { cwd: repoRoot });
}

export function createPullRequest(
  repoRoot: string,
  options: { title: string; body: string; branchName: string },
): CommandResult {
  return run(
    "gh",
    [
      "pr",
      "create",
      "--title",
      options.title,
      "--body",
      options.body,
      "--base",
      "main",
      "--head",
      options.branchName,
    ],
    { cwd: repoRoot },
  );
}

export function runVerificationStep(repoRoot: string, npmScript: string): CommandResult {
  return run("npm", ["run", npmScript], { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 });
}

export function tailOutput(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `...(truncated)\n${text.slice(-maxChars)}`;
}
