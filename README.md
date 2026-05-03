# Reel Mobile

A mobile-first browser fishing game about one perfect pond.

## North star

> I saw something move. I think it was big. I crept along the dock to get a better angle. I cast just past it. It turned. It followed. It almost bit. I twitched once. It struck. I panicked. I nearly snapped the line. I landed it. I want to do that again.

The job is to make that paragraph happen on an iPhone.

## Status
Pre-Phase-A. Not yet playable.

## Quick start
```bash
pnpm install
pnpm dev
# Open /dev on your laptop for the QR code
# Scan with iPhone to test the canary device
```

## Documentation
All decisions live in `docs/goalpack/`. Start with `00_OVERVIEW.md`.

Agents read `AGENTS.md` first.

## Routes
- `/` — landing
- `/game` — the game itself
- `/dev` — QR code, current candidate tag, manual checklist
- `/tune` — live constant editor (dev only)

## Deploy
Vercel. `main` auto-deploys.
