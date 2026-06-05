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

---

## Phase A human review feedback (2026-05-04)
**Tested:**
- URL: `https://reelmobile.vercel.app`
- Device/browser: iPhone 16 Pro, iOS 18.7, Chrome on iOS.
- Score: about 5/10 on the Phase A checklist.

**Shipped:**
- First-tap comprehension, casting, fish cue visibility, bite clarity, learnable failure, and story result are partially or fully working.
- Latest tested build includes post-candidate remote fixes for bite/reel feedback, cast-again reset, sharper bite cue, surfaced fish shadow, and smaller bite halo.

**Cut:**
- No approval tag was created.
- No Phase B work should begin.

**Discovered:**
- Fish cue is visible, but the fish shadow does not correlate with bite reality; lure-near-fish reaction feels disconnected.
- Bite clarity is currently carried by explicit `Tap!` and red ring UI. Desired direction is less permanent training UI and more lure tugging/physical motion.
- Hooking is legible because the tension HUD appears, but it does not yet feel decisive.
- Fight tension reads mostly as HUD; line color shift is not enough to communicate load through the line itself.
- High-tension/reel audio becomes staticky and unpleasant. Desired direction is clicky reeling noise that only escalates near peak tension.
- The loop is not yet connected enough to feel like a lived fishing moment or strongly invite repeat casting.
- Cast preview currently projects from the touch point instead of the rod/casting point.
- Cast preview can imply dock-distance reach that the actual cast does not achieve, creating a mismatch between aim preview and landing result.

**Next:**
- Treat the next candidate as an M1 feel-repair pass, not Phase B.
- Prioritize spatial truth: fish cue, lure, bite origin, reaction, and cast preview should describe the same underlying world state.
- Prioritize physical feel over HUD: hook impact, lure tugging, line load, rod bend, and audio should communicate the loop before UI labels do.

---

## M1 feel-repair pass (2026-05-04)
**Shipped:**
- Synced local `main` to the Claude-fixed remote `main` before making new changes.
- Cast preview now starts from the rod tip and ends at the same computed/clamped world target the lure will use on release.
- Fish cue is now an oval shadow that grows more visible during commit/bite states.
- Bite now creates paired fish/lure ripples and physically tugs the lure during the bite window.
- Successful hook now adds a short rod/line jerk, lure jerk, and paired ripples to make the hookset feel more decisive.
- Reel audio now uses softer click-led feedback, with line strain only rising near high tension instead of a harsh low-threshold sawtooth.
- New feel constants were added to `src/game/tuning/tuning.ts`.

**Cut:**
- No Phase B work.
- No approval tag.
- No new candidate tag yet; this pass should deploy from `main` for another real-device feel review first.

**Discovered:**
- Running `pnpm typecheck` concurrently with `pnpm build` can race against regenerated `.next/types` and produce transient missing generated-file errors. Serial rerun after build passes.

**Next:**
- Test the deployed `main` again on iPhone 16 Pro / iOS 18.7 / Chrome on iOS against the same 10-question checklist.
- Pay special attention to items 3, 4, 6, 7, 8, and 10.
- If this feels closer, decide whether to tag a new `v0.1.x-*-candidate` for formal human review.

---

## M1 real-device bugfix pass (2026-05-04)
**Shipped:**
- Recorded iPhone 16 Pro / iOS 18.7 / Chrome on iOS feedback with screenshot showing lure/line state after repeated taps.
- Missed-late bite flow now resolves to an explicit miss result instead of silently returning to casting.
- Touching during the late-bite grace window now resolves the late miss instead of beginning another cast.
- Repeated lure twitch taps are clamped to fishable water so the lure cannot walk up onto the dock.
- Cast targets are clamped to the same fishable-water bounds as lure twitching.
- Rope visual tension now stays slack longer and only pulls straight near high tension.
- Reel audio uses the earlier click/noise character again while keeping continuous line strain gated to high tension.

**Cut:**
- No Phase B work.
- No approval tag.
- No pole-drag lure manipulation yet.

**Discovered:**
- The cast/twitch input model still conflates screen touch intent: tap-to-twitch, drag-to-cast, and future rod manipulation need clearer separation.
- The desired future mechanic is likely rod-tip manipulation after the lure is in water, where dragging the rod/pole changes line load and pulls the lure without recasting.

**Next:**
- Retest deployed `main` on the same iPhone/Chrome setup.
- Evaluate whether late misses now feel learnable and whether line slack/tautness better communicates the happy tension range.
- Consider a later M1 input refinement: touch the rod/handle to manipulate rod tip, touch water/drag from idle to cast.

---

## M1 result/audio clarity pass (2026-05-04)
**Shipped:**
- Result overlay no longer dismisses from tapping anywhere on the card.
- Result dismissal is locked for `TUNING.timing.resultDismissLockMs`, then only the `Cast again.` button can reset.
- Catch result copy now starts with `Caught.`; failure result copy starts with `Missed.`, `Lost.`, or `No fish.`.
- Splash begin now triggers from pointer release/click instead of pointer down and plays an immediate confirm tone after Web Audio unlock.
- Ambient pond noise is louder and less flat so audio should be present immediately after unlock, before the first bite.

