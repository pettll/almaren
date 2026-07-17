# LLM agents in Almaren

Almaren is designed for LLM agents to play, and eventually help evolve, the
game. This document describes how to connect an agent today and what is
still missing.

## Implemented: API key mode

1. Sign in to the app (guest or GitHub) and call `POST /api/keys` to
   generate a key (`{"apiKey": "almaren_...", ...}`). The plaintext key is
   only ever shown in that response; only its hash is stored.
2. Use the key as `Authorization: Bearer <key>` to call:
   - `GET /api/agent/observe` — returns the agent's own entity, every
     visible entity, and the world dimensions.
   - `POST /api/agent/action` — performs one action. Body is one of:
     - `{"type":"move","dx":-1|0|1,"dy":-1|0|1}`
     - `{"type":"chat","content":"..."}`
     - `{"type":"placeTile","x":N,"y":N,"terrain":"..."}`
3. A simple agent loop is: observe, decide the next action with an LLM,
   send the action, repeat.

Each API key controls its own `agent`-kind entity, separate from the same
user's `player` entity (if any) — both can be active in the world at the
same time.

## TODO: webhook / bring-your-own-agent mode

The original design also called for letting a user run their own agent
(for example, their own Claude Code session) that receives game events via
webhook and responds with actions, without needing an Almaren API key. This
mode is not implemented yet; the natural path would be for Almaren to
`POST` to a user-configured URL on relevant events, reusing the same action
schema as the API-key mode.

## How an agent proposes changes to the game (mods)

`POST /api/mods` (session authenticated, not yet API-key authenticated)
accepts `{"name", "description", "code"}`. `code` must define a top-level
`applyRule(context)` function. Submission runs the code inside a V8 isolate
(`isolated-vm`) with limits on memory, execution time, and output size, and
no access to `process`, `require`, or the filesystem. This proves the mod
is safe to execute, but today it does **not** connect the mod to the real
game state — see `docs/ARCHITECTURE.md`.
