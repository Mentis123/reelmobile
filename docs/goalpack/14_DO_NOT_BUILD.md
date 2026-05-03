# 14_DO_NOT_BUILD

Pre-emptively close these doors. The agent must not build any of these for MVP without explicit human instruction in a follow-up prompt.

## Game systems

- Multiplayer
- Online accounts / login
- Cloud sync
- Friends / social graph
- In-game shop / store
- Currency / coins / gems
- Economy
- Crafting
- Trading
- NPCs / characters / dialogue
- Quests / missions
- Story / cutscenes
- Day/night cycle (one fixed twilight mood for MVP)
- Weather system (rain, sun, fog as dynamic)
- Multiple ponds
- World map / overworld
- Boats / vehicles
- Procedural open world
- Aquarium / collection display beyond simple journal
- Pet fish / breeding
- Boss fish / encounter mechanics

## Monetisation

- In-app purchases
- NFTs / blockchain / Web3 anything
- Ads
- Paywalls
- Premium currency
- Loot boxes / gacha
- Daily login rewards
- Battle pass / season pass

## Progression / gamification

- XP bars
- Levels
- Skill trees
- Rod tier upgrades (beyond two simple variants)
- Lure tier upgrades (beyond three simple variants)
- "You caught X/Y fish" completionism
- Rarity stars (★★★★★)
- Colour-coded rarity (green/blue/purple/gold)
- Achievement badges
- Trophies
- Leaderboards
- Daily quests
- Streak rewards

## UI / UX

- Tutorial pop-ups with arrows
- Modal "press start" screens beyond Tap-to-begin
- Settings menus with more than 4 options for MVP
- Onboarding sequences > 10 seconds
- Long text instructions
- Cutscene-style intros
- Skeuomorphic chrome (fake wood panels, leather UI, fake reels)

## Tech / scope

- Server-side game logic
- Real-time multiplayer netcode
- Custom game engine
- WebAssembly modules (use plain TS)
- Native app wrappers (this is a web game)
- App Store / Play Store distribution
- Custom analytics backend (defer to telemetry-ready hooks per `15_`)
- Telemetry to a server (just hooks, not a backend)

## IP / content

- Copied Zelda assets, names, characters, music, UI
- Copied Pokémon, Studio Ghibli, Disney, Nintendo IPs of any kind
- Real fishing brand names (Rapala, Shimano, etc.)
- Real fish species photographs
- Licensed music
- Real-world location names (no "Lake Tahoe", just "the pond")
- Real human characters / portraits
- Religious or political symbolism

## Realism overreach

- Realistic fish anatomy / scales / textures
- Realistic fishing line physics beyond Verlet rope
- Real-world fishing regulations
- Real-world fish feeding science
- Tide / lunar cycle effects
- Bait selection beyond lures
- Hook size selection
- Line weight selection
- Reel drag adjustment

## When in doubt

If the agent considers building something not explicitly required by the Goal Pack and not on this list, default to **don't**. Add a line to `DEVLOG.md` noting the temptation and move on.

The MVP is **one pond, one great loop**. Everything else is feature creep.
