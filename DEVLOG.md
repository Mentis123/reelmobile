# DEVLOG

Append after every milestone. Format:

```
## vX.Y-name (YYYY-MM-DD)
**Shipped:**
- ...
**Cut:**
- ...
**Discovered:**
- ...
**Next:**
- ...
```

---

## v0.0-init (pending)
**Shipped:**
- Repo skeleton
- Goal Pack docs
**Cut:**
- N/A
**Discovered:**
- N/A
**Next:**
- M0: Next.js shell + Vercel deploy + `/dev` QR page

---

## v0.0-shell (blocked, 2026-05-03)
**Shipped:**
- Copied the active repo from the OneDrive path into native WSL at `/home/mentis/reelmobile` to avoid `#` path breakage in JS tooling.
- Drafted the M0 Next.js App Router shell, TypeScript config, pnpm manifest, Vercel config, `/`, `/game`, `/tune`, `/dev`, local IP API, QR-code dev gate, and manual checklist rendering.
- Added Node unit test and Playwright shell smoke test scaffolding.
- Passed `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` in `/home/mentis/reelmobile`.

**Cut:**
- No candidate commit or `v0.0-shell-candidate` tag was created because Layer 2 Playwright validation did not pass.
- Milestone 1 was not started.

**Discovered:**
- The original project path `/mnt/c/Users/Adam Rappaport/OneDrive - DATA#3 LIMITED/Fishing/reelmobile` breaks tooling that treats `#` as a URL fragment. In that path, Vitest could not resolve Vite internals and Next production builds failed in both output tracing and the React Client Manifest.
- Native WSL path fixes the Next production build.
- `pnpm test:e2e` failed first because Playwright WebKit was not installed.
- After installing WebKit, Playwright reported missing WSL host libraries and `pnpm exec playwright install-deps webkit` failed because sudo requires an interactive password.
- A Chromium mobile-viewport fallback also failed because the WSL host is missing browser libraries (`libnspr4`, `libnss3`, `libasound2t64`).
- This is the second failure of the M0 Playwright validation check, so work stopped per `12_VALIDATION.md`.

**Next:**
- Human review required. Install Playwright browser dependencies in WSL with sudo, then re-run M0 validation from `/home/mentis/reelmobile`.
- Suggested command: `sudo pnpm exec playwright install-deps`

---

## v0.0-shell-candidate (2026-05-03)
**Shipped:**
- Next.js App Router + TypeScript + pnpm scaffold in native WSL path `/home/mentis/reelmobile`.
- Vercel-ready `vercel.json`, Next config, lint/typecheck/test/build scripts, and lockfile.
- `/`, `/game`, `/tune`, and `/dev` routes.
- `/dev` shows local network URL, QR code, current candidate tag, M0/M1 manual checklists, and a copyable human approval command.
- M0 validation passed: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.

**Cut:**
- `/game` and `/tune` remain placeholder routes until M1, per M0 scope.
- No `*-approved` tag was created.

**Discovered:**
- The OneDrive path containing `#` is unsafe for this Next.js toolchain; native WSL path is required for reliable builds.
- WebKit Playwright works after human-installed WSL browser dependencies.
- Next dev server can trigger reloads during first route compilation, so the shell smoke test opens each route in a fresh page.

**Next:**
- M1 vertical slice: grey-box pond, casting, lure, fish cues, rope line, bite/fight/failure loop, procedural audio, telemetry hooks, debug HUD, and `/tune` constants.

---

## v0.1-vertical-slice (blocked, 2026-05-03)
**Shipped:**
- Drafted the M1 grey-box vertical slice locally: `/game` mounts a mobile-first R3F pond with fixed camera, dock, water plane, fish shadow cue, lure, drag/release casting, dotted preview, Verlet line, rod bend, debug HUD, WebGL context handlers, procedural Web Audio, telemetry hooks, session store, and result copy.
- Added `src/game/tuning/tuning.ts` and moved gameplay feel constants there.
- Added hand-rolled TypeScript game and fish discriminated unions.
- Added `/tune` constant browser sourced from `tuning.ts`.
- `pnpm typecheck`, `pnpm lint`, and `pnpm build` passed after fixing the App Router Suspense boundary.

**Cut:**
- No M1 commit or `v0.1-vertical-slice-candidate` tag was created because Layer 2 Playwright validation did not pass.
- No Phase B work was started.
- No remote push succeeded; HTTPS git credentials are not configured in WSL and the installed `gh` binary is not executable in this environment.

**Discovered:**
- First M1 `pnpm build` failed because `/game` used `useSearchParams()` without a Suspense boundary. Fixed and reran successfully.
- First M1 `pnpm test:e2e` failed because WebKit touch did not synthesize the splash button click while root touch protections were active. Added pointer-down unlock handling and reran.
- Second M1 `pnpm test:e2e` failed because the SVG rod path hydrates differently on server and client: server path rendered as `M 0 0 Q 0 0 0 0`, client path rendered from real viewport dimensions.
- This is the second failure of the M1 Playwright validation check, so work stopped per `12_VALIDATION.md`.

**Next:**
- Human review required before another M1 validation attempt.
- Likely fix: defer the SVG rod/line overlay render until after client mount or store viewport dimensions in React state initialized after hydration.
- Configure GitHub push credentials in WSL via working `gh auth login` + `gh auth setup-git`, or switch `origin` to SSH after adding an SSH key to GitHub.

---

## v0.1-vertical-slice-candidate (2026-05-03)
**Shipped:**
- Mobile-first `/game` vertical slice with Tap-to-begin audio/session unlock, iOS touch protections, fullscreen/orientation attempts, and portrait overlay.
- Grey-box R3F pond with 3D water plane, dock, fixed camera, ambiguous fish shadow, periodic real/false ripple cues, lure splash/sink/twitch, drag/release casting, dotted preview, and 10-segment Verlet line.
- Hand-rolled TypeScript game and fish discriminated unions, tension system, rod bend, line colour/width changes, high-tension ripple/splash intensity, bite window, hook success, missed early, missed late, snap, escape, catch, and story result screen.
- Procedural Web Audio implementation for ambient, cast, plop, twitch, nibble, hook, zip, reel, splash, snap, catch, and escape events.
- Telemetry `track()` hook wired to session start, cast, bite, hook attempts, catch, failures, WebGL context loss/restore, and pixel-ratio degradation.
- Debug HUD toggled by `?debug=1` or two-finger tap showing FPS, draw calls, triangles, texture count, heap, game/fish/lure state, tension, seed, and pixel ratio.
- `/tune` page browses hot-reloadable constants from `src/game/tuning/tuning.ts`.
- WebGL context loss/restore handlers and pixel-ratio degradation logic.
- M1 validation passed: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.

**Cut:**
- Final art, generated assets, multiple species, journal, share cards, PWA polish, accounts, economy, upgrades, day/night, weather, and Phase B scope.
- Real iPhone feel approval. Agent created only the candidate tag; human review remains required.

**Discovered:**
- The initial M1 hydration mismatch came from server-rendering viewport-projected SVG rod geometry. Deferring viewport-projected overlay render until after client mount fixed it.
- WebKit tap synthesis is sensitive to root `touchstart.preventDefault()`. The splash gate now starts on pointer/click and root touch prevention skips the splash button so the first tap reliably dismisses.
- The `/game` first-load JS is about 311 kB, comfortably under the M1 bundle budget.

**Next:**
- STOP for human review on a real iPhone through `/dev` QR.
- Human should use the 10-question Phase A checklist and create `v0.1-vertical-slice-approved` only if the real-iPhone test scores at least 8 of 10.
