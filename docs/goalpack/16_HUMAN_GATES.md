# 16_HUMAN_GATES

The agent stops at gates. The human decides whether to proceed. Gates exist because the agent cannot test on a real iPhone, and a real iPhone is the canary.

## The /dev page

The most important UI in the build. Without this, gates are friction; with it, gates take 90 seconds.

`/dev` must show:

1. **Local network URL** (e.g. `http://192.168.1.42:3000/game`)
2. **QR code** of that URL (use `qrcode` npm package, render client-side)
3. **Current candidate tag** (read from git via build-time injection)
4. **Manual checklist** for the current milestone (rendered from a checklist file)
5. **"Mark approved"** button — copies a `git tag <approved-name>` command to clipboard for the human to run

```tsx
// Pseudocode for /dev page
<div>
  <h1>Reel Mobile — Dev Gate</h1>
  <p>Current candidate: <code>{currentCandidateTag}</code></p>
  <QRCode value={localGameUrl} />
  <p>{localGameUrl}</p>
  <h2>Manual checklist</h2>
  <ChecklistFromFile milestone={milestone} />
  <button onClick={copyApprovedCmd}>
    Copy "git tag {approvedName}" to clipboard
  </button>
</div>
```

The page exists from M0. It is the operational substrate for everything after.

## Gate procedure

Standard flow at each milestone:

1. Agent finishes work, runs Layer 1 + 2 validation
2. Agent commits, creates `vN.M-name-candidate` tag, updates `DEVLOG.md`
3. Agent **stops** and outputs a summary
4. Human runs `pnpm dev` on laptop
5. Human opens `/dev` on laptop
6. Human scans QR with iPhone, opens `/game`
7. Human plays through manual checklist
8. If pass: human runs `git tag vN.M-name-approved` and continues
9. If fail: human writes failure to `DEVLOG.md`, identifies broken mechanic, re-prompts agent

## Gate expectations per milestone

### M0 (shell)
- Laptop loads `/`
- Mobile loads `/game` via QR
- `/dev` page shows QR and current candidate
- Vercel deploy succeeds and is reachable on phone
- ~30 second test

### M1 (vertical slice — the big gate)
Full 10-question manual checklist from `12_VALIDATION.md`.
~5 minute test.
**This is the most important gate in the build.** Do not approve casually.

### M2 (pond visuals)
- Visual coherence with `08_ART_DIRECTION.md`
- 60fps holds on iPhone 13
- Focus mode reduces glare visibly
- Reeds and dock match palette
- ~3 minute test

### M3 (fish variety)
- Five species distinguishable by silhouette alone
- Cue signatures detectably differ
- Two same-species instances feel slightly different
- Fish density feels right (not too crowded, not empty)
- ~5 minute test

### M4 (gear)
- Three lures feel mechanically different
- Two rods feel mechanically different
- Selection UI doesn't break flow
- ~3 minute test

### M5 (journal)
- Catches persist across page reload
- Journal loads under 500ms
- Stories read as stories, not stats
- ~3 minute test

### M6 (audio polish)
- Replaces all procedural with sourced/generated
- Mute toggle works
- Haptics toggle works
- iOS Safari plays everything after first tap
- ~5 minute test (with audio on)

### M7 (share & install)
- Share generates a card image
- Native share sheet appears on iOS
- Install prompt fires only after first catch + 2min play
- PWA installs and launches with icon
- ~5 minute test

### M8 (performance)
- 5-minute session on iPhone 12 holds 45fps avg
- No frame > 50ms
- Memory stays under 200MB
- Lighthouse mobile ≥ 80
- ~10 minute test

## What the human does at the gate

Beyond ticking checkboxes:

- **Watches their own face.** Was there a smile? A wince? A laugh? Those matter more than checkboxes.
- **Notices repetition urge.** "I want to cast again" is the only success metric that compounds.
- **Listens.** Is the audio doing work? Is the silence doing work?
- **Tries to break it.** Background the tab, rotate the device, lock the screen, open three other apps. Come back. Does it survive?

## When to call for review beyond a gate

The agent should **also** request human review (not just at milestone gates) if:

- A dependency choice would violate the pack
- An asset generation prompt is ambiguous and the agent had to interpret heavily
- Performance budget is approached (>80% of any limit)
- An iOS Safari quirk is encountered that isn't in `06_MOBILE_WEB_CONSTRAINTS.md`
- The agent is tempted to add scope that isn't on the milestone

In all cases: stop, write to `DEVLOG.md`, output a clear question for the human, wait.

## When the human watches five strangers play

After `v0.8-performance-approved`, before "shipped":

- Find five people who haven't seen the game
- Give each one your iPhone, no instructions
- Watch silently for 3 minutes
- Note: do they understand casting? Do they notice fish? Do they smile when something bites? Do they hand the phone back willingly or keep playing?

This is the **real** validation. It happens outside this document. But the docs lead here.
