# Almaren MCP server

A local [MCP](https://modelcontextprotocol.io) server that lets a coding
agent (Claude Code, Claude Desktop, or any MCP-compatible client) both
**play** Almaren and **read the game's own source code**, in one session,
under one identity — yours.

This is deliberately a *local* tool, not a hosted one. It runs on your own
machine, using your own Almaren API key and your own local git checkout —
it never touches the production deployment or adds any new credentials
there. Anyone who clones this repo gets the same capability under their
own identity; there's no shared bot account.

Play tools (`observe`, `act`) are thin wrappers around the existing public
`/api/agent/*` REST API — see `docs/AGENTS.md` for the underlying protocol.
Code tools (`read_file`, `search_repo`) are scoped to the local checkout
this server runs from.

## Setup

1. Clone this repo (if you haven't already) and `cd` into it.
2. Get an Almaren API key: sign in at the live site (or your local
   `npm run dev`), then `POST /api/keys` (see `docs/AGENTS.md`) to mint one.
3. Add this server to your MCP client's config. For Claude Code, add to
   `.mcp.json` (or your global MCP config):

   ```json
   {
     "mcpServers": {
       "almaren": {
         "command": "npx",
         "args": ["tsx", "mcp/server.ts"],
         "cwd": "/absolute/path/to/your/almaren/checkout",
         "env": {
           "ALMAREN_API_KEY": "almaren_...",
           "ALMAREN_BASE_URL": "http://localhost:3000"
         }
       }
     }
   }
   ```

   `ALMAREN_BASE_URL` defaults to `http://localhost:3000` if omitted —
   point it at your local `npm run dev` server. Set it explicitly to the
   live production URL only when you actually mean to play (and, once
   available, propose changes) against the real shared world.

4. Restart your MCP client so it picks up the new server.

## Verifying your setup

1. `npm run mcp` in a terminal — it should start without printing an
   error. A missing/malformed `ALMAREN_API_KEY` fails immediately with a
   clear message; a missing git repo root does too.
2. From your MCP client, call `observe` — you should get back real world
   state (your entity, other visible entities, world size).
3. Call `act` with `{"type":"move","dx":1,"dy":0}` — call `observe` again
   (or check the web UI in a browser) and confirm your entity moved.
4. Call `read_file` with `{"path":"package.json"}` — confirm you get the
   file back. Then try `{"path":"../../etc/passwd"}` or
   `{"path":".env"}` — both should be rejected.
5. Call `search_repo` with `{"query":"WorldEngine"}` — confirm you get
   matches from `lib/game/engine.ts` and friends, and that nothing from
   `node_modules/` or `.next/` shows up.

## Proposing a code change: `propose_change`

Once you've played and read the relevant code, `propose_change` opens a
real pull request from this local checkout — using your own `git`/`gh`
credentials, not any identity of the app's. It:

1. Requires a clean working tree and `gh auth status` to already be
   authenticated — it won't stash your work or prompt a login for you.
2. Creates a branch off the latest `origin/main` (`agent/<slug>-<timestamp>`).
3. Writes the files you give it (full contents, not a patch — one entry
   per `{path, content}`).
4. Runs `npm run typecheck && npm run lint && npm run build` locally and
   **stops before committing anything** if any of them fail, leaving the
   branch and files in place so you can see what broke.
5. Commits using this repo's Sindarin-word convention (see
   `CONTRIBUTING.md`) — pass `sindarinWord` if you want to choose
   deliberately, or leave it out and the tool picks one from a small
   curated, attested-vocabulary list.
6. Pushes and opens a PR, filling in the real
   `.github/pull_request_template.md` sections.

**Hard limits, not configurable:**
- No merge tool exists. This can only get a change as far as an open PR —
  branch protection and CODEOWNER review are unchanged for every PR,
  whether you opened it by hand or a tool did.
- `.github/**`, `deploy/deploy.sh`, and `.env*` cannot be written through
  this tool, full stop — no legitimate agent-authored PR needs to touch
  CI/branch-protection config or the deploy script.
- Capped at 10 `propose_change` calls per running server process, to put a
  speed bump in front of a runaway loop opening PRs unattended. Restart
  the server to reset the count.

This tool cannot tell a sound change from a plausible-looking wrong one —
that's what human review and CI remain for. A PR opened this way carries
no more inherent trust than a stranger's PR just because it came from a
recognized local tool; review it accordingly.

### Verifying `propose_change`

Do one real end-to-end run with a genuinely trivial, throwaway change
(e.g. a one-line docs fix) and confirm the whole pipeline works, then
close and delete that PR/branch as cleanup — this is the one tool here
with real side effects against the actual repo, worth confirming for
real rather than trusting the code reading correctly. Also worth
deliberately triggering a failure path once (a dirty working tree, or a
`files` entry targeting `.github/workflows/ci.yml`) to confirm it refuses
cleanly with no partial mutation.
