# Contributing to Almaren

Almaren is meant to be shaped by both human contributors and LLM agents,
whether through code (pull requests) or through the in-game mod system.

## Two ways to contribute

- **Gameplay rule changes** — submit a mod through the running app
  (`POST /api/mods`, see `docs/AGENTS.md`). Mods run in a sandbox for
  validation but are not (yet) wired into the live game — see the TODO
  section of `docs/ARCHITECTURE.md`.
- **Code changes** — open a pull request against this repository, as
  described below.

## Getting set up

See `README.md` for local setup. Before opening a PR, make sure these all
pass locally:

```
npm run typecheck
npm run lint
npm run build
```

## Branching and commits

- Branch off `main` with a short, descriptive name:
  `feat/agent-observe-caching`, `fix/socket-auth-race`,
  `docs/architecture-update`.
- Keep commits focused; do not bundle unrelated changes.

### Commit message convention

Commit subjects are a single Sindarin (Elvish) word or short phrase —
something LOTR-linked but not the obvious pick. The body opens with an
`EN:` line giving the English gloss, then explains what changed and why
in plain English. Example:

```
Mellon

EN: Friend — the password that opened the Doors of Durin. Fitting,
since the bug here was Auth.js refusing to trust its own front door:
behind the reverse proxy, every /api/auth/* request arrived with
Host: localhost:3000, and Auth.js v5 rejects that as an UntrustedHost
by default. Fix: trustHost: true in the NextAuth config.
```

Don't force a pun or a stretch — a plain, correctly-attested word beats
a clever but invented one. When in doubt, favor words already attested
in Tolkien's published texts (LOTR appendices, The Silmarillion) over
obscure or reconstructed vocabulary.

This applies to commits in this repo; it is not part of the in-game mod
system or agent chat.

## Opening a pull request

1. Give the PR the same treatment as a commit subject: a Sindarin
   title, with the English gloss as the first line of the description
   (the PR template's "What changed" section is the natural place for
   it).
2. Fill in the rest of the PR template (`.github/pull_request_template.md`)
   — what changed, why, and how you tested it.
3. Link any related issue.
4. Make sure CI is green: typecheck, lint, build, and a secret scan all run
   automatically on every PR (`.github/workflows/ci.yml`) and are required
   to pass before merge (branch protection on `main`).
5. Keep the diff scoped to one concern. Large, unrelated changes are harder
   to review and more likely to get stuck.

## Review process

- `main` is protected: no direct pushes, PRs only.
- At least one approving review from a CODEOWNER (`.github/CODEOWNERS`) is
  required before merge — currently that's `@pettll` for the whole repo,
  deliberately, to keep control over what reaches the live deployment
  (merges to `main` auto-deploy, see `.github/workflows/deploy.yml`).
- Branch protection is enforced with no admin bypass, so this applies
  to everyone, including the repo owner. A PR cannot be self-approved —
  in practice this means PRs opened under the same account as the sole
  CODEOWNER need that restriction revisited (e.g. a second reviewer, or
  a distinct bot/agent identity for authoring) before they can merge.
- Reviewers should check correctness, whether the change matches the
  architecture described in `docs/ARCHITECTURE.md`, and whether it
  introduces new attack surface. This project accepts code from LLM agents
  and untrusted mod submissions, so security-sensitive changes — auth, the
  mod sandbox, the agent API — get extra scrutiny.
- If a change touches `lib/mods/sandbox.ts`, `lib/auth/*`, or anything that
  runs untrusted input, call that out explicitly in the PR description.
- Squash-merge is preferred to keep `main` history linear.

## Deployment

Every push to `main` (i.e. every merged PR) triggers
`.github/workflows/deploy.yml`, which SSHes into the live Oracle Cloud
instance and runs `deploy/deploy.sh` — the same idempotent script used for
manual deploys. This is why review before merge matters: merging is
deploying.

## Secrets

Never commit `.env`, API keys, or credentials. A pre-commit hook
(`.husky/pre-commit`) and CI both scan for accidentally committed secrets,
but the hook is a safety net, not a substitute for care.

## Reporting security issues

Given the mod sandbox and agent API accept untrusted input by design, if
you find a way to break out of the sandbox or bypass authentication, please
report it privately rather than opening a public issue.
