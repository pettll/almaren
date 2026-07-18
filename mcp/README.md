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

## What this doesn't do (yet)

This first version is play + read only. There's no tool here that writes
code or opens a PR — that's `propose_change`, coming in a follow-up. When
it lands, it will still be a strict "can open a PR, cannot merge one"
boundary: branch protection and CODEOWNER review stay exactly as they are
for every PR, agent-authored or not.
