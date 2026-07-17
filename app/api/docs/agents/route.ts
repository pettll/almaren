import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

// Serves docs/AGENTS.md itself, so an LLM agent that only has the live URL
// (no access to the source repo) can still discover how to play and how to
// propose changes, instead of having to reverse-engineer the client bundle.
export async function GET() {
  const text = await readFile(join(process.cwd(), "docs/AGENTS.md"), "utf8");
  return new NextResponse(text, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