**Cut:**
- No Phase B work.
- No approval tag.

**Discovered:**
- Tapping to reel makes accidental result-card dismissal likely unless the card ignores non-button taps.
- iOS Chrome audio unlock is more reliable when the splash action completes on release/click rather than pointer down.

**Next:**
- Retest deployed `main` on iPhone 16 Pro / iOS 18.7 / Chrome on iOS.
- Confirm audio is audible immediately after the splash tap and that catch/failure outcomes are unambiguous.

---

## M1 catch/snap race fix (2026-05-04)
**Shipped:**
- Catch outcome now wins cleanly if landing and snap threshold happen on the same frame.
- Result handling is idempotent so a second outcome cannot overwrite or add audio after the first result.
- Result handling stops line/reel loops before playing catch/failure sounds and resets stored tension to zero.

**Cut:**
- No Phase B work.
- No approval tag.

**Discovered:**
- At the catch/snap boundary, high-tension audio could leak into an otherwise successful `Caught.` result.

**Next:**
- Retest one final deployed build and, if the real-device checklist is good enough, call M1 complete for this candidate cycle.

---

## Phase A human testing complete (2026-05-04)
**Shipped:**
- Phase A M0 shell and M1 vertical slice candidate cycle completed with repeated real-device testing on iPhone 16 Pro / iOS 18.7 / Chrome on iOS.
- Final repair pass resolved the reported catch/snap audio race before closing the session.
- Repo is ready for a fresh session and next goal context after this pass is pushed.

**Cut:**
- No Phase B work.
- No human `*-approved` tag was created in this agent session.

**Discovered:**
- The core M1 loop is good enough to stop this candidate cycle and move planning/work into a new session.

**Next:**
- Start a new session with the next explicit goal.
- Use this DEVLOG and latest `main` as the starting point.

---

## v0.1.5-rod-control-candidate (2026-05-04)
**Shipped:**
- Synced `main` after `v0.1-vertical-slice-approved` and stayed inside Phase A feel refinement; no Phase B art started.
- Added post-cast rod/handle touch detection that enters `rod_control` instead of recasting.
- Split post-cast water input so taps twitch, rod drags manipulate the rod, and water drags still cast only after movement intent is clear.
- Rod-tip manipulation now bends/moves the rod, raises line load, pulls the lure through the water, flashes the lure, and feeds the existing tension visuals.
- Slack/sweet/danger feedback now reads through line colour/width, rod bend, tension bar, lure motion, and click/strain audio thresholds.
- `/dev` now exposes an M1.5 rod-control real-iPhone gate with checklist items targeted at rod manipulation and tension readability.
- Added Playwright smoke coverage for drag-release cast followed by rod-control drag returning to `lure_idle`.
- M1.5 validation passed: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.

**Cut:**
- No Phase B art, generated assets, new fish species, gear systems, journal, economy, or onboarding UI.
- No approved tag. Human iPhone review remains the gate.

**Discovered:**
- The approved loop already had enough tension plumbing to reuse for rod load; the main ambiguity was input intent, not another UI layer.
- Starting post-cast touches as pending intent avoids accidental recast/twitch ambiguity without removing water-drag recasting.
- Candidate metadata is injected in both `buildInfo.ts` and `next.config.mjs`; both must move together or `/dev` can show stale candidate data.
- Adding `m1.5` as a distinct milestone requires an explicit checklist entry; otherwise `/dev` falls back to M0.

**Next:**
- STOP for human iPhone review through `/dev` QR.
- Review whether dragging the visible rod/handle feels like pulling the lure, and whether slack/sweet/danger can be read before looking at the HUD.
- Human may create an approved tag only after real-device review passes.

---

## v0.1.5-hook-guard-candidate (2026-05-04)
**Shipped:**
- Guarded bite-window hook taps so a small finger move cannot promote the touch into a recast before pointer-up.
- Kept post-cast water drag recasting available only while the lure is idle and outside late-hook handling.
- Updated candidate metadata for `/dev` to point at the hook-guard follow-up candidate.

**Cut:**
- No Phase B art.
- No approved tag. Human review remains required for the final M1.5 follow-up.

**Discovered:**
- The recast-on-hook issue came from the pending post-cast touch path promoting movement to `aiming` without checking that the current state was still `lure_idle`.

**Next:**
- Recheck on iPhone that bite-window taps set the hook even with normal thumb drift, and that deliberate water drags still recast after the lure is idle.
- If that passes, human may create the approved tag for this follow-up before starting Phase B.

---

