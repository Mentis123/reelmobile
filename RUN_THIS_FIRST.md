# RUN_THIS_FIRST

Use this Goal Pack as the starting contents of a fresh local repo.

## Recommended local setup

```bash
mkdir reel-mobile
cd reel-mobile
# unzip this pack into the current folder so AGENTS.md is at repo root
# then:
git init
git add .
git commit -m "Add Reel Mobile Goal Pack"
```

Then open Codex CLI from the repo root and paste the Phase A `/goal` prompt from `GOAL_COMMAND.md`.

## Important

Do not unzip this pack into an existing production repo.
Use a fresh repo with no production secrets.

Phase A intentionally builds only:
- M0 shell
- M1 vertical slice

It must stop after `v0.1-vertical-slice-candidate` for real iPhone review.
Only a human creates `*-approved` tags.
