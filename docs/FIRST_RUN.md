# First run

Orbit runs on your computer. It does not require an account or a cloud database
for the local edition.

1. Install Node.js `^20.19.0 || >=22.12.0` and Git on macOS.
2. Run `npm install`, then `npm run doctor`.
3. Run `npm run dev:orbit` and open `http://127.0.0.1:5173`.
4. Create a local profile. This is a workspace identity, not a password-based
   account.
5. In **Settings**, review available providers. Connect only the models you
   intend to use. Provider keys stay in the ignored local `.env` file.
6. Create a project, then choose a local Git repository. Review the selected
   folder and optional GitHub mirror before saving.
7. Send a small, reversible request first, such as asking for a test plan or a
   one-file copy change.
8. Review the isolated worktree, changed files, and test result. Approve a
   merge only after you have inspected the result.

## Recommended safe defaults

- Keep automatic provider routing enabled, but start cloud providers in their
  planning/review mode.
- Use Ollama only for small, local tasks your computer can handle.
- Treat imported skills as untrusted until you inspect and approve them.
- Selecting a skill activates its complete reviewed package for that run. Codex
  and Claude use their native project-skill folders; other models receive the
  same bounded package as context. Installed skills are never activated merely
  because they exist in the local library.
- Keep Telegram and WhatsApp disabled until you have configured their explicit
  authorization settings.
- Use `ORBIT_DATA_DIR` for a personal profile outside the source checkout.

## If a provider is unavailable

Open **Settings** and follow the connection card. Orbit will report whether a
CLI, local model, or API key is missing. Do not paste a key into a prompt,
skill, issue, or chat transcript.
