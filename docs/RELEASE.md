# Orbit Agentic OS community release checklist

This checklist creates a public Orbit Community release without exposing a
maintainer's personal setup.

## 1. Start from a clean profile

- Keep the maintainer profile in `ORBIT_DATA_DIR` outside the checkout.
- Do not use real client projects, repository names, prompts, run history,
  provider keys, Telegram configuration, or client portal links in assets.
- Use the safe Example project created from `data/projects.example.json`.

## 2. Verify the source

```bash
npm ci
npm run doctor
npm run security:check
npm test
```

All commands must pass before a release is tagged. `npm test` creates an
isolated temporary control plane and does not use the maintainer profile.

## 3. Record public assets

Save public screenshots and the short demo video in `docs/assets/` only after
reviewing every frame. The recommended sequence is:

1. Welcome and local profile setup.
2. Provider detection without a key shown.
3. Example project and an isolated agent run.
4. Executive Inbox showing human review before merge.
5. `npm run security:check` passing.

Use [DEMO.md](DEMO.md) for the spoken demo script. Never capture `.env`, local
paths, terminal history, client portal tokens, QR codes, or model credentials.

## 4. Create the GitHub repository

Before the first push, inspect the candidate set:

```bash
git status --short
npm run release:check
```

Add only the files intended for Community. Do not force-add ignored files. The
initial repository must include `LICENSE`, `README.md`, `SECURITY.md`,
`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.env.example`, CI, and the safe
example project.

## 5. Publish responsibly

- Create a release tag and concise release notes that state Orbit is local-first
  and single-user.
- Link the security policy and contribution guide.
- Enable private vulnerability reporting in the GitHub repository settings.
- Do not claim that cloud providers, WhatsApp, Telegram, or previews are free;
  each service has its own costs and terms.
