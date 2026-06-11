import * as THREE from 'three';

import { SPECIES_IDS, speciesTuning, type SpeciesId } from '@/game/fish/species';

export function createSpeciesSilhouettes(): Map<SpeciesId, THREE.CanvasTexture> {
  const map = new Map<SpeciesId, THREE.CanvasTexture>();

  for (const species of SPECIES_IDS) {
    const texture = createSpeciesSilhouette(species);
    if (texture) {
      map.set(species, texture);
    }
  }

  return map;
}

export function createGenericSilhouette(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  // A soft, shapeless smudge — "something moved out there," with no species or
  // size tell. Feathered radial alpha so a far fish reads as a blur on the dark
  // water, not a readable fish (21_THE_REVEAL).
  const cx = size / 2;
  const cy = size / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
  gradient.addColorStop(0, 'rgba(13, 18, 18, 1)');
  gradient.addColorStop(0.55, 'rgba(13, 18, 18, 0.82)');
  gradient.addColorStop(1, 'rgba(13, 18, 18, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, cy, cx, cy * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.anisotropy = 4;
  return texture;
}

export function createSpeciesSilhouette(species: SpeciesId): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const tuning = speciesTuning(species);
  const aspect = tuning.widthM / tuning.heightM;
  const targetHeight = 80;
  const targetWidth = Math.max(64, Math.round(targetHeight * aspect));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  ctx.fillStyle = '#0d1212';
  drawSpeciesSilhouette(species, ctx, targetWidth, targetHeight);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.anisotropy = 4;
  return texture;
}

export function drawSpeciesSilhouette(species: SpeciesId, ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cy = h / 2;

  switch (species) {
    case 'bronze_carp': {
      ctx.beginPath();
      ctx.moveTo(w * 0.06, cy);
      ctx.bezierCurveTo(w * 0.05, cy - h * 0.46, w * 0.34, cy - h * 0.48, w * 0.54, cy - h * 0.34);
      ctx.bezierCurveTo(w * 0.7, cy - h * 0.28, w * 0.76, cy - h * 0.18, w * 0.79, cy);
      ctx.lineTo(w * 0.97, cy - h * 0.34);
      ctx.lineTo(w * 0.88, cy);
      ctx.lineTo(w * 0.97, cy + h * 0.34);
      ctx.lineTo(w * 0.79, cy);
      ctx.bezierCurveTo(w * 0.76, cy + h * 0.18, w * 0.7, cy + h * 0.28, w * 0.54, cy + h * 0.34);
      ctx.bezierCurveTo(w * 0.34, cy + h * 0.48, w * 0.05, cy + h * 0.46, w * 0.06, cy);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.42, cy + h * 0.32);
      ctx.lineTo(w * 0.6, cy + h * 0.5);
      ctx.lineTo(w * 0.52, cy + h * 0.32);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case 'moss_bass': {
      ctx.beginPath();
      ctx.moveTo(w * 0.04, cy - h * 0.04);
      ctx.bezierCurveTo(w * 0.04, cy - h * 0.4, w * 0.32, cy - h * 0.44, w * 0.58, cy - h * 0.36);
      ctx.bezierCurveTo(w * 0.72, cy - h * 0.32, w * 0.78, cy - h * 0.2, w * 0.8, cy);
      ctx.lineTo(w * 0.96, cy - h * 0.38);
      ctx.lineTo(w * 0.86, cy);
      ctx.lineTo(w * 0.96, cy + h * 0.38);
      ctx.lineTo(w * 0.8, cy);
      ctx.bezierCurveTo(w * 0.78, cy + h * 0.2, w * 0.72, cy + h * 0.32, w * 0.58, cy + h * 0.36);
      ctx.bezierCurveTo(w * 0.32, cy + h * 0.44, w * 0.04, cy + h * 0.4, w * 0.04, cy + h * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.36, cy - h * 0.36);
      ctx.lineTo(w * 0.46, cy - h * 0.58);
      ctx.lineTo(w * 0.5, cy - h * 0.36);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case 'moon_minnow': {
      ctx.beginPath();
      ctx.moveTo(w * 0.1, cy);
      ctx.bezierCurveTo(w * 0.1, cy - h * 0.22, w * 0.4, cy - h * 0.24, w * 0.62, cy - h * 0.18);
      ctx.bezierCurveTo(w * 0.72, cy - h * 0.16, w * 0.78, cy - h * 0.1, w * 0.8, cy);
      ctx.lineTo(w * 0.97, cy - h * 0.4);
      ctx.lineTo(w * 0.85, cy);
      ctx.lineTo(w * 0.97, cy + h * 0.4);
      ctx.lineTo(w * 0.8, cy);
      ctx.bezierCurveTo(w * 0.78, cy + h * 0.1, w * 0.72, cy + h * 0.16, w * 0.62, cy + h * 0.18);
      ctx.bezierCurveTo(w * 0.4, cy + h * 0.24, w * 0.1, cy + h * 0.22, w * 0.1, cy);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case 'old_kingfish': {
      ctx.beginPath();
      ctx.moveTo(w * 0.03, cy);
      ctx.bezierCurveTo(w * 0.03, cy - h * 0.36, w * 0.28, cy - h * 0.44, w * 0.5, cy - h * 0.44);
      ctx.bezierCurveTo(w * 0.68, cy - h * 0.44, w * 0.78, cy - h * 0.3, w * 0.82, cy);
      ctx.lineTo(w * 0.98, cy - h * 0.46);
      ctx.lineTo(w * 0.88, cy);
      ctx.lineTo(w * 0.98, cy + h * 0.46);
      ctx.lineTo(w * 0.82, cy);
      ctx.bezierCurveTo(w * 0.78, cy + h * 0.3, w * 0.68, cy + h * 0.44, w * 0.5, cy + h * 0.44);
      ctx.bezierCurveTo(w * 0.28, cy + h * 0.44, w * 0.03, cy + h * 0.36, w * 0.03, cy);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.3, cy - h * 0.42);
      ctx.lineTo(w * 0.5, cy - h * 0.66);
      ctx.lineTo(w * 0.54, cy - h * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.34, cy + h * 0.42);
      ctx.lineTo(w * 0.48, cy + h * 0.6);
      ctx.lineTo(w * 0.5, cy + h * 0.42);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case 'reed_pike': {
      ctx.beginPath();
      ctx.moveTo(w * 0.01, cy);
      ctx.bezierCurveTo(w * 0.04, cy - h * 0.12, w * 0.32, cy - h * 0.22, w * 0.64, cy - h * 0.22);
      ctx.bezierCurveTo(w * 0.76, cy - h * 0.22, w * 0.84, cy - h * 0.16, w * 0.86, cy);
      ctx.lineTo(w * 0.96, cy - h * 0.28);
      ctx.lineTo(w * 0.9, cy);
      ctx.lineTo(w * 0.96, cy + h * 0.28);
      ctx.lineTo(w * 0.86, cy);
      ctx.bezierCurveTo(w * 0.84, cy + h * 0.16, w * 0.76, cy + h * 0.22, w * 0.64, cy + h * 0.22);
      ctx.bezierCurveTo(w * 0.32, cy + h * 0.22, w * 0.04, cy + h * 0.12, w * 0.01, cy);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.62, cy - h * 0.22);
      ctx.lineTo(w * 0.74, cy - h * 0.46);
      ctx.lineTo(w * 0.78, cy - h * 0.22);
      ctx.closePath();
      ctx.fill();
      return;
    }
  }
}
