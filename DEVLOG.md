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