## v0.2-pond-candidate (2026-05-04)
**Shipped:**
- Started from latest `main` after human `v0.1.5-hook-guard-approved`.
- Added M2 core assets under `public/assets`: water normal texture, dock plank texture, generic fish sprite, default lure sprite, and SVG wordmark.
- Replaced grey-box water with a lightweight custom shader using depth fade, broad moonlight glints, normal-map ripples, and Focus-mode glare reduction.
- Replaced grey-box dock/fish/lure visuals with textured dock planks and transparent sprite planes while preserving the existing single-fish gameplay loop.
- Added instanced low-poly reeds, a painted far-bank card, and M2 `/dev` checklist/candidate metadata.
- Added press-and-hold Focus Water behavior using tunable constants in `src/game/tuning/tuning.ts`.
- Added M2 Playwright visual smoke coverage with mobile and portrait-desktop screenshots plus canvas pixel sampling.
- M2 validation passed: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.

**Cut:**
- Fish variety, gear variants, journal, economy, progression, map, weather, audio replacement, new systems, and any `14_DO_NOT_BUILD.md` scope.
- No `*-approved` tag. Human iPhone review remains the gate.
- Decorative art remains deliberately light: no extra rocks, particles, weather, or expanded environment detail.

**Discovered:**
- Running multiple WebKit canvas tests in parallel made the tap smoke flaky, so Playwright now runs the mobile Safari smoke project with one worker.
- The sandbox can report port 3000 as occupied without a visible `next dev` process after interrupted manual runs; Playwright now uses port 3001 to avoid that collision.
- The generated asset payload is small, about 68 KB total for M2 assets, and the scene stays within debug budget in automated smoke: 10 draw calls, 2,784 triangles, and 4 textures.
- Automated visual checks can prove the canvas is nonblank and framed, but they cannot judge whether the pond feels good on a real iPhone.

**Next:**
- STOP for human iPhone review through `/dev` QR.
- Review the M2 checklist on a real iPhone: visual coherence, iPhone 13 60fps target, Focus glare reduction, reed/dock/water palette fit, and preservation of the full fishing loop.
- Only a human may create `v0.2-pond-approved` after real-device review passes.

---

## v0.2-pond-illusion-candidate (2026-05-04)
**Shipped:**
- Addressed M2 human review feedback without adding new fish, gear, journal, economy, progression, map, weather, or systems.
- Moved water ripples from screen-space HTML rings into 3D ring meshes on the water plane so they inherit camera perspective.
- Recolored ripple cues from UI gold to moonlight/grey so surface disturbance does not read like HUD.
- Added a simple visual reel to the existing rod overlay; this is presentation only, not a gear variant.
- Increased the single generic fish patrol area and wander speed so it no longer lives in one obvious spot.
- Made fish shadow/cue visibility fade by pond depth and lowered base fish cue opacity so deeper water hides fish better.
- Enlarged and brightened the default lure sprite so it is readable after cast while preserving sink/twitch behavior.

**Cut:**
- Full strategic depth gameplay, lure-depth targeting, sonar-like visibility, fish variety, gear mechanics, and any roadmap expansion outside M2.
- No approved tag. Human review still owns approval.

**Discovered:**
- The previous screen-space ripple layer broke the pond illusion because it ignored the fixed camera angle.
- Fish perception needs depth-dependent visibility even before deeper depth strategy exists.
- Current lure sink is a vertical visual/feel component, not yet a strategic water-column system.

**Next:**
- STOP for human iPhone review through `/dev` QR.
- Specifically recheck ripple perspective, lure readability, fish cue subtlety, fish wandering breadth, rod/reel readability, and whether the pond still passes the M2 visual checklist.
- Consider depth-as-strategy in a later explicit milestone only after the pond visual gate is approved.

---

## v0.2-line-entry-fix (2026-05-04)
**Shipped:**
- During a hooked fight, reeling now pulls the fish/lure contact point toward the nearest fishable water under the rod so the line entry point closes distance.
- Kept the pull target clamped to fishable water so the fish does not slide under the dock.
- Added the reel contact pull speed to `src/game/tuning/tuning.ts`.

**Cut:**
- No new depth strategy, fish systems, gear variants, or roadmap expansion.
- No approved tag was created by the agent.

**Discovered:**
- The fight previously drained stamina but did not visually shorten the water-side line endpoint enough while reeling.

**Next:**
- Human may create the approved M2 tag locally after final live/prod check.

---

