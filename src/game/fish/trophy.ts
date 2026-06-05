import { TUNING } from '@/game/tuning/tuning';
import { SPECIES_STORY_LABELS, type SpeciesId } from '@/game/fish/species';

// Upgrade seam: if a hand-generated hero plate exists for a species, FishPortrait
// renders it instead of the procedural draw. Keep these as side-profile, head-left,
// transparent-background, moonlit-palette art matched to 08_ART_DIRECTION. Empty
// until art is generated — the procedural render is the always-present default.
export const SPECIES_ART: Partial<Record<SpeciesId, string>> = {
  bronze_carp: '/assets/fish/bronze_carp.webp',
  moss_bass: '/assets/fish/moss_bass.webp',
  moon_minnow: '/assets/fish/moon_minnow.webp',
  old_kingfish: '/assets/fish/old_kingfish.webp',
  reed_pike: '/assets/fish/reed_pike.webp'
};

type TrophyProfile = {
  /** dorsal/back edge — catches the moonlight */
  back: string;
  /** mid-body fill */
  body: string;
  /** lit underside */
  belly: string;
  fin: string;
  eye: string;
  /** moonlit rim highlight on the back edge */
  rim: string;
  marking: 'scales' | 'mottle' | 'stripe' | 'scars' | 'bars';
  /** 0 = mid-back dorsal, 1 = set far back (pike) */
  dorsalAt: number;
  /** extra body depth multiplier on top of the species aspect ratio */
  plumpness: number;
};

// Nocturnal, desaturated, moonlit. Differentiation is mostly silhouette (driven by
// the species' real widthM:heightM) plus a tint and a marking hint — mood over detail.
const PROFILES: Record<SpeciesId, TrophyProfile> = {
  bronze_carp: { back: '#5f4226', body: '#9c6e3c', belly: '#d2a862', fin: '#74512c', eye: '#f2dca0', rim: '#e7cf9a', marking: 'scales', dorsalAt: 0.1, plumpness: 1.12 },
  moss_bass: { back: '#33401f', body: '#5f6e3e', belly: '#a3b079', fin: '#45542c', eye: '#e7eccb', rim: '#cdd8a8', marking: 'mottle', dorsalAt: 0.18, plumpness: 1.0 },
  moon_minnow: { back: '#5d6b78', body: '#aeb9c4', belly: '#e6edf4', fin: '#8b97a4', eye: '#f5fbff', rim: '#f0f6fb', marking: 'stripe', dorsalAt: 0.12, plumpness: 0.92 },
  old_kingfish: { back: '#222a30', body: '#46535c', belly: '#828f98', fin: '#333e45', eye: '#d8af52', rim: '#aeb9c2', marking: 'scars', dorsalAt: 0.14, plumpness: 1.05 },
  reed_pike: { back: '#33421f', body: '#566b3c', belly: '#bdc48c', fin: '#44542c', eye: '#e9eecb', rim: '#cfd9a6', marking: 'bars', dorsalAt: 0.72, plumpness: 0.86 }
};

const SIZE_RANGE = TUNING.fish.catchMaxSizeScore - TUNING.fish.catchMinSizeScore;

function sizeT(sizeScore: number): number {
  if (SIZE_RANGE <= 0) return 0.5;
  return Math.min(1, Math.max(0, (sizeScore - TUNING.fish.catchMinSizeScore) / SIZE_RANGE));
}

export function trophyLengthCm(species: SpeciesId, sizeScore: number): number {
  const baseM = TUNING.fish.species[species].widthM;
  const t = sizeT(sizeScore);
  // Body length scales the species' base by ±~18% with the catch's size score.
  return Math.round(baseM * 100 * (0.85 + t * 0.33));
}

export function trophySizeWord(sizeScore: number): string {
  if (sizeScore > 0.7) return 'a heavy one';
  if (sizeScore > 0.4) return 'a solid one';
  return 'a small one';
}

