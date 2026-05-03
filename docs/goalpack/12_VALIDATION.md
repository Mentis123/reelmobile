# 12_VALIDATION

Three layers: **automated**, **instrumented**, **manual**. All three required per milestone.

## Layer 1 — Automated

Run before any milestone is declared candidate-complete:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test          # unit tests where they exist
pnpm test:e2e      # Playwright smoke tests
```

All must exit 0.

## Layer 2 — Instrumented

Smoke tests via Playwright (mobile viewport emulation):

- App loads at `/game` without console errors
- Tap-to-begin gate appears within 1s
- Single tap dismisses gate
- Canvas renders (non-zero pixel data)
- Debug HUD visible with `?debug=1`
- HUD shows FPS > 0, game state = `scouting`
- Simulated drag-release triggers cast (game state transitions to `casting` → `lure_idle`)
- No GL errors in console
- `webglcontextlost` and `webglcontextrestored` event handlers registered

Playwright cannot validate feel. Do not trust it for that.

## Layer 3 — Manual (the real gate)

**On a real iPhone**, via the QR-code `/dev` page.

### Manual checklist — Phase A (M1)

Score each yes/no. Need **8 of 10 yes** to approve.

1. Within 10 seconds of tapping in, do I understand what I'm supposed to do?
2. Within 3 seconds of trying, can I successfully cast?
3. Do I see at least one ambiguous fish-like cue (shadow, ripple, glint) within 15 seconds?
4. When my lure splashes near a cue, does something react believably?
5. Does the bite moment register clearly (audio + visual)?
6. When I successfully hook, does it feel decisive?
7. During the fight, does the line tension communicate clearly through the line itself (not just the HUD)?
8. Does at least one failure mode (snap, escape, miss) feel learnable rather than buggy?
9. Does the result screen tell a tiny story rather than show stats?
10. After one full cycle, do I want to cast again?

If fewer than 8 are yes, **do not approve.** Identify the broken mechanic, write to `DEVLOG.md`, re-prompt agent targeted at the failure, retest.

### Manual checklist — Phase B milestones

Each milestone has its own checklist. Examples:

**M2 (Pond visuals):**
- Does the pond look like the art direction describes?
- Does it run at 60fps on iPhone 13?
- Does focus mode visibly affect water glare?
- Are reeds, dock, and water visually coherent?

**M3 (Fish variety):**
- Can I distinguish 5 species by silhouette alone?
- Do their cue signatures differ noticeably?
- Do two of the same species feel slightly different?

**M5 (Journal):**
- Does my catch persist across page reloads?
- Does the journal load fast (<500ms)?
- Do entries read like stories not data dumps?

(Full checklists per milestone in `16_HUMAN_GATES.md`.)

### What manual cannot validate

The agent's automated tests cannot tell if:
- The water "feels alive"
- The cast "feels right"
- The bite is "satisfying"
- The fish "behaves believably"
- The session "makes me want to come back"

These are the actual game. Only humans can answer them. Only on real devices.

## Failure protocol

If validation fails (any layer):

1. Agent writes failure details to `DEVLOG.md`
2. Agent attempts one fix
3. If fix fails second time, **stop**. Do not attempt third fix.
4. Request human review. Do not proceed past the failed milestone.

## What "approved" means

The agent creates `vN.M-name-candidate` after passing layers 1 + 2.

A human creates `vN.M-name-approved` after passing layer 3 on a real device.

**The agent never creates `*-approved` tags.** Even if asked. Even under "make progress" pressure. Approved is a human signature.