## v0.3-fish-variety-candidate (2026-05-04)
**Shipped:**
- Started from latest `main` at human `v0.2-pond-approved`.
- Added five seeded fish species by silhouette and behavior only: Bronze Carp, Moss Bass, Moon Minnow, Old Kingfish, and Reed Pike.
- Added per-instance `personality: -1..1` and applied the required +/-15% modulation to notice radius, fear radius, and bite/commit feel through species tuning.
- Added seeded spawn distribution so each cast advances the deterministic fish instance stream without increasing pond density.
- Added per-species cue signatures: bubbles for Carp, glints for Bass, surface rises and tail flashes for Minnow, silt for Kingfish, and wakes for Pike, while preserving seeded false cues.
- Updated catch/failure session context and result stories to record the active species after the encounter.
- Updated `/dev` candidate metadata and manual checklist for the M3 real-iPhone gate.
- M3 validation passed: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`.

**Cut:**
- No labels over fish while scouting, rarity UI, journal, gear variants, economy, progression, extra ponds, weather, or other `14_DO_NOT_BUILD.md` scope.
- No new raster fish assets; silhouettes reuse lightweight sprite scaling and low-cost surface cue meshes to protect Mobile Safari performance.
- No `*-approved` tag. Human review remains required.

**Discovered:**
- The approved one-active-fish loop is the right density for M3; adding simultaneous fish would risk crowding the pond and weakening perception.
- Species variety fits cleanly as tuning plus a small species layer, without replacing casting, rod control, bite, fight, failures, debug HUD, `/dev`, or `/tune`.
- Automated smoke can verify the loop still renders and plays, but only real-iPhone review can judge whether five silhouettes and cue signatures read distinctly.

**Next:**
- STOP for human iPhone review through `/dev` QR.
- Review the M3 checklist: five silhouettes, distinct cue signatures, same-species personality differences, fish density, and preservation of the M1/M2 fishing loop.
- Only a human may create `v0.3-fish-variety-approved` after real-device review passes.

---

## fix-fishing-game-yczS4 (pending)
**Shipped:**
- Switched the fishing line and rod tip overlay from a top-down `worldToScreen` approximation to a real `THREE.Camera.project` projection so the line endpoint visually matches the 3D lure mesh.
- Locked `lurePos` exactly to `fish.position` while hooked so the lure stays glued to the fish during the reel-in.
- Fish silhouette now slerps toward the heading derived from its velocity (with a `fishFacingMinSpeed` floor and `fishFacingTurnRate` for smoothing) so it always swims forward instead of moonwalking.
- Anchored the rod butt + reel to a fixed viewport-relative screen position (`rodScreenButtXRatio`, `rodScreenButtBottomMarginPx`) so the whole reel setup is visible inside Mobile Safari's chrome.
- Redesigned the rod stroke with a brown-to-gold gradient and redrew the reel as a layered hub + crank handle; the fishing line is now hidden during scouting/aiming/result so the idle pole no longer sports a white whisker on the tip.
**Cut:**
- No new physics for catenary sag — the verlet still runs in 2D `(x, z)` and we only add a sin-shaped y-axis sag at projection time.
**Discovered:**
- The previous `worldToScreen` projection was the root cause of every "line ends in the wrong place" bug; aim-preview dots still use it but they tolerate the offset.
**Next:**
- Real-device iPhone review of: (a) line/lure alignment during cast and fight, (b) fish heading through wander/inspect/flee, (c) full reel visibility under Safari's bottom toolbar, (d) idle pole presentation.

---

## fix-fishing-rod-casting-2rWqS (pending)
**Shipped:**
- Re-centered the rod butt anchor from the bottom-right corner (`rodScreenButtXRatio: 0.78`) to bottom-middle (`0.5`) and brought it closer to the bottom edge (`rodScreenButtBottomMarginPx` 86 → 36) so the rod reads as a near-vertical first-person fishing pole instead of a diagonal stick floating from the corner.
**Cut:**
- No code restructuring — purely a tuning tweak; the screen-anchored butt + camera-projected tip pipeline from the prior candidate stays intact.
**Discovered:**
- The corner anchor + camera-projected tip combo created a long diagonal "rod from nowhere" silhouette; even though the line endpoint still met the rod tip exactly, the eye read the rod as detached from the scene and from the line.
**Next:**
- Real-device iPhone review: confirm the centered rod silhouette reads as held by the viewer, the reel/handle still sit comfortably above the bottom safe area, and the line continues smoothly off the rod tip during cast/fight.

---

## M3 human review feedback (2026-05-12)
**Tested:**
- URL: `https://reelmobile.vercel.app` after M3 candidate ship.
- Score: M3 checklist failed on silhouettes, personality, and fight feel.

**Discovered:**
- Five species couldn't be told apart by silhouette: shared `fish_generic.webp` sprite at five scales, not five distinct body shapes.
- `personalityModulation: 0.15` was too small to notice; same-species and cross-species encounters felt indistinguishable.
- Fight had no resistance: stamina drained smoothly during reeling with no fish-initiated surge against the player, so "I panicked. I nearly snapped the line" couldn't happen.
- Density (one active fish + paired cue layers) reads OK; not changing the spawn model.

**Next:**
- Treat as M3.1 feel-repair, not Phase B.
- Distinct silhouettes per species, stronger personality plumbing, fish-initiated fight surges, sharper cue signatures.

---

