# Safe public demo script

Use the built-in **Example project**. Do not use a client project, real GitHub
repository, private prompt, API key, run history, or personal profile in a
recording.

1. Start from a new external `ORBIT_DATA_DIR`, or temporarily use the safe
   default profile created from `data/projects.example.json`.
2. Run `npm run doctor` to show local prerequisites without revealing any key.
3. Run `npm run dev:orbit` and create a local demo profile.
4. Open the Example project and show its empty, safe state.
5. Show provider detection without connecting an account or exposing a token.
6. Explain the flow: request → isolated worktree → test/visual evidence →
   Executive Inbox → human approval.
7. Show `npm run release:check` passing to demonstrate that local state and
   credentials are excluded from the public source.
8. If demonstrating deployment, open **Deploy**, point out that unavailable
   providers reveal only the missing local configuration name (never a token),
   then close the picker without publishing anything.

End with the local-first security boundary: Orbit is a single-user control
plane on `127.0.0.1`, not an internet-exposed autonomous deployment service.
