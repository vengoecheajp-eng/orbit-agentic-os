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

Before the first push, select and stage only the intended public files, then
inspect the exact index contents:

```bash
git status --short
npm run release:check
```

The default check is `--index`: it reads staged Git blobs, including files that
have unstaged edits or are missing from the working directory. It does **not**
inspect unstaged or untracked files. Stage each intended change and rerun the
check; a sanitized working copy cannot fix sensitive content still in the index.
Intent-to-add entries and unresolved merge conflicts must be resolved first.

After creating the intended release commit, check that exact commit or tree:

```bash
npm run release:check -- --tree <release-commit-sha>
```

The checker resolves the revision once and reports the inspected tree ID. A
failure to resolve, list, or completely read a candidate fails the check. Binary
blobs are scanned for the same secret byte patterns as text. Symlink target
strings are scanned without following links; submodules are rejected because
their contents are outside the inspected tree. A single Git output or blob over
64 MiB also fails inspection and requires deliberate review/tooling before release.
Local Git replacement refs cannot substitute different content, and missing
objects are not fetched automatically from a remote.

The targeted privacy scan rejects common provider credentials (including AWS,
GitHub, Google, Slack, Twilio, and supported model providers), private-key
headers, credential-bearing URLs, likely literal secret assignments, personal
home-directory paths, and explicitly labelled customer identifiers. Synthetic
placeholders and common CI/service-user homes are exempted to reduce false
positives; every exemption still requires human review before publishing.

Private `.env` files are forbidden at every depth, including `app/.env` and
`app/.env.production`; `.env.example` is the deliberate safe exception, and its
contents are still scanned. Runtime-data restrictions and required public
documents apply to the selected index/tree. This check does not inspect every
commit in Git history; scan history separately before making that claim. It is a
targeted pattern check, not a guarantee, privacy certification, or substitute
for manual review. It does not unpack archives, decrypt content, infer encoded
or split credentials, inspect generated build output that is absent from the
selected Git candidate, or prove that all personal/customer information has
been removed.

Do not force-add ignored files. The
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

## 6. Version and release notes

- Update `package.json` and the root package entry in `package-lock.json` to the
  same semantic version before tagging.
- Add a dated entry to `CHANGELOG.md` describing user-visible behavior,
  boundaries, and verification—not internal implementation detail alone.
- For `v0.4.0-alpha`, mention the verified delivery lifecycle, exact evidence
  fingerprints, durable execution ownership, restart-safe merge intent, and
  stronger dependency and skill boundaries.
- State clearly that this remains an alpha, a local-first single-user control
  plane, and that no model comparison chooses or merges a winner automatically.