## v0.3.1-fish-feel-candidate (2026-05-12)
**Shipped:**
- Per-species silhouettes generated procedurally as CanvasTextures inside the scene; each species mesh now binds its own body shape (carp deep-bodied, bass mid-stocky, minnow small/forked, kingfish long+broad with twin fins, pike long+narrow with rear dorsal). No new raster assets.
- Personality scalar plumbing: `personalityModulation` 0.15 → 0.42, `personalityScalar` 0.08 → 0.18, and a new `personalityHesitation` curve modulates notice/inspect/commit/flee durations so cautious vs. bold fish read in timing as well as radius. Flee direction now uses personality and position sign.
- Fight surges: per-species `surgeInterval{Min,Max}Ms`, `surgeTensionSpike`, and `surgeAudioIntensity`. Pike surges hard and often; Kingfish surges deep and slow; Minnow flicks; Carp/Bass sit in between. Each surge spikes tension, boosts the fish's `rage`, plays a splash, and vibrates a new `fishSurge` haptic. Personality bias scales surge cadence.
- Rage decay during `hooked`: rage relaxes toward a personality-shaped baseline between surges so the fight modulates instead of holding constant.
- Stamina drain reduced (0.15 → 0.1) so the fight lasts long enough for surges to land.
- Sharper cue signatures: real-cue peak opacity 0.48 → 0.62, glint/tail-flash hold roughly doubled (`cueFlashDurationMultiplier` 0.18 → 0.32), silt opacity 0.58 → 0.78 of real-cue base, bubble trail bead count 3 → 4.
- `/dev` page exposes an `m3.1` checklist focused on body shape, surge feel, and personality variance.
- Candidate metadata (`buildInfo.ts`, `next.config.mjs`) advanced to `v0.3.1-fish-feel-candidate`.

**Cut:**
- No concurrent fish; spawn density unchanged. The one-active-fish + cue-layer perception model from M3 stays.
- No new raster art, no rarity/labels, no journal, no gear variants, no Phase B scope.
- No `*-approved` tag.

**Discovered:**
- Single shared sprite scaled by species was the dominant cause of "all fish look the same"; pushing more variance through the same plane never reads at a glance.
- Personality modulation under 0.2 is sub-threshold for a player making a 5–10 second judgement call. 0.4+ becomes a visible signal.
- Pure stamina drain produces no panic. Periodic fish-initiated tension spikes are what give "I nearly snapped the line."

**Next:**
- STOP for human iPhone review through `/dev` QR.
- Review the M3.1 checklist: silhouette legibility, cue clarity, same-species variance, surge feel during fight, loop preserved.
- Only a human may create `v0.3.1-fish-feel-approved` after real-device review passes.

---

## v0.3.1-fish-feel reconciled onto remote main (2026-05-12)
**Shipped:**
- Rebased the M3.1 candidate (silhouettes, personality plumbing, surges, sharper cues) onto `origin/main` at `b260f50` so it stacks on top of the 16 in-flight PRs that landed during the candidate cycle: PWA service worker, multi-fish + depth-fade, foreshore terrain, foreshore-gated fish, result-card freeze, linear cast drag, smaller rod, lure drift on rod-release, fish-wide pond roam, camera-projected line, and screen-anchored rod butt.
- Merged conflicting `tuning.ts` fish block by keeping M3.1's `personalityModulation: 0.42` + new personality/surge/rage constants AND the new `fishFacingMinSpeed`/`fishFacingTurnRate` from the rod-position PR.
- Merged `fleeTarget` (fishStateMachine.ts) by keeping M3.1's personality-biased x reach AND HEAD's `fishableMaxZ` z-clamp.
- Re-applied per-species silhouettes, surge scheduling, and sharper cue parameters into the GameClient rewrite landed by the PRs (camera projection, fixed rod anchor, multi-fish pool).

**Cut:**
- No new Phase B scope; no journal, gear, or rarity work added during reconciliation.

**Discovered:**
- The remote PRs partly overlap M3.1 territory: multi-fish (1–3 same-species, with depth fade) is now in place independently of M3.1's silhouette/personality work, so silhouette variety + same-species personality variance now apply across the small visible pool instead of just one active fish.
- PWA scope (M7) landed early via PR #16; the next planned milestones can lean on that.

**Next:**
- STOP for human iPhone review through `/dev` QR against the M3.1 checklist plus a sanity check that the PR work (PWA install, multi-fish density, foreshore framing, rod anchor) still feels right.

---

## v0.3.2-pond-polish-candidate (2026-06-01)
*Out-of-band visual-polish pass on the pond — not a Phase B milestone. First candidate built under the ratified ultracode amendment (`18_ULTRACODE_PARADIGM.md`): machine-checkable wiring self-verified by static artifact (greps below); feel/colour read is the canary and is deferred to the human iPhone gate. Co-tuned starting values are my best guess per "build my best co-tuned guess" — both directions are for the human to judge on glass.*