export function speciesLabel(species: string): string {
  return SPECIES_STORY_LABELS[species as SpeciesId] ?? 'Pond Fish';
}

// Deterministic per-species marking placement so a given species always draws the
// same — stable across re-renders and the preview gallery.
function seededRng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashSpecies(species: SpeciesId): number {
  let h = 0;
  for (let i = 0; i < species.length; i += 1) h = (h * 31 + species.charCodeAt(i)) | 0;
  return Math.abs(h) + 1;
}

/**
 * Draw a moonlit side-profile trophy fish, head to the left, fit to the ctx box.
 * Transparent background — the card frames it. Pure canvas, no assets.
 */
export function drawSpeciesTrophy(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  species: SpeciesId,
  sizeScore: number
): void {
  const p = PROFILES[species];
  const tuning = TUNING.fish.species[species];
  const aspect = tuning.widthM / Math.max(0.001, tuning.heightM); // length : depth
  ctx.clearRect(0, 0, width, height);

  const cx = width * 0.5;
  const cy = height * 0.54;
  // Fit the body to ~82% of the box on its longest axis, honouring the aspect.
  const boxLen = width * 0.82;
  const maxDepth = height * 0.64;
  let L = boxLen;
  let D = (L / aspect) * p.plumpness;
  if (D > maxDepth) {
    D = maxDepth;
    L = (D / p.plumpness) * aspect;
  }
  const noseX = cx - L * 0.5;
  const bodyTailX = cx + L * 0.4;
  const finTipX = cx + L * 0.5;
  const rng = seededRng(hashSpecies(species));

  ctx.save();

  // Soft glow halo behind the catch — the moonlit "trophy" pop.
  const glow = ctx.createRadialGradient(cx, cy, D * 0.2, cx, cy, L * 0.62);
  glow.addColorStop(0, 'rgba(205, 216, 224, 0.20)');
  glow.addColorStop(1, 'rgba(205, 216, 224, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Tail fin (caudal) — notched, behind the body.
  ctx.beginPath();
  ctx.moveTo(bodyTailX, cy);
  ctx.lineTo(finTipX, cy - D * 0.5);
  ctx.quadraticCurveTo(cx + L * 0.44, cy, finTipX, cy + D * 0.5);
  ctx.closePath();
  ctx.fillStyle = p.fin;
  ctx.fill();

  // Body path.
  const bodyPath = new Path2D();
  bodyPath.moveTo(noseX, cy);
  // top profile: nose -> back peak -> caudal peduncle
  bodyPath.bezierCurveTo(noseX + L * 0.12, cy - D * 0.42, cx - L * 0.12, cy - D * 0.5, cx + L * 0.08, cy - D * 0.34);
  bodyPath.quadraticCurveTo(bodyTailX, cy - D * 0.22, bodyTailX, cy - D * 0.12);
  // tail peduncle down
  bodyPath.lineTo(bodyTailX, cy + D * 0.12);
  // bottom profile: peduncle -> belly -> nose
  bodyPath.quadraticCurveTo(bodyTailX, cy + D * 0.24, cx + L * 0.08, cy + D * 0.36);
  bodyPath.bezierCurveTo(cx - L * 0.12, cy + D * 0.52, noseX + L * 0.12, cy + D * 0.44, noseX, cy);
  bodyPath.closePath();

  // Body fill: belly (lit, lower) -> back (dark, upper). Moonlight from above.
  const bodyGrad = ctx.createLinearGradient(0, cy - D * 0.5, 0, cy + D * 0.5);
  bodyGrad.addColorStop(0, p.back);
  bodyGrad.addColorStop(0.5, p.body);
  bodyGrad.addColorStop(1, p.belly);
  ctx.fillStyle = bodyGrad;
  ctx.fill(bodyPath);

  // Dorsal fin — a soft sail on the back, placed by dorsalAt.
  const dorsalX = cx - L * 0.1 + p.dorsalAt * L * 0.5;
  const dorsalTopY = cy - D * (0.5 + 0.18);
  ctx.beginPath();
  ctx.moveTo(dorsalX - L * 0.12, cy - D * 0.36);
  ctx.quadraticCurveTo(dorsalX, dorsalTopY, dorsalX + L * 0.12, cy - D * 0.32);
  ctx.closePath();
  ctx.fillStyle = p.fin;
  ctx.fill();

  // Pectoral fin behind the gill.
  ctx.beginPath();
  ctx.moveTo(noseX + L * 0.26, cy + D * 0.08);
  ctx.quadraticCurveTo(noseX + L * 0.34, cy + D * 0.42, noseX + L * 0.16, cy + D * 0.34);
  ctx.closePath();
  ctx.fillStyle = p.fin;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Clip markings + rim to the body.
  ctx.save();
  ctx.clip(bodyPath);

  // Species markings.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  if (p.marking === 'scales') {
    ctx.lineWidth = Math.max(1, L * 0.006);
    for (let i = 0; i < 5; i += 1) {
      const x = noseX + L * (0.32 + i * 0.12);
      ctx.beginPath();
      ctx.arc(x, cy, D * 0.34, Math.PI * 0.62, Math.PI * 1.38);
      ctx.stroke();
    }
  } else if (p.marking === 'mottle') {
    for (let i = 0; i < 9; i += 1) {
      const x = noseX + L * (0.22 + rng() * 0.62);
      const y = cy - D * 0.3 + rng() * D * 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, L * 0.04, D * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.marking === 'stripe') {
    const stripe = ctx.createLinearGradient(noseX, cy, bodyTailX, cy);
    stripe.addColorStop(0, 'rgba(245,251,255,0)');
    stripe.addColorStop(0.5, 'rgba(245,251,255,0.5)');
    stripe.addColorStop(1, 'rgba(245,251,255,0)');
    ctx.fillStyle = stripe;
    ctx.fillRect(noseX, cy - D * 0.06, L, D * 0.1);
  } else if (p.marking === 'scars') {
    ctx.strokeStyle = 'rgba(225,231,238,0.32)';
    ctx.lineWidth = Math.max(1.2, L * 0.006);
    for (let i = 0; i < 3; i += 1) {
      const x = noseX + L * (0.4 + rng() * 0.4);
      const y = cy - D * 0.2 + rng() * D * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + L * 0.06, y + D * 0.14);
      ctx.stroke();
    }
  } else if (p.marking === 'bars') {
    ctx.fillStyle = 'rgba(225,231,200,0.26)';
    for (let i = 0; i < 7; i += 1) {
      const x = noseX + L * (0.26 + i * 0.09);
      ctx.fillRect(x, cy - D * 0.4, L * 0.018, D * 0.8);
    }
  }

  // Moonlit rim along the dorsal edge.
  ctx.strokeStyle = p.rim;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = Math.max(1.5, D * 0.05);
  ctx.beginPath();
  ctx.moveTo(noseX + L * 0.04, cy - D * 0.18);
  ctx.bezierCurveTo(noseX + L * 0.12, cy - D * 0.42, cx - L * 0.12, cy - D * 0.5, cx + L * 0.08, cy - D * 0.34);
  ctx.quadraticCurveTo(bodyTailX, cy - D * 0.22, bodyTailX, cy - D * 0.12);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Gill line.
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = Math.max(1, L * 0.006);
  ctx.beginPath();
  ctx.moveTo(noseX + L * 0.2, cy - D * 0.26);
  ctx.quadraticCurveTo(noseX + L * 0.16, cy, noseX + L * 0.2, cy + D * 0.26);
  ctx.stroke();

  // Eye — the bright catchlight that sells the trophy.
  const eyeX = noseX + L * 0.1;
  const eyeY = cy - D * 0.12;
  const eyeR = Math.max(2.5, D * 0.1);
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeR * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fillStyle = p.eye;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eyeX - eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();

  ctx.restore();
}
