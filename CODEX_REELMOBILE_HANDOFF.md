# Reel Mobile Codex Handoff

Project path:

`/mnt/c/Users/Adam Rappaport/OneDrive - DATA#3 LIMITED/Fishing/reelmobile`

GitHub remote:

`https://github.com/Mentis123/reelmobile.git`

Current setup notes:

- The repo has been cloned into the OneDrive project folder.
- `origin/main` points at `Mentis123/reelmobile`.
- Codex feature `goals` has been enabled in `~/.codex/config.toml`.
- Codex feature `image_generation` is enabled.
- `/goal` may require starting a fresh Codex session before the slash command appears.
- For Reel Mobile build-time art, use the built-in Codex `image_gen` path by default.
- Runtime OpenAI image generation is not needed unless the app itself must generate art for users.

Suggested first prompt in the next session:

```text
Use /goal for the Reel Mobile project in:
C:\Users\Adam Rappaport\OneDrive - DATA#3 LIMITED\Fishing\reelmobile

The repo is Mentis123/reelmobile and deploys to reelmobile.vercel.app.
It already has Neon DB and Blob connected through Vercel.
Use build-time image generation for game assets, not runtime generation, unless I say otherwise.
```

Tiny note:

There should also be a little visual surprise in this repo root once the image smoke test is complete.
