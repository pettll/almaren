import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db/client";

const REPO = "pettll/almaren";
const MAX_CONVERSIONS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function issueBody(mod: {
  id: string;
  description: string;
  code: string;
  status: string;
  author: { name: string | null };
}, convertedByName: string) {
  return (
    `Proposed via the in-game mod system by **${mod.author.name ?? "unknown"}** ` +
    `(mod id \`${mod.id}\`, status \`${mod.status}\`), converted to an issue by ` +
    `**${convertedByName}**.\n\n` +
    `## Description\n\n${mod.description || "_no description provided_"}\n\n` +
    `## Code\n\n\`\`\`js\n${mod.code}\n\`\`\`\n\n---\n` +
    `_Opened automatically from the Mods tab in Almaren. Mods are validated ` +
    `in a sandbox on submission but not yet wired into live game state — ` +
    `see docs/ARCHITECTURE.md._`
  );
}

// POST /api/mods/[id]/issue — lets a GitHub-authenticated (non-guest) user
// promote a proposed mod into a tracked repo issue, using a server-side
// token rather than the user's own OAuth scope (login stays low-privilege).
// Idempotent per mod (returns the existing issue if already converted) and
// rate-limited per converting user, since guest accounts are free and the
// underlying mod-submission endpoint has no rate limit of its own.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (session.user.isGuest) {
    return NextResponse.json(
      { error: "sign in with GitHub to convert mods into issues" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const mod = await prisma.mod.findUnique({
    where: { id },
    include: { author: { select: { name: true } } },
  });
  if (!mod) {
    return NextResponse.json({ error: "mod not found" }, { status: 404 });
  }

  if (mod.githubIssueUrl) {
    return NextResponse.json({ issueUrl: mod.githubIssueUrl });
  }

  const recentConversions = await prisma.mod.count({
    where: {
      convertedByUserId: session.user.id,
      convertedAt: { gte: new Date(Date.now() - DAY_MS) },
    },
  });
  if (recentConversions >= MAX_CONVERSIONS_PER_DAY) {
    return NextResponse.json(
      { error: `rate limited: max ${MAX_CONVERSIONS_PER_DAY} conversions per day` },
      { status: 429 },
    );
  }

  const token = process.env.GITHUB_ISSUES_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "GitHub issue creation is not configured on this deployment" },
      { status: 501 },
    );
  }

  const githubResponse = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title: `Mod proposal: ${mod.name}`,
      body: issueBody(mod, session.user.name ?? "unknown"),
      labels: ["mod-proposal"],
    }),
  });

  if (!githubResponse.ok) {
    const details = await githubResponse.text();
    return NextResponse.json(
      { error: "failed to create GitHub issue", details },
      { status: 502 },
    );
  }

  const issue = (await githubResponse.json()) as { html_url: string };

  await prisma.mod.update({
    where: { id: mod.id },
    data: {
      githubIssueUrl: issue.html_url,
      convertedByUserId: session.user.id,
      convertedAt: new Date(),
    },
  });

  return NextResponse.json({ issueUrl: issue.html_url });
}
