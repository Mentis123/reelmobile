export type DevChecklistItem = {
  id: string;
  text: string;
};

export type DevChecklist = {
  milestone: 'm0' | 'm1' | 'm1.5' | 'm2' | 'm3' | 'm3.1' | 'm3.2' | 'far-water';
  title: string;
  items: DevChecklistItem[];
};

export const checklists: Record<DevChecklist['milestone'], DevChecklist> = {
  m0: {
    milestone: 'm0',
    title: 'M0 shell gate',
    items: [
      { id: 'home-loads', text: 'Laptop loads / and shows Reel Mobile with Tap to begin.' },
      { id: 'game-loads', text: 'Mobile loads /game via the QR code.' },
      { id: 'dev-qr', text: '/dev shows local network URL, QR code, and current candidate tag.' },
      { id: 'routes', text: '/game and /tune routes exist without errors.' },
      { id: 'vercel', text: 'Vercel deploy succeeds and is reachable on phone.' }
    ]
  },
  m1: {
    milestone: 'm1',
    title: 'M1 vertical slice real-iPhone gate',
    items: [
      { id: 'intent', text: "Within 10 seconds of tapping in, do I understand what I'm supposed to do?" },
      { id: 'cast', text: 'Within 3 seconds of trying, can I successfully cast?' },
      { id: 'cue', text: 'Do I see at least one ambiguous fish-like cue within 15 seconds?' },
      { id: 'reaction', text: 'When my lure splashes near a cue, does something react believably?' },
      { id: 'bite', text: 'Does the bite moment register clearly through audio and visual feedback?' },
      { id: 'hook', text: 'When I successfully hook, does it feel decisive?' },
      { id: 'tension', text: 'During the fight, does line tension communicate through the line itself?' },
      { id: 'failure', text: 'Does at least one failure mode feel learnable rather than buggy?' },
      { id: 'story', text: 'Does the result screen tell a tiny story rather than show stats?' },
      { id: 'repeat', text: 'After one full cycle, do I want to cast again?' }
    ]
  },
  'm1.5': {
    milestone: 'm1.5',
    title: 'M1.5 rod control real-iPhone gate',
    items: [
      { id: 'intent', text: "Within 10 seconds of tapping in, do I understand what I'm supposed to do?" },
      { id: 'cast', text: 'Within 3 seconds of trying, can I successfully cast?' },
      { id: 'cue', text: 'Do I see at least one ambiguous fish-like cue within 15 seconds?' },
      { id: 'reaction', text: 'When my lure splashes near a cue, does something react believably?' },
      { id: 'rod-control', text: 'After the lure lands, can I drag the rod or handle to pull the lure without recasting?' },
      { id: 'bite', text: 'Does the bite moment register clearly through audio and visual feedback?' },
      { id: 'hook', text: 'When I successfully hook, does it feel decisive?' },
      { id: 'tension', text: 'Can I read slack, sweet spot, and danger through line, rod bend, lure motion, and audio before relying on the HUD?' },
      { id: 'failure', text: 'Does at least one failure mode feel learnable rather than buggy?' },
      { id: 'repeat', text: 'After one full cycle, do I want to cast again?' }
    ]
  },
  m2: {
    milestone: 'm2',
    title: 'M2 pond visuals real-iPhone gate',
    items: [
      { id: 'coherent', text: 'Does the pond look like the art direction describes: still, cosy, twilight, ink-wash, and tactile?' },
      { id: 'fps', text: 'Does it hold 60fps on iPhone 13 or better during a short fishing loop?' },
      { id: 'focus', text: 'Does press-and-hold Focus mode visibly reduce water glare?' },
      { id: 'reeds-dock', text: 'Are reeds, dock, and water visually coherent with the palette?' },
      { id: 'playability', text: 'Do the new visuals preserve casting, lure twitch, rod control, bite, hook, fight, failures, and result flow?' }
    ]
  },
  m3: {
    milestone: 'm3',
    title: 'M3 fish variety real-iPhone gate',
    items: [
      { id: 'silhouettes', text: 'Can I distinguish five fish by silhouette alone, without labels in the pond?' },
      { id: 'cue-signatures', text: 'Do bubbles, glints, surface rises, silt, and wakes feel detectably different?' },
      { id: 'same-species', text: 'Do two same-species encounters feel slightly different because of personality?' },
      { id: 'density', text: 'Does fish density feel right: not crowded, not empty?' },
      { id: 'loop-preserved', text: 'Are casting, twitch, rod control, bite, hook, fight, failures, result, debug HUD, /dev, and /tune preserved?' }
    ]
  },
  'm3.1': {
    milestone: 'm3.1',
    title: 'M3.1 fish feel-repair real-iPhone gate',
    items: [
      { id: 'silhouettes', text: 'Can I tell pike from carp from minnow by body shape before I see what they do?' },
      { id: 'cue-signatures', text: 'Do bubbles, glints, rises, silt, and wakes read more clearly than before?' },
      { id: 'same-species', text: 'Do two encounters of the same species feel different in approach, hesitation, or fight?' },
      { id: 'fight', text: 'During the fight, does the fish surge back against the reel so I have to ease off?' },
      { id: 'loop-preserved', text: 'Are casting, twitch, rod control, bite, hook, failures, result, debug HUD, /dev, and /tune preserved?' }
    ]
  },
  'm3.2': {
    milestone: 'm3.2',
    title: 'M3.2 pond-polish real-iPhone gate',
    items: [
      { id: 'fish-visible', text: 'Over the deeper water, can I still find a fish — is it a shadow I have to read, NOT invisible?' },
      { id: 'fish-not-blob', text: 'And the other way: is the fish NOT over-resolved into a hard black blob sitting on top of the water?' },
      { id: 'water-vs-void', text: 'Does the water now read as separate from the surround, instead of dissolving into a same-colour background?' },
      { id: 'seam', text: 'Backdrop seam: does the treeline base still melt into the far water, or does the fog/mist boundary show a line?' },
      { id: 'placement', text: 'Does the treeline still fill the top strip across portrait, tall, and wide?' },
      { id: 'caustics-focus', text: 'Do the caustics visibly calm when I hold Focus, and stop competing with cues in the foreground?' },
      { id: 'loop-preserved', text: 'Are casting, twitch, rod control, bite, hook, fight, failures, result, debug HUD, /dev, and /tune all preserved?' }
    ]
  },
  'far-water': {
    milestone: 'far-water',
    title: 'The far water real-iPhone gate (19_THE_FAR_WATER)',
    items: [
      { id: 'distance', text: 'Does the water feel like it stretches away to a far shore — is distance a real dimension, not a flat slab?' },
      { id: 'murk', text: 'Far out, is it murky — do I see movement, not a clear fish — while the near water reads clearly?' },
      { id: 'reach', text: 'Can I cast all the way out near the far shore, AND drop one in close by the bank?' },
      { id: 'accuracy', text: 'Does a long cast land near-but-not-on where I aimed, while a short cast lands true? Does that read as a mechanic, not a bug?' },
      { id: 'reveal', text: 'Can I lure a far fish in and watch it resolve out of the dark into water I can read — the reel-the-mystery-in moment?' },
      { id: 'rod', text: 'Is the rod doubled, anchored in the bottom-right corner, pointing toward the middle, and swaying to track where I aim?' },
      { id: 'no-dock', text: 'Is the dock gone and the scene still coherent (no floating gap where it was)?' },
      { id: 'loop-preserved', text: 'Do twitch, bite, hook, fight, failures, result, the deeper water + reframed backdrop, /dev and /tune all still hold?' }
    ]
  }
};

export function getChecklist(milestone: string): DevChecklist {
  if (milestone === 'far-water') {
    return checklists['far-water'];
  }

  if (milestone === 'm3.2') {
    return checklists['m3.2'];
  }

  if (milestone === 'm3.1') {
    return checklists['m3.1'];
  }

  if (milestone === 'm3') {
    return checklists.m3;
  }

  if (milestone === 'm2') {
    return checklists.m2;
  }

  if (milestone === 'm1.5') {
    return checklists['m1.5'];
  }

  return milestone === 'm1' ? checklists.m1 : checklists.m0;
}
