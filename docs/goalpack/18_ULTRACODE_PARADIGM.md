# 18_ULTRACODE_PARADIGM

> Ratifiable amendment to the Reel Mobile constitution.
> Supersedes the single-agent stop-at-every-step procedure in `16_HUMAN_GATES.md`
> for **machine-checkable concerns only**. Everything in this file is subordinate
> to `00_OVERVIEW.md`. If anything here makes the paragraph less likely in a real
> player's hands, this file is wrong and the paragraph wins.

## Why this amendment exists

The original gate doctrine assumed **one agent that cannot test on a real iPhone**.
From that single fact, two very different families of rule were derived and — by
accident of history — written down side by side:

- Rules that exist because **one mind cannot check its own work** (procedural).
- Rules that exist because **no software can feel the game on a real device**
  (epistemic, irreducible).

The build is now driven by **ultracode**: deterministic multi-agent workflows that
fan out, build, and then **adversarially self-verify** before anything is offered
for review. That changes *who builds and who checks*. It does **not** put an iPhone
in any agent's hands, and it does **not** give any agent human feel-judgment.

So the amendment is surgical:

- Where the gate existed only because **one mind couldn't self-verify**, replace it
  with an **adversarial self-verification bar** (§3). The workflow may design and
  build a whole milestone autonomously when only machine-checkable concerns are in
  play.
- Where the gate exists because **a real iPhone is the canary** (`16` L3), it
  **stays, mandatory, human, unchanged** (§4). N agents still cannot self-approve.

The hinge sentence of the old doctrine — *"Gates exist because the agent cannot
test on a real iPhone, and a real iPhone is the canary"* — is not repealed. It is
**narrowed to its true cause**. The canary gate is sacred. The clerical stop is not.

## Invariants this amendment does NOT touch

These survive ultracode intact. They are re-stated, not relaxed. Any workflow that
appears to require relaxing one of these has misread the milestone — stop and ask.

1. **The paragraph is the prime directive.** (`00_OVERVIEW.md` L7–27.) Every agent,
   verifier, and critic in the swarm exists to make that paragraph happen on a real
   iPhone. A change that passes every machine check and weakens the paragraph is a
   failed change.
2. **`14_DO_NOT_BUILD.md` holds in full.** Multi-agent autonomy is **not** licence
   to add scope. Default to *don't*. A swarm that "discovers" it needs a day/night
   cycle, a stone-lantern landmark, rarity colours, or a shop has drifted — log to
   `DEVLOG.md` and stop.
3. **No magic numbers. All feel AND visual constants live in
   `src/game/tuning/tuning.ts`.** (`AGENTS.md` L13/L25; `05_PHYSICS_AND_FEEL.md`;
   `GOAL_COMMAND.md` L66.) This is **extended** by this amendment, not narrowed:
   palette tokens, water-shader colours, fog distances, caustic/specular intensity,
   light direction, fish silhouette opacities — every value an OLED human-gate could
   reasonably want to re-tune — must be a named constant the human can change without
   reading shader code. A magic number buried in `GameClient.tsx` is a defect a
   verifier agent must refute (§3.7).
4. **`*-approved` tags are created by humans only.** Ever. For any reason. Even if
   asked. Even under "make progress" pressure. (`12` L104; `13` L31; `GOAL_COMMAND`
   L67.) A verifier agent, a critic agent, a majority of agents, a unanimous swarm —
   none may write, request a script to write, or simulate an `*-approved` tag.
   Approved is a human signature attesting to something no agent observed.
5. **No force-push. No tag deletion. No history rewrite. Ever. For any reason.**
   (`13` L32–33, L78.) This is a **data-integrity** guarantee, builder-agnostic. It
   is **not** softened by the existence of a verifier agent. The introduction of
   adversarial self-verification gives the workflow *more* power to ship a milestone
   autonomously; it gives it **zero** additional power over git history. Tags are the
   rollback substrate. Approved tags are preserved record.

> Reading note. Items 4 and 5 were historically listed together. They have different
> rationales. An ultracode workflow could, in principle, earn the right to issue a
> *candidate* without a human in the loop (it does — §3). It can **never** earn the
> right to issue an *approval* (item 4) or to touch history (item 5).

---

## §1 — The two kinds of concern

Every property of a change falls into exactly one bucket. **The bucket is determined
by what the change TOUCHES, not by what activity it is called.** "Refactor",
"perf work", and "extraction" are activity labels, not safe-harbours — a refactor of
the water shader is a canary change.