**Shipped:**
- **Deepened the pond water, co-tuned with fish opacity (the headline change).** New `TUNING.visual.waterDeep` `#2b4750` / `waterShallow` `#4a6f6a` — roughly halfway from the old `#3d6068`/`#6a958f` toward the `08_ART_DIRECTION` bible `#1a2b30`/`#2f4948`. *Partway, not all the way:* at full art-bible depth a near-black fish silhouette vanishes. To hold the read, `world.fishCueOpacity` nudged 0.40 → 0.46 in the **same diff** (recovers ~half the silhouette contrast the darker water costs; deep/shallow fade multipliers unchanged). The shader uniforms (`GameClient.tsx` `uDeep`/`uShallow`) now consume `TUNING.visual.*` and are **decoupled** from the `--water-deep`/`--water-shallow` `:root` CSS tokens, which still paint the loading screen, result card and tune page in the original teal.
- **Separated the water from the void.** Background and fog were *both* `#3d6068` — byte-identical to the old water, which is exactly why the pond dissolved into its surround. Pushed to `TUNING.visual.voidColor`/`fogColor` `#101c20` (ink). `fogNear`/`fogFar` lifted (10/18, unchanged).
- **Tamed the caustics.** `uCaustic` lifted to `TUNING.visual.causticStrength` and dropped 0.5 → 0.32; new `causticFocusMultiplier` 0.35 collapses them under Focus (`mix(1.0, uCausticFocusMul, uFocus)`); band weighting flipped from shallow-biased (`0.35 + 0.65*shallowW`) to deep-biased (`0.3 + 0.55*depth`) so the busy filaments leave the fishable foreground alone. `shallowW` removed (now dead).
- **Removed the stone lantern** from the treeline backdrop — it "echoed the reference statue," a `14_DO_NOT_BUILD` breach. The full-width mossy bank painted underneath already covers that stretch of waterline, so removal leaves no notch; no replacement mesh added.
- **Kept the backdrop seam closed.** The treeline sky's waterline stop and the waterline-mist gradient now *track* `TUNING.visual.waterDeep` (sRGB-safe hex parse, single source of truth) instead of the old hardcoded `#3d6068`/`rgb(61,96,104)`, so the backdrop base still melts into the (now deeper) far water.
- **Lifted placement constants for the /dev gate** (values unchanged): `backdropY` 0.8, `backdropTilt` 0.12, `treelineVisibleTop` 0.4 → `TUNING.visual.*`.
- Net cost: colour/constant/canvas-paint only. Zero new geometry, draw calls, textures, or rasters; the fragment shader gains one `mix()` + one multiply (negligible). No bloom/post, no new `.webp`.

