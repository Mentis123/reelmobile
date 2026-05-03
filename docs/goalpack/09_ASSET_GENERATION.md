# 09_ASSET_GENERATION

## Tiered placeholder rule

| Tier | Allowed in M1 | Allowed in M2+ | Allowed in M6+ |
|------|---------------|----------------|----------------|
| **Gameplay** (cast, line, hook, tension, fish AI) | Real, no placeholder | Real | Real |
| **Core art** (water, fish, lure, rod, line, UI) | Grey-box OK | Final art required | Final art |
| **Decorative art** (reeds, rocks, dock detail, distant background, particles) | Grey-box OK | Grey-box OK | Final art |

**Definitions:**
- **Core** = pond water surface, fish, lure, rod, line, primary UI elements (cast preview, tension indicator, result card)
- **Decorative** = reeds, rocks, dock planks beyond first plank, distant background, ambient particles, weather effects

Anything not on the core list is decorative by default. Agent does not get to reclassify.

## Asset manifest format

Every asset listed here. Format:

```
### asset_id
- Filename: /public/assets/<path>
- Dimensions: WxH or model spec
- Format: png|webp|gltf|wav|mp3
- Tier: core | decorative
- Source: generated | sourced | hand-made
- Generation prompt: <exact prompt for image-gen>
- Acceptance criteria:
  - <criterion 1>
  - <criterion 2>
```

## Phase A assets (M1, grey-box)

Procedural geometry only. No image assets required.

- Water plane: `THREE.PlaneGeometry` with custom shader
- Fish: simple gradient sprite billboard or low-poly mesh
- Lure: small sphere with emissive material
- Rod: tapered cylinder
- Reeds: instanced cones
- UI: HTML/CSS, no images

## Phase B core assets (M2)

### asset: pond_water_normal_map
- Filename: `/public/assets/textures/water_normal.webp`
- Dimensions: 512×512, tileable
- Format: webp
- Tier: core
- Source: generated
- Generation prompt:
  > Seamless tileable water surface normal map for a calm pond at twilight. Subtle gentle ripples, slightly directional flow. Low frequency detail. RGB normal map format. No high-frequency noise.
- Acceptance:
  - Tileable (no visible seams)
  - Subtle, not aggressive ripples
  - Works at 512×512 without scaling artefacts

### asset: fish_generic_silhouette
- Filename: `/public/assets/sprites/fish_generic.webp`
- Dimensions: 512×256
- Format: webp with transparency
- Tier: core
- Source: generated
- Generation prompt:
  > Top-down silhouette of a freshwater fish for a cosy mobile fishing game. Transparent background. Deep charcoal body with subtle gradient. Soft ink-wash style. Readable tail and fins. No hard outline. No text. No logo. Painterly but clean.
- Acceptance:
  - Readable at 80px wide on mobile
  - Transparent background
  - Matches pond palette (charcoal-leaning)

### asset: lure_default
- Filename: `/public/assets/sprites/lure_default.webp`
- Dimensions: 128×128
- Format: webp with transparency
- Tier: core
- Source: generated
- Generation prompt:
  > Small fishing lure, side view, transparent background. Mossy green body with tiny gold flash detail, subtle shine. Painterly, not photoreal. No text. No outline.
- Acceptance:
  - Readable at 32px on mobile
  - Transparent background
  - Has subtle highlight that can be tinted in shader

### asset: dock_planks
- Filename: `/public/assets/textures/dock_planks.webp`
- Dimensions: 1024×512, tileable
- Format: webp
- Tier: core
- Source: generated
- Generation prompt:
  > Weathered wooden dock planks viewed from above, tileable, warm brown tones. Knots and grain visible but not noisy. Slight moss in cracks. Painterly. No nails, no text.
- Acceptance:
  - Tileable horizontally
  - Reads as wood at distance and close-up
  - Warm tone matches `--dock-warm` palette

### asset: ui_wordmark
- Filename: `/public/assets/ui/wordmark.svg`
- Format: svg
- Tier: core
- Source: hand-made (vector)
- Spec: "Reel Mobile" set in display serif italic, single colour, sized for mobile splash

## Phase B fish species (M3)

Repeat the fish_generic format for each species, with prompt variations:

- `fish_bronze_carp` — rounded body, bronze-gold gradient, prominent barbels suggested in silhouette
- `fish_moss_bass` — broad body, deep moss-green gradient, sharp dorsal silhouette
- `fish_moon_minnow` — slender, silver-white gradient, dramatic forked tail
- `fish_old_kingfish` — long, slow body, deep charcoal with bronze edges, weathered fin silhouette
- `fish_reed_pike` — torpedo silhouette, dark green, aggressive jaw line readable in profile

Each acceptance criterion: distinguishable from the others at 80px width without colour cue.

## Phase B audio (M6)

Procedural in M1. Sourced/generated in M6.

### audio: ambient_pond_loop
- Filename: `/public/assets/audio/ambient_pond.ogg`
- Format: ogg + mp3 fallback
- Length: 90s seamless loop
- Tier: core
- Source: sourced (Freesound CC0) or generated
- Acceptance:
  - Loops without click
  - Mostly low-frequency water and distant insect texture
  - No identifiable bird species (avoids region-specific cues)

(Repeat format for: cast_whoosh, lure_plop, lure_twitch, nibble_tick, hookset_thunk, line_zip_loop, reel_click_loop, fish_splash, line_snap, catch_chime, escape_splash.)

## Hard rules

- **Never generate copyrighted characters, IPs, names, or logos.**
- **Never reference Zelda, Pokémon, Studio Ghibli, or other identifiable IPs in prompts.**
- **All assets stored in `/public/assets/` with subfolders by type.**
- **All assets listed in this file with full prompt and acceptance criteria.**
- **If a generated asset fails acceptance twice, write to `DEVLOG.md` and stop generating.** Do not silently lower the bar.
- **Strip metadata from generated images** before commit (no embedded prompts, dates, model IDs).