### Machine-checkable concerns (the workflow may self-certify)

Properties an honest, adversarial process of agents can falsify **without a real
device and without feel-judgment**:

- **Correctness** — game-state machines, cast/hook/fight/result transitions, bite
  windows, failure-mode branches behave per `01`, `05`, `11`. Asserted by tests.
- **Typecheck / lint / build** — `pnpm typecheck && pnpm lint && pnpm build` exit 0.
- **Instrumented smoke** — Layer 2 of `12_VALIDATION.md` (loads, gate dismisses,
  canvas renders non-zero pixels, cast transitions fire, no GL errors, context-loss
  handlers registered).
- **Performance budgets** — the **numeric, falsifiable** targets in
  `07_PERFORMANCE_BUDGET.md`: < 50 draw calls, < 100k triangles, ≤ 8 texture units,
  < 20MB texture memory, ≤ `min(devicePixelRatio, 2)`, < 200MB heap, < 5MB JS gz,
  < 15MB total assets, no post-processing in M1, instanced/pooled geometry,
  no frame > 50ms. These are numbers. A headless instrumented run measures them.
  **Self-certifiable** — but see the 80% average rule AND the jank-tail rule in §3.5
  and §4.
- **Do-not-build adherence** — nothing in the diff matches `14_DO_NOT_BUILD.md`. A
  do-not-build *grep/AST/audit* is machine-checkable.
- **Regression** — the prior `*-approved` milestone's checks all still pass. No green
  thing goes red.
- **Constant-discipline** — no magic numbers in gameplay/visual code; all feel and
  visual constants resolve through `tuning.ts` (§ invariant 3).

### Canary concerns (only a real iPhone + a human can answer)

Properties that **are the actual game** and that no agent — single or swarm — can
observe (`12` L79–87; `16` L3):

- **Feel** — does the cast feel right, the bite decisive, the tension legible
  *through the line*, the failure learnable. **Automated tests are structurally
  blind to feel** (`12` L80–85): a behaviour-preserving refactor of feel code can
  pass every Layer 1 check and still shift the feel the tests cannot see. Feel code
  is therefore canary even when green.
