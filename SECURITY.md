# Security policy

## Security boundary

Orbit Community is a single-user, local-first application. Its control plane
binds to `127.0.0.1` by default. It is not designed to be exposed directly to
the public internet or used as a multi-user server.

Credentials remain in the ignored local `.env` file. Repository paths, run
history, worktree locations, project memory, imported skills, and backups are
runtime data and must remain outside Git. Use `ORBIT_DATA_DIR` to keep a
personal profile outside the source checkout.

Cloud providers and remote channels are opt-in integrations. Their use sends
only the task context needed by that provider; users remain responsible for the
credentials and data they choose to connect.

## Reporting a vulnerability

Do not publish security vulnerabilities in public issues. Until a dedicated
contact channel is available, report them privately to the project maintainer
through GitHub. Include reproducible steps, affected version, and impact. Do
not include real credentials or private repository contents in the report.

## Secrets

Orbit is designed to run locally. Never commit `.env`, personal access tokens,
OAuth credentials, private repository paths, or execution logs containing
sensitive information.

## Safe disclosure expectations

- Do not create a pull request that demonstrates exploitation of another
  person's credentials or repository.
- Do not add a feature that bypasses worktree review, local-origin checks, or
  explicit skill approval.
- Maintain compatibility with Node.js `^20.19.0 || >=22.12.0` and run the verification
  commands in the README before disclosure-related fixes are submitted.

## Release checks

Run `npm run security:check` before every public release. It audits production
dependencies and verifies that the files Git would publish do not include local
profiles, credentials, runs, skills, logs, or backups. This check does not
upload code or contact any configured AI provider.

## Security Center evidence limits

Opening Security Center performs a local scan, not a new dependency audit.
Each completed npm audit retains the repository fingerprint from when it
started. Changed or incomplete evidence stays stale across subsequent openings
and local-only refreshes. Previous critical findings remain blockers until a
successful fresh audit resolves them; malformed reports cannot count as clean.

Source/configuration reads are bounded to 160 KB per file. Unreadable files,
skipped symlinks, truncated files, and traversal limits produce incomplete
coverage, not a clean scan. Registry configuration such as `.npmrc` is inspected
without returning matched credentials. Private `.env` contents are not read.
Privacy review acknowledgments are invalidated when scanned evidence changes,
including Markdown and HTML policies, and cannot clear incomplete coverage.
These checks are heuristic evidence, not a penetration test, legal opinion,
or compliance certification.
