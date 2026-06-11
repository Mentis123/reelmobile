'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { seededRandom } from '@/game/math/vec';
import { TUNING } from '@/game/tuning/tuning';
import { createMoonTexture, createSkyTexture, createTreelineTexture } from '@/components/game/scene/textures';
import type { Runtime } from '@/components/game/types';

export function PondWater({ runtime, normalMap }: { runtime: React.MutableRefObject<Runtime>; normalMap: THREE.Texture }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uFocus: { value: 0 },
    uNormalMap: { value: normalMap },
    uDeep: { value: new THREE.Color(TUNING.visual.waterDeep) },
    uShallow: { value: new THREE.Color(TUNING.visual.waterShallow) },
    uMoonlight: { value: new THREE.Color('#c8c4b2') },
    uCanopy: { value: new THREE.Color('#3c5238') },
    uCaustic: { value: TUNING.visual.causticStrength },
    uCausticFocusMul: { value: TUNING.visual.causticFocusMultiplier },
    uGlareReduction: { value: TUNING.input.focusGlareReduction }
  }), [normalMap]);

  useFrame((_, dt) => {
    // Hold the water surface still while the explainer pauses the pond.
    if (runtime.current.pondFrozen) {
      return;
    }
    const focused = performance.now() < runtime.current.focusUntil;
    uniforms.uFocus.value = focused ? 1 : 0;
    uniforms.uTime.value += dt * (focused ? TUNING.input.focusWaterSpeedMultiplier : 1);
  });

  return (
    <mesh renderOrder={0} rotation={[-Math.PI / 2, 0, 0]} position={[0, TUNING.world.waterY, 0]}>
      <planeGeometry args={[TUNING.world.pondWidthM, TUNING.world.pondHeightM, TUNING.world.waterSegments, TUNING.world.waterSegments]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.z += sin((position.x * 1.4) + (position.y * 0.7)) * 0.018;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uFocus;
          uniform sampler2D uNormalMap;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform vec3 uMoonlight;
          uniform vec3 uCanopy;
          uniform float uCaustic;
          uniform float uCausticFocusMul;
          uniform float uGlareReduction;
          varying vec2 vUv;

          void main() {
            vec2 flowA = vUv * 2.0 + vec2(uTime * 0.018, uTime * 0.007);
            vec2 flowB = vUv * 1.15 + vec2(-uTime * 0.009, uTime * 0.012);
            vec3 normalA = texture2D(uNormalMap, flowA).rgb * 2.0 - 1.0;
            vec3 normalB = texture2D(uNormalMap, flowB).rgb * 2.0 - 1.0;
            vec3 normal = normalize(vec3(normalA.xy * 0.58 + normalB.xy * 0.28, 1.0));
            float depth = smoothstep(0.02, 0.92, vUv.y);
            float shore = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.86, vUv.y);

            // Base depth gradient (deepened palette; fish opacity is co-tuned in
            // TUNING so silhouettes still read as a shadow you have to find).
            vec3 water = mix(uShallow * 1.18, uDeep * 1.08, depth);

            // Canopy colour-bounce: the far bank's foliage tints the far water.
            float canopyReflect = smoothstep(0.55, 1.0, vUv.y);
            water = mix(water, uCanopy, canopyReflect * 0.34);

            // Faked translucency: faint dark veining hints at depth beneath,
            // kept subtle in the fishable mid-band so silhouettes still read.
            float vein = texture2D(uNormalMap, vUv * 1.6 + vec2(uTime * 0.01, -uTime * 0.013)).b;
            water *= mix(1.0, 0.9 + 0.1 * vein, depth * 0.7);

            // Moonlit caustics: shifting light filaments, dim and biased deep.
            float c1 = texture2D(uNormalMap, vUv * 3.2 + vec2(uTime * 0.03, uTime * 0.018)).g;
            float c2 = texture2D(uNormalMap, vUv * 2.1 - vec2(uTime * 0.022, uTime * 0.015)).r;
            // Bias the filaments to the far/deep band (away from the fishable
            // foreground) and collapse them under Focus so they stop competing
            // with fish cues when the player is reading the water.
            float causticBand = 0.3 + 0.55 * depth;
            float caustic = pow(clamp(c1 * c2 * 2.4, 0.0, 1.0), 2.2) * uCaustic * causticBand * mix(1.0, uCausticFocusMul, uFocus);

            float fresnel = pow(1.0 - max(normal.z, 0.0), 2.0);
            float focusGlare = 0.24 * (1.0 - uGlareReduction);
            float glint = pow(max(normal.x * 0.65 + normal.y * 0.35, 0.0), 2.0) * mix(0.34, focusGlare, uFocus);
            float wash = 0.04 + 0.035 * sin((vUv.x + vUv.y) * 8.0 + uTime * 0.24);

            water = mix(water, uMoonlight, fresnel * mix(0.24, 0.1, uFocus) + glint + wash + caustic);
            water = mix(water * 0.9, water, shore);
            gl_FragColor = vec4(water, 1.0);
          }
        `}
      />
    </mesh>
  );
}

export function Reeds({ runtime }: { runtime: React.MutableRefObject<Runtime> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const reedPositions = useMemo(() => {
    const positions: Array<{ x: number; z: number; h: number; s: number }> = [];
    const rng = seededRandom('m2-reeds');

    for (let index = 0; index < 44; index += 1) {
      const side = index % 3;
      const x = side === 0
        ? -TUNING.world.pondWidthM * 0.5 + rng() * 0.45
        : side === 1
          ? TUNING.world.pondWidthM * 0.5 - rng() * 0.45
          : (rng() - 0.5) * TUNING.world.pondWidthM;
      const z = side === 2
        ? TUNING.world.pondHeightM * 0.5 - rng() * 0.7
        : -TUNING.world.pondHeightM * 0.2 + rng() * TUNING.world.pondHeightM * 0.72;
      positions.push({ x, z, h: 0.55 + rng() * 0.75, s: rng() * Math.PI * 2 });
    }

    return positions;
  }, []);

  useFrame(({ clock }) => {
    const mesh = meshRef.current;

    if (!mesh || runtime.current.pondFrozen) {
      return;
    }

    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const scaleVec = new THREE.Vector3();

    reedPositions.forEach((reed, index) => {
      const sway = Math.sin(clock.elapsedTime * 0.7 + reed.s) * 0.08;
      quat.setFromEuler(new THREE.Euler(sway, reed.s, 0));
      scaleVec.set(0.08, reed.h, 0.08);
      matrix.compose(new THREE.Vector3(reed.x, TUNING.world.waterY + reed.h * 0.24, reed.z), quat, scaleVec);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, reedPositions.length]} frustumCulled>
      <coneGeometry args={[1, 1, 5]} />
      <meshStandardMaterial color="#4a5d3a" roughness={0.92} />
    </instancedMesh>
  );
}

export function Backdrop() {
  const sky = useMemo(() => createSkyTexture(), []);
  const treeline = useMemo(() => createTreelineTexture(), []);

  // Two coplanar walls just beyond the far water edge: sky behind (renderOrder
  // -3), treeline in front (-1). The rising moon draws at -2, between them, so
  // the foliage occludes it and it reads as being in the sky behind the trees.
  // backdropY 0.2 frames the full far shore; base at y=-1.2 tucks under the
  // water horizon, so there is no seam.
  const z = -(TUNING.world.pondHeightM * 0.5) - 0.5;
  return (
    <>
      <mesh position={[0, TUNING.visual.backdropY, z]} rotation={[TUNING.visual.backdropTilt, 0, 0]} renderOrder={-3}>
        <planeGeometry args={[18, TUNING.visual.backdropHeight]} />
        <meshBasicMaterial map={sky} transparent depthWrite={false} fog={false} />
      </mesh>
      <mesh position={[0, TUNING.visual.backdropY, z]} rotation={[TUNING.visual.backdropTilt, 0, 0]} renderOrder={-1}>
        <planeGeometry args={[18, TUNING.visual.backdropHeight]} />
        <meshBasicMaterial map={treeline} transparent depthWrite={false} fog={false} />
      </mesh>
    </>
  );
}

// The moon rises slowly through the session "like time is really passing".
// A sprite in front of the treeline, climbing from near the crowns into the sky.
export function Moon({ runtime }: { runtime: React.MutableRefObject<Runtime> }) {
  const texture = useMemo(() => createMoonTexture(), []);
  const meshRef = useRef<THREE.Mesh>(null);
  const yRef = useRef<number>(TUNING.visual.moonStartY);

  useFrame((_, delta) => {
    if (!meshRef.current || runtime.current.pondFrozen) return;
    yRef.current = Math.min(TUNING.visual.moonRiseMaxY, yRef.current + delta * TUNING.visual.moonRiseMPerSec);
    meshRef.current.position.y = yRef.current;
  });

  const span = TUNING.visual.moonRadiusM * 2.8;
  return (
    <mesh ref={meshRef} position={[TUNING.visual.moonX, TUNING.visual.moonStartY, TUNING.visual.moonZ]} renderOrder={-2}>
      <planeGeometry args={[span, span]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} fog={false} />
    </mesh>
  );
}

export function Foreshore() {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') {
      return new THREE.Texture();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Canvas top = water edge of bank; bottom = player-side grass top.
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#2a3a32');
      gradient.addColorStop(0.12, '#3a3a26');
      gradient.addColorStop(0.4, '#4a4128');
      gradient.addColorStop(0.7, '#3d4a26');
      gradient.addColorStop(1, '#314026');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Wet shoreline darkening just below the water edge.
      const wetline = ctx.createLinearGradient(0, 0, 0, 24);
      wetline.addColorStop(0, 'rgba(20, 30, 32, 0.55)');
      wetline.addColorStop(1, 'rgba(20, 30, 32, 0)');
      ctx.fillStyle = wetline;
      ctx.fillRect(0, 0, canvas.width, 24);

      // Pebble flecks across the muddy mid-band.
      ctx.fillStyle = 'rgba(72, 60, 44, 0.55)';
      for (let index = 0; index < 220; index += 1) {
        const x = (index * 41) % canvas.width;
        const y = 30 + ((index * 7) % (canvas.height - 90));
        ctx.fillRect(x, y, 2 + (index % 3), 1 + (index % 2));
      }

      // Grass tufts clustered toward the player-side (bottom of canvas).
      ctx.fillStyle = 'rgba(78, 102, 60, 0.78)';
      for (let index = 0; index < 180; index += 1) {
        const x = (index * 23) % canvas.width;
        const y = canvas.height - 10 - ((index * 17) % (canvas.height * 0.55));
        ctx.fillRect(x, y, 2 + (index % 3), 4 + (index % 6));
      }

      // Brighter grass blades near the very top of the bank.
      ctx.fillStyle = 'rgba(120, 150, 84, 0.6)';
      for (let index = 0; index < 90; index += 1) {
        const x = (index * 31) % canvas.width;
        const y = canvas.height - 4 - ((index * 11) % 28);
        ctx.fillRect(x, y, 1 + (index % 2), 5 + (index % 4));
      }
    }

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.repeat.set(2, 1);
    return map;
  }, []);

  // Bank slopes from water level at the front (z=2.5, y=0) up to the
  // raised player-side at (z=4.5, y=1.0) so it sits inside the visible
  // frustum and reads as the ground we cast over.
  const slopeRun = 2.0;
  const slopeRise = 1.0;
  const slopeLength = Math.hypot(slopeRun, slopeRise);
  const tilt = -(Math.PI / 2 + Math.atan2(slopeRise, slopeRun));

  return (
    <mesh
      renderOrder={2}
      rotation={[tilt, 0, 0]}
      position={[0, slopeRise * 0.5, 3.5]}
    >
      <planeGeometry args={[TUNING.world.pondWidthM * 1.18, slopeLength]} />
      <meshBasicMaterial
        map={texture}
        color="#a89878"
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
