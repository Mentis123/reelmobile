# Reel Mobile

A mobile-first browser fishing game about one body of water that stretches away from you to a far shore.

Single water. Ambient. Tactile. Mysterious. The fish are not labelled. The water is not transparent. **Distance is the game.** Close in, the water is clear and a cast lands where you put it. Far out, near the other shore, the water goes dark — you see movement, not fish, and a long cast scatters instead of placing. You read the surface across that distance, decide whether to wait for a fish to come into clear water or gamble a long blind cast into the dark, and — when it works — reel the unknown back in until you can finally see what you hooked.

## Status

**Playable.** The core loop ships: cast, twitch, bite, hook, fight, land (or snap). Five procedural species, the far-water distance mechanic with accuracy and visibility falloff, the reveal (size/shape/identity resolve as a fish is reeled into clear water), trophy Caught screen with real art, cross-session journal, share cards, gear (two rods, three lures), and a PWA shell with offline support.

Current tag: **`v0.4-far-water-candidate`** — awaiting the human iPhone feel gate per `docs/goalpack/13_CHECKPOINTS.md`. Candidates are agent-created after automated validation; only a human on a real device creates `*-approved` tags. Later chapters (catch arc, reveal, gear) shipped as slices on this candidate and clear with the same gate.

## Quick start

```bash
pnpm install
pnpm dev
```

Then open `/dev` on your laptop — it shows the local network URL as a QR code. Scan it with an iPhone to play on real glass, which is the only test that counts.

## Routes

| Route      | What it is                                                        |
| ---------- | ----------------------------------------------------------------- |
| `/`        | Landing                                                           |
| `/game`    | The game (`?seed=` for a fixed pond, `?debug=1` for the HUD)      |
| `/journal` | Cross-session catch history                                       |
| `/tune`    | Live constant browser sourced from `tuning.ts` (dev only)         |
| `/dev`     | QR code, current candidate tag, manual gate checklist             |

## Scripts

| Script           | What it does                                          |
| ---------------- | ----------------------------------------------------- |
| `pnpm dev`       | Dev server (regenerates the service worker first)     |
| `pnpm build`     | Production build (also regenerates the SW)            |
| `pnpm lint`      | ESLint via `next lint`                                |
| `pnpm typecheck` | `tsc --noEmit`                                        |
| `pnpm test`      | Node unit tests (`tests/unit/*.test.mjs`)             |
| `pnpm test:e2e`  | Playwright smoke tests (mobile viewport)              |

## Documentation

- `docs/goalpack/` — the design pack. Every decision lives here; start with `00_OVERVIEW.md`, then follow its reading order. `20_ROADMAP.md` is the current chapter sequence.
- `docs/ARCHITECTURE.md` — how the code is shaped: module map, the two state machines, the runtime-ref contract, the frame pipeline, persistence, PWA.
- `docs/VALIDATION.md` — how to validate a build: automated tests, the debug HUD, the on-device gate, Lighthouse budgets.
- `docs/CODEBASE_EVALUATION_AND_RECOMMENDATIONS.md` — an honest audit of the codebase with prioritized recommendations.
- `AGENTS.md` — agents read this first.
- `DEVLOG.md` — what shipped, what got cut, what we learned, per milestone.

## Deploy

Vercel. `main` auto-deploys.
