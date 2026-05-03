# 08_ART_DIRECTION

## Mood

Still. Mysterious. Cosy. Twilight. Ink-wash. Soft. Tactile.

The pond is a small premium diorama. The player is leaning on a wooden dock. The world ends 20 metres past the far reeds. There is no horizon, no sky drama, no characters, no quest markers.

## Visual target

A pond you'd want to put on a phone wallpaper even if you weren't fishing in it.

## Camera

**Fixed cinematic angle.** No free orbit. No first-person.

- Pitch: roughly 35° looking down toward water
- Position: low above the dock
- Player can move **left/right** along the dock (limited rail)
- Player can **focus zoom** slightly (Focus gesture per `04`)
- Camera dampens during Focus mode

The player moves around the edge of the pond. The camera stays composed.

## Palette

Five core colours, two accents.

```
--water-deep:    #1a2b30   (deep pond)
--water-shallow: #2f4948   (shore water)
--reed-green:    #4a5d3a   (foliage)
--dock-warm:     #6b4a32   (wood)
--moonlight:     #c8c4b2   (silver wash)
--ui-gold:       #c8a85c   (accent, used sparingly)
--ink-charcoal:  #1a1a1a   (fish silhouettes, line)
```

UI text on dark water: `--moonlight` with subtle drop shadow.
UI accent (cast power, tension peak): `--ui-gold`.

## Typography

- **Display:** one serif with calm authority — recommend `Cormorant Garamond` or `EB Garamond` (free, mobile-loadable)
- **UI:** one geometric sans — recommend `Inter` or `Manrope`
- Weight rules: display in 400 italic for atmosphere, UI in 500 for legibility on small screens
- Line height 1.4 for prose, 1.2 for UI

## Fish

- **Silhouette first.** Readable as a dark shape before any detail.
- Subtle gradient body, no hard outlines.
- Soft inner glow at fin edges (specular highlight)
- Exaggerated tail movement (cartoon physics, not realism)
- **No hard cartoon outlines.** Ink-wash, not Pokémon.
- Rare fish identifiable by behaviour and silhouette proportions, not by colour palette swap.

## Water

- Layered:
  1. Surface: gentle normal-mapped ripples, slow scroll
  2. Subsurface: depth fade from `--water-shallow` to `--water-deep`
  3. Fresnel rim where water meets dock and reeds
- Specular highlights: soft, broad, low frequency. **Glare reduces during Focus mode.**
- Refraction is faked — no expensive screen-space passes in M1.

## Reeds and dock

- Reeds: instanced low-poly clusters, gentle wind sway via vertex shader
- Dock: low-poly planks, hand-painted texture, warm wood tone
- Background: painted card with reeds and trees, slight parallax on camera move

## UI

- Minimal. Thin lines. Generous whitespace. No skeuomorphism.
- No fishing-game chrome (no fake reels, no leather textures, no wood-grain panels)
- HUD is one line of text + one tension indicator + one power arc
- Result screen is text + a thin frame, no gold filigree

## Animation principles

- Slow ease-in / fast ease-out for fish movement (predator pause-and-strike)
- No bouncy easing on UI (this is a quiet game)
- Particles are sparse and meaningful — every splash exists for a reason
- Screen shake exists only on snap (small, sharp, single shake)

## Reference moods

(Embed in repo as `docs/goalpack/refs/` once available.)

- *Studio Ghibli pond scenes* — twilight palette, intimate scale
- *Ocarina of Time fishing pond* — fixed camera, contemplative pace, mystery beneath surface
- *Sayonara Wild Hearts* — restrained UI, atmospheric colour
- *Alto's Odyssey* — silhouette-forward art, mood over detail

**Do not copy any of these.** They are mood references, not asset references. No Zelda IP, no Ghibli characters, no Alto's Odyssey assets.

## Anti-references

- Generic mobile fishing games with cartoon faces on fish
- Bass Pro Shops realism
- "Loot box" colour-rarity hierarchies (no green/blue/purple/gold rarity)
- Skeuomorphic wood-and-leather UIs
- Tutorial pop-ups with arrows and exclamation marks
