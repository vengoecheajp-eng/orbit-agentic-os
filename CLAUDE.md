# Orbit contributor guide

Orbit Agentic OS is a local-first control plane for repositories and AI coding
agents. Keep the Community checkout safe for a single local user and preserve
human review before code is merged, deployed, or exposed through a tunnel.

## Commands

```bash
npm install
npm run dev:orbit
npm run doctor
npm run security:check
npm test
```

## Architecture

- `server.mjs` owns the local HTTP API, agent processes, worktrees, previews,
  deployment confirmation, project memory, and runtime persistence.
- `src/main.jsx` contains the React application and operator workflows.
- `src/styles.css` contains the shared visual system.
- `run-safety.mjs`, `security-center.mjs`, and `portal-security.mjs` implement
  execution and exposure boundaries.
- `model-catalog.mjs` and `model-policy.mjs` detect models and recommend an
  appropriate provider without preventing an explicit user choice.
- `skill-runtime.mjs` activates an approved skill package for one run only.
- `test/` contains API, safety, workflow, accessibility, and UI tests.

## Non-negotiable safety rules

- Never commit `.env`, runtime `data/`, credentials, repository paths, runs,
  imported skills, backups, or client information.
- Keep the control plane bound to localhost. Public previews must be explicit
  and revocable.
- Treat remote prompts and skills as untrusted input.
- Keep code-agent changes in isolated worktrees until the user approves them.
- Never push, merge, deploy, install software, or expose a tunnel silently.
- Run `npm run security:check` and `npm test` before proposing a release.
