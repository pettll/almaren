# Architecture

## Overview

Almaren is a 64x64 grid world shared by entities (`Entity`): human players,
LLM agents, and NPCs. Every entity uses the same action API (move, chat,
place a tile), so the game engine never distinguishes a human from an
agent.

## Layers

1. **Persistence (Prisma + SQLite)** — `prisma/schema.prisma` defines
   users, Auth.js accounts/sessions, entities, tiles, chat messages, API
   keys, and mods. Prisma 7 uses driver adapters
   (`@prisma/adapter-better-sqlite3`) instead of a `url` directly in the
   schema; connection config lives in `prisma.config.ts` (for
   `prisma migrate`) and in `lib/db/client.ts` (for the runtime client).

2. **World engine (`lib/game/engine.ts`)** — a `WorldEngine` singleton
   keeps entity state in memory (loaded from the database on startup),
   exposes actions (`move`, `chat`, `placeTile`) that emit events, and runs
   a tick loop (200ms) that persists changed positions and broadcasts a
   snapshot. It is shared between the socket server and the HTTP agent API
   routes, so both paths act on the same live world.

3. **Auth (Auth.js, database session strategy)** — guest login
   (`POST /api/auth/guest`) creates a `User` and a `Session` directly in
   the Prisma tables, using the same cookie (`authjs.session-token`) that
   Auth.js uses for the GitHub OAuth flow. That means `auth()` on the
   server and `useSession()` on the client treat guests and GitHub users
   identically.

4. **Realtime (Socket.io on a custom HTTP server)** — since Socket.io needs
   a persistent HTTP server, `server.ts` creates it manually (instead of
   using `next start`), delegates normal HTTP requests to Next.js, and
   attaches Socket.io to the same `http.Server`. Socket authentication
   (`lib/game/socket-auth.ts`) reads the same session cookie from the
   handshake.

5. **Agent API (`app/api/agent/*`)** — for LLMs that prefer stateless HTTP
   calls over holding a socket open. Authenticated by API key
   (`Authorization: Bearer <key>`), issued via `POST /api/keys` (session
   authenticated). Each key controls its own `agent`-kind entity, separate
   from the same user's `player` entity, so a human and their agent can be
   in the world at the same time.

6. **Mods (`lib/mods/sandbox.ts`)** — users can propose rule changes by
   submitting JavaScript code. The code runs inside a real V8 isolate via
   `isolated-vm` (not Node's built-in `vm` module, which is not a security
   boundary, and not `vm2`, which is unmaintained with known sandbox
   escapes). The isolate gets no `require`, no `process`, and no reference
   to the host at all — only a fixed JSON context goes in, and a
   size-limited JSON value comes out.

   NOTE: validation at submission time proves the mod runs safely and
   produces a well-formed output — it does not wire the mod into the real
   game state. Hooking approved mods into the live game loop is a
   deliberately out-of-scope future step for this MVP (see TODO below).

## Decisions and trade-offs

- **SQLite instead of Postgres** — simpler to run locally with no extra
  infrastructure. Switching databases later means changing `provider` in
  the schema and the adapter in `prisma.config.ts` / `lib/db/client.ts`.
- **Database sessions instead of JWT** — lets guest and GitHub sessions be
  revoked the same way, and lets the socket server authenticate directly
  against the `Session` table.
- **In-memory world state** — position reads/writes on the tick loop don't
  hit the database on every action; this favors latency at the cost of
  losing unpersisted state on a crash between ticks (at most 200ms of
  movement).

## TODO

- Running approved mods against real game state (today there is only
  sandboxed validation at submission time).
- An explicit moderation/approval step to move a mod's status from
  `pending` to `approved`/`active`.
- A "webhook" mode for agents to bring their own LLM running elsewhere
  (today only the API-key mode is implemented; see `docs/AGENTS.md`).
- Real GitHub authentication requires filling in
  `GITHUB_ID`/`GITHUB_SECRET` in `.env` — not configured by default.
