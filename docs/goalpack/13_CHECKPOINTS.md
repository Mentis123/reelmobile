# 13_CHECKPOINTS

Git tags are the rollback substrate. Every milestone gets two tags: a candidate (agent-created) and an approved (human-created).

## Tag naming

```
v0.0-shell-candidate
v0.0-shell-approved        ← only humans write these
v0.1-vertical-slice-candidate
v0.1-vertical-slice-approved
v0.2-pond-candidate
v0.2-pond-approved
v0.3-fish-variety-candidate
v0.3-fish-variety-approved
v0.4-gear-candidate
v0.4-gear-approved
v0.5-journal-candidate
v0.5-journal-approved
v0.6-audio-candidate
v0.6-audio-approved
v0.7-share-candidate
v0.7-share-approved
v0.8-performance-candidate
v0.8-performance-approved
```

## Agent tag policy

- Agent **may** create `*-candidate` tags after layer 1 + 2 validation passes.
- Agent **may not** create `*-approved` tags. Ever. For any reason.
- Agent **may not** delete tags. Ever. For any reason.
- Agent **may not** force-push. Ever. For any reason.
- If `*-approved` tag is missing for a milestone, that milestone is **not done**, regardless of what `DEVLOG.md` says.

## Human tag policy

- Human creates `*-approved` after Layer 3 (manual real-device test) passes.
- Human is the only authority that can move from candidate to approved.
- Human may delete or move candidate tags if rolling back; approved tags should be preserved as historical record.

## Rollback procedure

If a milestone corrupts feel or fails badly:

```bash
# Identify last good approved tag
git tag --list "*-approved"

# Reset to it
git checkout v0.X-name-approved
git checkout -b recovery/from-vX.Y

# Cherry-pick or re-prompt from there
```

The agent should not roll back unilaterally. Rollbacks are a human decision documented in `DEVLOG.md`.

## Branch strategy

- `main` = production, deploys to Vercel
- `develop` = active milestone work (or work directly on `main` for solo build)
- Feature branches per milestone: `m1-vertical-slice`, `m2-pond`, etc. (optional)

For a solo agentic build, working directly on `main` with strict tag discipline is acceptable. The tags are the milestone history.

## Commit discipline

Agent commits at logical units of work, not per file. Reasonable cadence:

- One commit per "subsystem touched" (e.g. "M1: implement Verlet rope line")
- Commit message format: `M<n>: <imperative summary>` then body explaining what and why
- Reference Goal Pack docs in commit body where relevant

Avoid:
- Single mega-commits per milestone
- Many tiny formatting commits
- Force-push, rebase of pushed history

## DEVLOG entries vs commits

Commits track *what changed*. `DEVLOG.md` tracks *what shipped, what got cut, what we learned*. Both required.