**Cut / deferred (named so the gate knows what it's *not* getting):**
- `08_ART_DIRECTION` reed recolour — cut.
- Foreshore tint — deferred.
- The `fog={false}` toggle on the backdrop material (`08`/seam #6) — **deferred to the human**: only the *mist colour tracking* is shipped, not the toggle.
- Blind backdrop re-tuning — cut; only the *lifting* of placement constants ships, not new values.
- The far-shore parallax plate — still deferred.

**Discovered:**
- Background and fog literally shared the old water's hex (`#3d6068` × 3). The "void doesn't separate from the water" complaint wasn't subtle atmospherics — it was the same colour painted three times.
- The shader's water colours were *already* separate literals from the `:root` tokens (not shared), so decoupling was a rename to `TUNING.visual.*`, not a refactor — the loading screen was never at risk of darkening once the shader stopped reusing the same hex by hand.
- Deepening water and fish opacity are not independent knobs: a near-black silhouette over deep teal loses contrast fast, so they have to move together or the gate fails on "where did the fish go."

**Verification (machine-checkable, self-certified per amendment §3):**
- Static artifact sweep: no leftover `#3d6068`/`#6a958f`/`rgb(61,96,104)` in `GameClient.tsx`; the only surviving copies are the `:root` tokens + PWA `themeColor` (intended); all 11 `TUNING.visual` keys defined exactly once; `uCausticFocusMul` present in all three sites (JS uniform, GLSL decl, GLSL use); shader internally consistent (`causticBand`/`depth`/`uFocus`/`caustic` all in scope); no orphaned lantern vars.
- `pnpm build` is **not** run locally (standing "never test locally" rule); Vercel's build is the §3.1 executor for typecheck/lint/build.

**Next — the human iPhone gate (canary concerns, non-delegable):**
- **Water-vs-fish contrast, judged *both* directions:** are fish still a shadow you have to *find* (not invisible), and *not* over-resolved into a hard black blob? If off, dial `waterDeep`/`waterShallow` lighter/darker and/or `fishCueOpacity` — they move together.
- **Backdrop seam (#6, deferred):** does the treeline base still melt into the far water now that fog is ink, or does the fog/mist boundary show a line? If it shows, that's the `fog={false}` toggle decision.
- **Backdrop placement (#7, deferred):** `backdropY`/`backdropTilt` are now /dev-adjustable — confirm the treeline still fills the top strip across portrait/tall/wide.
- **Caustics under Focus:** confirm they visibly calm when Focus engages and no longer compete with cues in the foreground.
- Only a human, on a real iPhone, may create `v0.3.2-pond-polish-approved`.

**Slice — backdrop reframing (first gate look, same candidate):**
- First iPhone look passed the colour pass (deeper water reads, fish still findable) but flagged the far shore as "not seeing all the scene": the treeline was a thin band of mid-foliage with the crowns chopped off the top and the moon hidden down at the waterline.
- Diagnosed against the **real camera projection** (headless chromium at the 430×932 portrait aspect, screenshotting the live deploy — not a local build). The horizon is camera-fixed and high, so the backdrop is always a ~90px strip; the camera is load-bearing for the approved cast/fish/rod screen-projection and was left untouched.
- Lifted `backdropHeight` into `TUNING.visual`, then swept `backdropY`/`backdropHeight` via temporary `?by/?bh` query overrides from a single deploy. Winner: lower the plane (`backdropY` 0.8 → 0.2) so the strip frames sky + moon + full crowns instead of mid-foliage; the base drops to y=-1.2 (no waterline gap) and the sky still fills to the top edge (no void seam).
- Repacked the canopy texture to fill the reframed strip: moon raised `h*0.62 → h*0.42` into the framed slice + brighter halo, and a faint star scatter for depth.
- Temporary `?by/?bh/?bt` instrumentation removed; final values baked into `TUNING.visual`. Re-confirmed by headless render at defaults.
- Still the same candidate before the gate — re-check the **placement** item (treeline fills the top strip across portrait/tall/wide) and that the moon/sky now read as a far shore.

---

## v0.4-far-water-candidate (2026-06-01)
*A new chapter, not a polish pass. Canon was rewritten first (`19_THE_FAR_WATER.md` + new `00_OVERVIEW` paragraph): **distance is the spine of the game** — you cast blind into the dark far water and reel the unknown back into clarity. Builds on (and includes) the unreviewed pond-polish + backdrop-reframe work, so gating this also gates those visuals.*

**Shipped (all 10 of the requested changes):**
- **Dock removed entirely** — mesh, texture load/config, asset, all 7 constants, story line. You're on the bank now, rod in hand. The paragraph's "I crept along the dock" is retired in canon.
- **Cast reaches the far shore** (`castMaxRangeM` 8 → 9.5), **wider lane** (`castVisibleHalfWidthM` 1.9 → 3.2), and **in close to the bank** (`castMinForwardM` 0.6 → 0.25).
- **Accuracy falloff:** the lure scatters from the aim point by a radius that grows with reach (`castSpreadNearM` 0.06 → `castSpreadFarM` 1.2, curve 1.7). **Deterministic per gesture** (hashed from the release point) so the same drag always lands the same — testable, not a slot machine. `computeCast` now also returns `aimTarget` + `spreadRadius`. The aim preview ends at the true (scattered) landing, so it's WYSIWYG-legible.
- **Visibility falloff:** flipped the fish depth fade — which *brightened* far fish, backwards for the loop — to a distance model: clear near, murk far (`fishFarVisibility` 0.3, near 1.15, curve 1.6). Retired the deep/shallow multipliers.
- **Fish roam the whole expanse** (`fishableMinZ` -3.05 → -5.4, `fishableMaxZ` 1.2 → 1.8, wander radius 4.2 → 5.5).
- **Rod-in-hand:** butt pinned to the bottom-right corner (`rodScreenButtXRatio` 0.9 → 0.95, bottom 0.03 → 0.012), **doubled** (stroke 4 → 8, reel ×2 via one `rodReelScale`), pointing up toward the middle, and **swaying to track the aim** (`rodAimLeanFraction` 0.2). Visual only — cast origin stays `TUNING.world.rodTip`, and the line isn't drawn while aiming, so nothing disconnects.

**Verification (machine + sighted):**
- Vercel build green (typecheck/lint/build); no dangling dock/`fishDepthVisibility`/deep-shallow references.
- **Sighted via the headless harness** (chromium at 430×932 against the live deploy, with a scripted drag-aim-release): dock-free open water confirmed; far fish dimmed into murk; the rod renders doubled, corner-anchored, leaning toward the aim with the gold preview arc tracing the cast; cast fires and the line connects.

**Cut / deferred:**
- A widening aim-preview *ring* to telegraph spread before release — deferred. The preview already ends at the true scattered landing (WYSIWYG), so the falloff reads honestly; the ring is a polish to add if the gate wants a stronger tell.
- Fish count unchanged (still 1–3 visible) — the bigger area may read sparse; left for the gate to call.

**Next — the human iPhone gate (`far-water` checklist on `/dev`):**
- The eight canary judgments: distance feels real; far is murky; reach (far + close); accuracy reads as mechanic not bug; **the reveal** (lure a far fish into clarity); the rod (doubled / corner / points-middle / sways); dock-gone-and-coherent; loop preserved.
- Starting values (how far, how loose, how dark, rod angle/size/lean) are a co-tuned first guess — for the gate to refine.
- Only a human, on a real iPhone, may create `v0.4-far-water-approved`.

**Slice — gate refinements (same candidate):**
- **Accuracy was "too jittery."** Root cause: the aim preview *and* the rod were tracking the **scattered** landing point, whose per-gesture hash jumps every frame as you drag — so the predicted dot and the rod twitched. Fixed by tracking the **smooth intended** aim point instead; the scatter is realized only at release. Added a dashed **uncertainty ring** (`runtime.aimSpread` → `overlay.aimSpreadPx`, projected from one spread-radius in world to screen px) that grows with reach, so the looseness reads as a designed mechanic before you commit — this is the deferred telegraph, now built because the jitter is exactly what it solves.
- **Rising moon** "like time is really passing": pulled the moon out of the baked canopy texture into a separate `<Moon/>` sprite (`createMoonTexture`) that climbs slowly from near the crowns into the sky over a few minutes (`TUNING.visual.moon*`: start 0.45 → max 1.35 at 0.004 m/s, renderOrder in front of the treeline). Stars stay baked/fixed.
- **5 fish, always:** `fishMaxVisible` 3 → 5 and the decor pool is filled every spawn (`extraCount = fishMaxVisible - 1`), so the bigger water reads populated and spread out, not sparse.
- **Build discipline:** the first push of this slice ERRORed on Vercel — `useRef(TUNING.visual.moonStartY)` inferred the `as const` literal type `0.45`, rejecting a `number` reassignment. Caught by the §3.1 executor (Vercel build), fixed with `useRef<number>(...)`, re-verified green. The failed build never flipped the alias, so the live site was never broken.
- Re-confirmed by headless render: uncertainty ring visible and reach-scaled, preview/rod smooth (no jitter), ~5 fish spread across the water, moon present low near the treeline.

**Constitution:** `v0.0-ultracode-ratified` was **e-signed by the owner** (Adam Rappaport / Mentis123, by explicit chat consent, 2026-06-01) on the `18_ULTRACODE_PARADIGM` commit — the agent created the tag solely under that recorded consent.

**Slice — second gate look (same candidate):**
- *"Fish all start in the foreground"* — `spawnFishFromInstance` seeded every fish near `fishStart` (z≈1.35). Now spawns each at `nextWanderTarget` (anywhere near→far across the fishable water), so they begin spread across the expanse; far ones sit dim in the murk.
- *"Moon is in front of the distant trees, should be behind"* — the backdrop baked sky+trees into one plane with the moon sprite on top. Split into a back sky+stars layer (renderOrder -3) and a front transparent treeline layer (-1), moon between (-2). Foliage now occludes the moon; it rises out from behind the far shore. Verified headless: moon glows behind the treeline, fish fan across the water.

**Slice — landing-zone reticle as a perspective ellipse (same candidate):**
- *"The cast target needs tuning: a tight exact point when near, a large less-accurate zone when far — and it should be elliptical, lying on the pond surface, not a flat circle."* Two changes:
  - **Perspective ellipse.** The reticle was a screen-space circle (one `+X` spread-radius projected to px, used as both width and height). Now it projects the **four cardinal points** of the real landing disc on the water plane and reads the screen half-spans → `aimRingRx`/`aimRingRy`. A Z offset foreshortens far harder than an X offset under this camera, so `rx > ry` (ry/rx ~0.44 far → ~0.70 near) and the ring **flattens the farther you aim** — it reads as lying *on* the water, not floating over it. CSS `border-radius 999px → 50%` for a true ellipse. Center stays the direct aim projection, so the dotted aim-line endpoint is unchanged.
  - **Precision tuning.** Tighter near (`castSpreadNearM` 0.06 → 0.04, an exact point), wider far (`castSpreadFarM` 1.2 → 1.65, a clear gamble zone), curve 1.7 → 1.8. The lure scatter was already bound to this exact radius, so the ring is an **honest telegraph** of where the lure can actually land (sqrt-uniform disc, ring = true outer bound).
- **Ultracode verification — four independent adversarial lenses** over the diff (perspective math, telegraph truthfulness, regression, tuning feel). The math lens numerically reproduced the projection against the real camera: ry/rx monotonically flattens with distance, no Z sign error, the shared `projVec` reuse is safe (set→project→capture), no NaN/behind-camera case in range. Regression lens: no dangling `aimSpreadPx`, aim-line endpoint intact, ellipse CSS correct. Two lenses caught honest calibration gaps — **both fixed**:
  - The `ry` line-collapse floor lowered `0.2 → 0.1`. It never fires in the playable range anyway (true ry/rx ≥ 0.44), so this just makes the guard strictly more honest where it ever would.
  - `castSpreadFarM` lifted to 1.65 because the pond geometry caps real reach at reachT ~0.92–0.98 (the far shore is closer than `castMaxRangeM`). The felt far ring now lands ~1.45m (~45% of the visible cone — the intended wide gamble) instead of chasing an unreachable 1.5m ceiling.
