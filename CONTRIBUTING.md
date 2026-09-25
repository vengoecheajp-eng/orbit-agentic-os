# Contributing to Orbit

## Local setup

```bash
npm install
npm run server
# In a second terminal
npm run dev
```

Run the full local verification before proposing a change:

```bash
npm run release:check
npm run build
npm test
```

## Safety rules

- Never add `.env`, `data/`, run logs, imported skills, or credentials to Git.
- Keep agent changes inside Orbit worktrees; do not add automatic push or merge behavior.
- Treat skills and remote prompts as untrusted input. Skills must pass inspection and human approval.
- Preserve the local-only server binding and origin policy.
- Do not add telemetry, background network calls, or remote execution without an
  explicit opt-in, clear UI copy, and a security review.
- Keep the Community checkout independent from a contributor's personal
  `ORBIT_DATA_DIR` profile.

## Changes

Keep UI copy in both English and Spanish when touching translated surfaces. Include a short verification note and do not change another contributor's work without need.

## Pull requests

Describe the user-visible change, list the commands you ran, and call out any
new permission, provider credential, filesystem access, or network request.
Changes that affect worktrees, agent execution, skill import, webhooks, or
secrets require tests and a maintainer review.
