import { SPECIES_IDS, type SpeciesId } from '@/game/fish/species';
import {
  SPECIES_ART,
  drawSpeciesTrophy,
  speciesLabel,
  trophyLengthCm,
  trophySizeWord
} from '@/game/fish/trophy';

export type CatchCardData = {
  species: string;
  sizeScore: number;
  durationMs: number;
  nearSnaps: number;
  // Carried from ResultCatch: lets the shared card brag on the player's
  // behalf ("PERSONAL BEST") — their own history only, never a leaderboard.
  personalBest?: 'first' | 'overall' | 'species';
};

function isKnownSpecies(species: string): species is SpeciesId {
  return (SPECIES_IDS as string[]).includes(species);
}

function fightLine(c: CatchCardData): string {
  const seconds = Math.round(c.durationMs / 1000);
  const duration = seconds >= 1 ? `${seconds}s` : 'under a second';
  const struggle = c.nearSnaps >= 2 ? 'nearly snapped twice' : c.nearSnaps === 1 ? 'almost lost it once' : 'a steady fight';
  return `${duration} · ${struggle}`;
}

async function loadArt(src: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.src = src; // same-origin (/assets/fish/...), so the canvas stays untainted
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

/**
 * Compose a shareable catch card (the trophy fish + the catch's stats) and return
 * it as a PNG blob. Mirrors the on-screen Caught card so the share matches what the
 * player saw. (Chapter 7 / 20_ROADMAP.) Returns null if canvas isn't available.
 */
export async function renderCatchCard(c: CatchCardData): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background — the same moonlit dark gradient as the in-game card.
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.4, 80, W * 0.5, H * 0.5, H * 0.8);
  bg.addColorStop(0, '#16242b');
  bg.addColorStop(1, '#070d11');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Fish — the baked-oval art if we have it, else the procedural trophy.
  const fishRect = { x: 80, y: 150, w: W - 160, h: 560 };
  const art = isKnownSpecies(c.species) ? SPECIES_ART[c.species] : undefined;
  const img = art ? await loadArt(art) : null;
  if (img) {
    const scale = Math.min(fishRect.w / img.width, fishRect.h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, fishRect.x + (fishRect.w - dw) / 2, fishRect.y + (fishRect.h - dh) / 2, dw, dh);
  } else if (isKnownSpecies(c.species)) {
    ctx.save();
    ctx.translate(fishRect.x, fishRect.y);
    drawSpeciesTrophy(ctx, fishRect.w, fishRect.h, c.species, c.sizeScore);
    ctx.restore();
  }

  // Text block.
  ctx.textAlign = 'center';
  const cx = W * 0.5;

  // The recognition line a friend actually sees: a personal best outranks a
  // plain "landed" on the share itself.
  const eyebrow = c.personalBest === 'first'
    ? 'FIRST CATCH'
    : c.personalBest
      ? 'PERSONAL BEST'
      : 'LANDED';
  ctx.fillStyle = c.personalBest ? 'rgba(222, 190, 110, 1)' : 'rgba(200, 168, 92, 0.9)';
  ctx.font = '600 30px system-ui, -apple-system, sans-serif';
  ctx.fillText(eyebrow.split('').join(' '), cx, 830);

  ctx.fillStyle = '#e9eef3';
  ctx.font = '600 92px Georgia, "Times New Roman", serif';
  ctx.fillText(speciesLabel(c.species), cx, 928);

  ctx.fillStyle = '#c8d2da';
  ctx.font = '400 44px system-ui, -apple-system, sans-serif';
  const lengthPart = isKnownSpecies(c.species) ? `${trophyLengthCm(c.species, c.sizeScore)} cm · ` : '';
  ctx.fillText(`${lengthPart}${trophySizeWord(c.sizeScore)}`, cx, 1000);

  ctx.fillStyle = 'rgba(201, 212, 220, 0.7)';
  ctx.font = '400 34px system-ui, -apple-system, sans-serif';
  ctx.fillText(fightLine(c), cx, 1058);

  // Footer wordmark.
  ctx.strokeStyle = 'rgba(201, 212, 220, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W * 0.32, 1200);
  ctx.lineTo(W * 0.68, 1200);
  ctx.stroke();

  ctx.fillStyle = 'rgba(200, 168, 92, 0.92)';
  ctx.font = '600 38px Georgia, "Times New Roman", serif';
  ctx.fillText('REEL MOBILE', cx, 1262);
  ctx.fillStyle = 'rgba(201, 212, 220, 0.45)';
  ctx.font = '400 26px system-ui, -apple-system, sans-serif';
  ctx.fillText('reelmobile.vercel.app', cx, 1304);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