- **The paragraph** — after one full cycle, *do I want to cast again.*
- **On-device visual coherence (OLED)** — does the twilight read as twilight on a
  real OLED panel; do the darks crush or separate; does `uDeep` look like deep water
  or like the void; does the moon agree with the specular; is anything that passed in
  an emulator actually wrong on glass. (This is precisely where the *Visual/Context*
  gap list lives: water-vs-void merge, three-uncoordinated-moonlights, caustic
  chatter over the fishable band. **None of these are machine-checkable.** A draw-call
  count cannot see that two colours are identical and shouldn't be.)
- **Perceived performance / jank** — not the average FPS number (machine-checkable)
  but the *felt* hitch, the stutter on first cast, the thermal droop over 5 minutes
  in a hand. The budget is a floor; *feeling smooth* is the gate. **Jank is a tail
  phenomenon, not an average** (`07` L102: no frame > 50ms): a change can sit at 50%
  of average-FPS budget and still ship a single 60ms first-cast spike. The felt tail
  is a canary concern and gates regardless of the headless probe's average result.
- **Audio** — does sound do work; does silence do work; does iOS Safari actually
  play everything after first tap on the device.

> The spotting rule (`04` + `00:35`) straddles both. **The mechanism is
> machine-checkable** (false-positive ambiguity budget 20–30%, cues seed-driven,
> Focus reduces `uFocus`-gated glare and slows water per `tuning.ts`). **The
> readability is a canary concern** (are fish ambiguous dark *shapes*, silhouette
> before detail, never resolved). The workflow self-certifies the *math*; the human
> gate certifies the *read*.

---

## §2 — Ultracode: what the workflow is

Ultracode is a **deterministic, adversarial, multi-agent** procedure. "Deterministic"
means: same goalpack + same repo state ⇒ same verification verdict. Verification is
not vibes; it runs commands and reads their exit codes.

Minimum role set (a workflow may add agents; it may not remove these):

- **Builder(s)** — design and implement the milestone. May fan out across subsystems
  (water, line physics, audio, journal) and work in parallel.
- **Independent Verifier(s)** — adversarial agents whose job is to **refute**, not to
  confirm. A verifier does not re-run the builder's tests and nod; it tries to *break*
  the claim: writes the failing test, runs the budget probe, greps for the magic
  number, diffs against `14`. **Independence is falsifiable, not aspirational** (§3.3).
  **A verifier is not the author of the code it verifies.** Self-verification by the
  builder does not count.
- **Critic / Red-team** — holds the change against the **paragraph** and the
  **do-not-build list** at the design level: "this passes every check and makes the
  pond worse / adds a banned thing / buries a constant / is off-milestone." The critic
  can kill a change that is technically green but off-doctrine, and is the sole arbiter
  of artifact-less design-level objections (§3.4).

"**Adversarially self-verify**" means the *workflow as a whole* checks itself by
setting agents against each other's output — **not** that any single agent blesses
its own work.

---

## §3 — The adversarial self-verification bar

Before the workflow may create a `*-candidate` tag for a milestone, **all** of the
following must hold. This bar replaces the old "stop after every step and wait" for
machine-checkable concerns. Clear the bar and the workflow may proceed autonomously
through an entire milestone's machine-checkable surface.

**3.1 Build & static floor.** `pnpm typecheck && pnpm lint && pnpm build` exit 0.
Non-negotiable, same as `12` Layer 1.

**3.2 Correctness & regression suite green.** Layer 1 tests + Layer 2 instrumented
smoke pass. The prior `*-approved` milestone's checks all still pass (no regression).

**3.3 Independent, artifact-producing verification — not self-attestation.** Every
machine-checkable claim the builder makes is **independently re-derived by a verifier
agent that did not write the code**. Independence is defined operationally and is
falsifiable:

- (i) The verifier prompt **does not receive the builder's self-assessment or
  claimed-pass rationale** — only the diff and the goalpack property under test.
- (ii) The verifier must produce a **reproducible artifact**: a command run plus its
  exit code, a written failing test, a grep hit with `file:line`, or a measured
  number. *A verifier verdict with no reproducible artifact is treated as*
  ***unverified*** *and blocks the candidate.* "I reviewed it and found nothing" is
  not verification; a logged command someone else can re-run is.

**3.4 One artifact-backed refutation blocks; two clean attempts certify.** Refutation
is **not a vote** and consensus semantics do not apply. For each contested property:

- A property is **certified** iff **≥ 2 independent verifiers each attempted refutation
  with a logged artifact AND zero produced a credible refutation.**
- **A single credible refutation blocks the candidate, regardless of how many
  verifiers passed.** One valid counterexample falsifies. The change does not ship as
  a candidate; the builder revises, or the workflow falls back (§3.4-fallback).
- **"Credible" is not adjudicated by the builder or the workflow.** A refutation
  backed by a reproducible artifact (a failing test, a breaching measurement, a
  do-not-build grep hit with `file:line`) is credible **by definition** and is not
  subject to adjudication — it blocks. A refutation with no artifact is discarded. The
  **critic** — never the builder — rules only on artifact-less design-level
  objections. This removes "credible" as a soft escape hatch.
- Verifiers must be **independent** per §3.3. Collusion (verifiers rubber-stamping,
  correlated re-wordings of the same pass) is itself a defect the critic must flag.

  *(§3.4-fallback) On a blocking refutation the workflow falls back to the prior
  `*-approved` state by restoring working-tree state only — `git checkout`/reset of
  the working tree, never tag mutation. See invariant 5 and §5.7.*

**3.5 Performance probed, not assumed — averages and the jank tail.** The numeric `07`
budgets are **measured** by a headless/instrumented run, not estimated.

- Any **average** budget at **> 80% of its limit** trips a **mandatory human gate**
  (§4.3) — the workflow may not self-certify near the ceiling, because the last 20%
  is exactly where on-device thermal/jank reality diverges from the emulator.
- The headless probe measures averages; **jank is a tail phenomenon.** Therefore any
  **single-frame time measurement (p99 / max frame ms) within 80% of the 50ms jank
  ceiling ALSO trips the §4.3 human gate, independent of average-budget headroom**,
  and the *felt* tail is a canary concern that gates regardless of the probe result.

**3.6 Do-not-build audit clean.** An explicit pass confirms the diff introduces
nothing from `14_DO_NOT_BUILD.md` and reclassifies no *decorative* asset as *core*
to dodge a rule. (`09` L9/L15.)

**3.7 Constant-discipline audit clean.** No magic numbers in gameplay or visual code.
Every feel/visual value resolves through `tuning.ts` (§ invariant 3). A buried colour
or distance is a refutation under 3.4.

**3.8 Two-failure stop rule still bounds the loop.** (`12` L89–96; `02` L64.) If a
machine-checkable property fails twice on the same milestone after revision, the
workflow **stops**, writes to `DEVLOG.md`, and asks for human review. No third
autonomous fix. The swarm does not get more retries than the lone agent did — more
parallelism, not more thrashing.

**3.9 Everything is logged.** `DEVLOG.md` records, per candidate: what was built, what
each verifier tried to break and the artifact it produced, the measured budget
numbers (averages **and** p99/max frame), and the final per-property verdict. An
unauditable green is not green.

**3.10 Milestone-boundary audit.** A verifier confirms every slice maps to a
requirement of the **current** milestone in `03_IMPLEMENTATION_PLAN.md`. Work not
traceable to the current milestone's spec is **off-scope** and **stops** the workflow
(write to `DEVLOG.md`, ask) — **even if it is do-not-build-clean and bar-clean.**
Autonomy across slices without a boundary check is exactly how a green swarm builds
three milestones of unasked-for polish. (`14` L100–104 spirit; invariant 2.)

> What the bar buys the workflow: between two human gates, it may design, build,
> cross-check, refute, and re-build an **entire milestone's machine-checkable work**
> without stopping for a human — *provided* no canary concern and no §4 trigger is in
> play. That is the whole point of ultracode: spend the human's iPhone time only on
> what the human alone can judge.

---

## §4 — The mandatory human iPhone gate (unchanged in force, sharpened in scope)

A real iPhone is still the canary. The following are **not** delegable to any agent,
and a candidate tag is **not** a milestone-done signal — `*-approved` still is
(`13` L34). The human gate fires when **any** of these is true:

**4.1 The milestone touches a canary concern (§1).** If the change can affect feel,
the paragraph, on-device/OLED visual coherence, perceived performance/jank, or audio,
a human plays it on a real iPhone before approval. This covers, at minimum, every
milestone that touches: casting/hook/fight/tension (feel), the water/light/colour/
backdrop/foreshore (OLED coherence — the entire Visual gap list), the spotting *read*
(silhouette-before-detail), or any audio (`M6`).

**4.2 M1 always.** The vertical slice is the most important gate in the build
(`16` L57–60). It is the paragraph itself. No amount of green self-verification
substitutes. Human, real iPhone, ≥ 8/10, every time.

**4.3 A §3.5 budget trip, or a §4 beyond-gate trigger.** Any **average** budget > 80%
of its limit, **or** any **p99/max single-frame** time within 80% of the 50ms jank
ceiling, fires this gate. Carried forward from `16` L118–128: a dependency choice
that would violate the pack; an asset prompt interpreted heavily; an undocumented iOS
Safari quirk; a temptation to add off-milestone scope. In all cases: stop, write to
`DEVLOG.md`, output a clear question, wait.

**4.4 The spotting *read* changed.** Any change to water palette, clarity, caustics,
specular, fog, or fish silhouette opacity (the `5031b70` tension) must reach the human
gate, because "are the fish ambiguous dark shapes, never resolved" (`04` L79–82) is a
canary concern even when the ambiguity-budget *math* self-certifies. A darkening of
`uDeep` co-tuned with fish opacity in `tuning.ts` is machine-clean and **still gated**.

**4.5 The five-strangers playtest.** After `v0.8-performance-approved`, before
"shipped" (`16` L130–139; `02` L70). First-time human readability is unobservable to
any agent. Unchanged.

### What the workflow MAY self-certify (no human gate required)

**Self-certification is gated on the SURFACE A CHANGE TOUCHES, not on the activity
label.** A milestone — or a slice of one — whose **entire** touched surface is
machine-checkable and whose §3 bar is clean may receive its `*-candidate` tag
**without stopping for a human**, and the workflow may continue. Self-certifiable
surface, each scoped to the non-canary case:

- **Behaviour-preserving refactors — ONLY off the feel/visual/audio hot path.**
  Tests are feel-blind (`12` L80–85), so a refactor self-certifies only when the
  changed code is **not** in: the casting/hook/fight/tension physics (`05`), the
  water/light/shader layer, the spotting/cue layer (`04`), or audio (`10`). A refactor
  touching any of those **gates even if every test is green.**
- **Performance work — ONLY where it does not touch the frame-production path.**
  Moving a measured number is **not** a licence to self-certify. Only perf work that
  does **not** touch the render/shader/animation hot path may self-certify (e.g.
  lazy-loading a journal asset, build-time asset compression). Any change to the
  frame-production path is a perceived-jank canary concern by §1's own definition and
  **gates**, because the headless probe measures average throughput, never the
  hand-held first-cast hitch or caustic chatter.
- **Constant extraction into `tuning.ts` — ONLY with proven byte-identity.** A
  verifier must prove **each extracted value is byte-identical to the literal it
  replaced** (no rounding `0.62`→`0.6`, no co-tuning "while we're in here"). Any value
  change makes it a **tuning change**, which **gates if the constant is feel/visual**
  (§4.4). A `uDeep`/fish-opacity co-tune wearing a refactor's clothes is gated.
- **Do-not-build cleanup, test-coverage additions, build/CI/scaffolding** that touch
  no canary surface.

**If in doubt about whether a change is canary or machine, treat it as canary and
gate it.** (Same spirit as `14` L100–104: default to the conservative side.)

---

## §5 — The candidate → approved flow in the ultracode era

The two-tag ladder (`13_CHECKPOINTS.md`) is unchanged. **One `*-candidate` tag per
milestone**, created only after ALL of that milestone's slices — machine-checkable and
canary — are built and the entire machine-checkable surface has cleared §3.
Intra-milestone slice progress is tracked in `DEVLOG.md`, **not in tags.** There is no
new tag granularity; a candidate never means "this slice is green." What changes is
*how a candidate is earned* and *when a human is in the loop*.

**Old flow (single agent):** build a step → run Layer 1+2 → tag candidate → **stop at
every step** → human tests → human approves.

**New flow (ultracode):**

1. **Workflow plans & builds** the milestone (builders fan out; §2). Each slice is
   boundary-audited against the current milestone's spec (§3.10) before it counts.
2. **Adversarial self-verification** runs the §3 bar: independent, artifact-producing
   verifiers try to **refute** every machine-checkable property; one artifact-backed
   refutation blocks; two clean attempts certify (§3.4). Performance is **measured**,
   averages and the p99/max tail (§3.5).
3. **§4 trigger check.** Does this milestone touch a canary concern, hit M1, breach
   80% of an average budget, land within 80% of the jank ceiling, change the spotting
   read, breach the milestone boundary, or trip a beyond-gate trigger?
   - **No canary concern, bar clean** → after **all slices are built and verified**,
     the workflow creates the milestone's single `vN.M-name-candidate`, logs the run
     to `DEVLOG.md`, and **may continue autonomously** to the next machine-checkable
     milestone. No human stop required.
   - **Canary concern present** → the workflow creates `vN.M-name-candidate`, **stops,
     and outputs a summary**, exactly as in `16` L34–46. Control passes to the human.
4. **Human gate (when triggered).** Human runs `pnpm dev`, opens `/dev`, scans the QR,
   plays the milestone's checklist on a real iPhone, watches their own face. The
   `/dev` "Mark approved" button still **only copies** a `git tag` command to the
   clipboard (`16` L15, L26–28). The machine never auto-approves.
5. **Approval is a human signature.** On pass, the human — and only the human — runs
   `git tag vN.M-name-approved`. On fail, the human writes the failure to `DEVLOG.md`
   and re-prompts the workflow at the broken concern. (`12` L102–104; `13` L36–40.)
6. **Done-ness is still the approved tag.** Missing `*-approved` ⇒ milestone not done,
   regardless of how green the candidate was or what `DEVLOG.md` claims (`13` L34).
   A flawless §3 run is *necessary* for a candidate and *never sufficient* for a
   milestone.
7. **Rollback is still a human decision** to the last `*-approved` tag, documented in
   `DEVLOG.md` (`13` L43–57). The workflow may fall back internally between build
   passes by **restoring working-tree state only** (`git checkout`/reset of the
   working tree). It **may delete or move ONLY a `*-candidate` tag it created in the
   current, still-unapproved milestone, and may NEVER delete or move any tag that
   exists at the last `*-approved` boundary or any `*-approved` tag.** "Fall back"
   means restoring working state, never mutating shipped tag refs, never force-push,
   never history rewrite (§ invariant 5).

### Tag authority table (ultracode era)

| Property            | `*-candidate`                                  | `*-approved`                                  |
|---------------------|------------------------------------------------|-----------------------------------------------|
| Created by          | Workflow (after §3 bar passes, once per milestone) | **Human only**                            |
| Precondition        | §3 adversarial self-verification bar clean, all slices built | Layer 3 real-iPhone test passes         |
| Means               | "Machine-checkable surface is green and was *attacked* with logged artifacts, not just asserted" | "A human felt it on the canary and signed" |
| Autonomy            | May be issued without a human stop **iff** no canary concern / §4 trigger | Never autonomous, never agent-issued          |
| Mutability          | Workflow may delete/move ONLY its own current-unapproved-milestone candidate; human may delete/move when rolling back | Preserved as historical record — never deleted, never moved |
| Agent permissions   | May create one candidate per milestone; may delete only that candidate; may NOT touch any tag at/below the last approved boundary, force-push, or rewrite | May NEVER create, request, simulate, or script |

---

## §6 — Ratification & precedence

- This file is an **amendment**, not a replacement. Where it conflicts with the
  procedural stop-at-every-step language of `16_HUMAN_GATES.md`, **this file governs
  for machine-checkable concerns**. Where it conflicts with any invariant in this
  document or with `00_OVERVIEW.md`, **those govern**. The **canary gates of
  `16_HUMAN_GATES.md` are unchanged in force** and outrank §3/§4's autonomy.
- Precedence order, highest first: `00_OVERVIEW.md` (the paragraph) → the five
  invariants in this file's "Invariants this amendment does NOT touch" →
  `14_DO_NOT_BUILD.md` → `04`/`07` hard constraints → the **canary gates of
  `16_HUMAN_GATES.md` (unchanged in force)** → §3/§4 of this file → everything else.
- To ratify: the human adds `18_ULTRACODE_PARADIGM.md` to the reading order in
  `00_OVERVIEW.md`, applies the targeted edits to `16_HUMAN_GATES.md` below, and
  records ratification with a human-written tag `v0.0-ultracode-ratified` (an approved
  tag; humans only). Until that tag exists, this amendment is a proposal, not law.

---

## Targeted edits to `16_HUMAN_GATES.md`

**EDIT 1 — replace the opening paragraph (L3).**

*Old:* `The agent stops at gates. The human decides whether to proceed. Gates exist because the agent cannot test on a real iPhone, and a real iPhone is the canary.`

*New:*

> The workflow stops at gates. The human decides whether to proceed. A gate exists wherever a **real iPhone is the canary** — wherever feel, the paragraph, on-device/OLED visual coherence, perceived performance/jank, or audio is the thing being judged. No agent — single or swarm — can feel the game on a real device, so those gates are mandatory and human (`18_ULTRACODE_PARADIGM.md` §4).
>
> *Amendment in force:* under ultracode (`18_ULTRACODE_PARADIGM.md`), the workflow no longer stops at *every* step. For **machine-checkable** concerns — correctness, typecheck/lint/build, performance budgets, do-not-build adherence, regression — it adversarially self-verifies (independent artifact-producing verifiers; one artifact-backed refutation blocks; two clean attempts certify) and may build a whole milestone autonomously before tagging a candidate. The human gate below stays mandatory for canary concerns and is never delegable to an agent. This section's per-milestone expectations, beyond-gate triggers, and the five-strangers playtest remain in force.

**EDIT 2 — append after the five-strangers section (after L139).**

> ## How this section reads under ultracode
>
> The **candidate → human-test → approved** loop in this document is unchanged in
> *authority*: only a human, on a real iPhone, creates `*-approved`. What ultracode
> changes is *when the workflow is allowed to keep going without you*. See
> `18_ULTRACODE_PARADIGM.md`:
>
> - §3 — the adversarial self-verification bar a candidate must clear (independent
>   artifact-producing verifiers; one artifact-backed refutation blocks; performance
>   measured not assumed, averages **and** the p99/max jank tail).
> - §4 — exactly which changes still force a mandatory iPhone gate (any canary
>   concern; M1 always; >80% of any average budget or within 80% of the 50ms jank
>   ceiling; any change to the spotting *read*; any feel/visual/audio hot-path change
>   even when green; the five-strangers playtest) versus what the workflow may
>   self-certify (gated on touched surface, not activity label).
> - §5 — the full ultracode candidate → approved flow and tag-authority table (one
>   candidate per milestone; slice progress in `DEVLOG.md`, not tags).
>
> The "Mark approved" button still only copies a `git tag` command to your clipboard
> (L15, L26–28). The machine never auto-approves. Approved is, and remains, a human
> signature.
