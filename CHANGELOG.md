# Changelog

All notable community-facing changes are recorded here. Orbit follows semantic
versioning while it remains in alpha: minor versions add capabilities; patch
versions repair behavior without expanding scope.

## Unreleased

- Added Claude SEO as an upstream **Recommended Skill** reference. It remains
  inspect-first and opt-in; Orbit does not bundle it, install its runtime,
  configure credentials, or authorize external services automatically.

## v0.3.0-alpha — 2026-09-26

### Added

- **Project Intelligence** workflows for focused features, verification repair,
  launch-readiness evidence, safe skill review, and model comparisons.
- A **Project Brain** action that adds goals, decision, risk, and runtime
  sections without removing existing local notes.
- A read-only **Compatibility Scanner** for detected agent instruction files,
  project skill locations, MCP configuration filenames, and GitHub Actions
  workflow signals. It never returns configuration contents or credentials.
- A **Model Lab** that runs a bounded task through two or three selected
  providers and summarizes verification evidence, attention signals, changed
  files, and estimated cost.

### Safety boundary

- Workflows are starting scopes, not automatic execution or approval.
- Model comparisons do not declare a winner, merge changes, install software,
  expose a repository, or change provider access automatically.
- Project Brain and compatibility data stay local and use the existing
  worktree, skill-approval, and human-review boundaries.

### Verification

- `npm test`
- `npm run security:check`
- `git diff --check`

## v0.2.0-alpha

- Safe agent runtime, delivery review evidence, independent reviewer controls,
  and bounded approved skill handling.

## v0.1.0-alpha

- Initial public alpha release.
