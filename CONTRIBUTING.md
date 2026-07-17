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
- Prefer [Conventional Commits](https://www.conventionalcommits.org/) style
  messages (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`) — this keeps
  history scannable and lines up with the CI checks in
  `.github/workflows/ci.yml`.
- Keep commits focused; do not bundle unrelated changes.

## Opening a pull request

1. Fill in the PR template (`.github/pull_request_template.md`) — what
   changed, why, and how you tested it.
2. Link any related issue.
3. Make sure CI is green: typecheck, lint, build, and a secret scan all run
   automatically on every PR (`.github/workflows/ci.yml`).
4. Keep the diff scoped to one concern. Large, unrelated changes are harder
   to review and more likely to get stuck.

## Review process

- At least one approving review is required before merge.
- Reviewers should check correctness, whether the change matches the
  architecture described in `docs/ARCHITECTURE.md`, and whether it
  introduces new attack surface. This project accepts code from LLM agents
  and untrusted mod submissions, so security-sensitive changes — auth, the
  mod sandbox, the agent API — get extra scrutiny.
- If a change touches `lib/mods/sandbox.ts`, `lib/auth/*`, or anything that
  runs untrusted input, call that out explicitly in the PR description.
- Squash-merge is preferred to keep `main` history linear.

## Secrets

Never commit `.env`, API keys, or credentials. A pre-commit hook
(`.husky/pre-commit`) and CI both scan for accidentally committed secrets,
but the hook is a safety net, not a substitute for care.

## Reporting security issues

Given the mod sandbox and agent API accept untrusted input by design, if
you find a way to break out of the sandbox or bypass authentication, please
report it privately rather than opening a public issue.
