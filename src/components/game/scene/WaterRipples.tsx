'use client';

import { useFrame } from '@react-three/fiber';
import { useCallback, useRef } from 'react';
import * as THREE from 'three';

import { clamp } from '@/game/math/vec';
import { TUNING } from '@/game/tuning/tuning';
import type { Ripple } from '@/components/game/types';

export function WaterRipples({ ripples }: { ripples: Ripple[] }) {
  return (
    <group>
      {ripples.map((ripple) => (
        <WaterRipple key={ripple.id} ripple={ripple} />
      ))}
    </group>
  );
}

function WaterRipple({ ripple }: { ripple: Ripple }) {
  const meshRef = useRef<THREE.Object3D | null>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const setObjectRef = useCallback((node: THREE.Object3D | null) => {
    meshRef.current = node;
  }, []);

  useFrame(() => {
    const age = performance.now() - ripple.createdAt;
    const progress = clamp(age / ripple.durationMs, 0, 1);
    const scaleValue = 0.42 + progress * 1.35;

    if (meshRef.current) {
      meshRef.current.scale.setScalar(scaleValue);
    }

    if (materialRef.current) {
      const peak = ripple.falseCue ? TUNING.fish.cueFalsePeakOpacity : TUNING.fish.cueRealPeakOpacity;
      materialRef.current.opacity = (1 - progress) * peak;
    }
  });

  const opacity = ripple.falseCue ? TUNING.fish.cueFalsePeakOpacity : TUNING.fish.cueRealPeakOpacity;
  const color = cueColor(ripple);

  if (ripple.cue === 'bubble_trail') {
    const beadCount = TUNING.fish.cueBubbleTrailCount;
    return (
      <group position={[ripple.pos.x, TUNING.world.waterY + 0.018, ripple.pos.z]}>
        {Array.from({ length: beadCount }, (_, index) => (
          <mesh key={index} ref={index === 0 ? setObjectRef : undefined} renderOrder={3} rotation={[-Math.PI / 2, 0, 0]} position={[((index - (beadCount - 1) / 2)) * ripple.radius * 0.54, 0, -index * ripple.radius * 0.4]}>
            <ringGeometry args={[ripple.radius * 0.16, ripple.radius * 0.26, 16]} />
            <meshBasicMaterial ref={index === 0 ? materialRef : undefined} color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    );
  }

  if (ripple.cue === 'glint' || ripple.cue === 'tail_flash') {
    return (
      <mesh ref={setObjectRef} renderOrder={4} rotation={[-Math.PI / 2, 0, Math.PI * 0.16]} position={[ripple.pos.x, TUNING.world.waterY + 0.024, ripple.pos.z]}>
        <planeGeometry args={[ripple.radius * (ripple.cue === 'tail_flash' ? 0.72 : 1.1), ripple.radius * 0.12]} />
        <meshBasicMaterial ref={materialRef} color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  if (ripple.cue === 'silt_plume') {
    return (
      <mesh ref={setObjectRef} renderOrder={2} rotation={[-Math.PI / 2, 0, 0]} position={[ripple.pos.x, TUNING.world.waterY + 0.012, ripple.pos.z]}>
        <circleGeometry args={[ripple.radius, 24]} />
        <meshBasicMaterial ref={materialRef} color={color} transparent opacity={opacity * TUNING.fish.cueSiltOpacityMultiplier} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  if (ripple.cue === 'wake') {
    return (
      <group ref={setObjectRef} position={[ripple.pos.x, TUNING.world.waterY + 0.02, ripple.pos.z]}>
        {[-1, 1].map((side) => (
          <mesh key={side} renderOrder={3} rotation={[-Math.PI / 2, 0, side * Math.PI * 0.18]} position={[side * ripple.radius * 0.24, 0, -ripple.radius * 0.2]}>
            <planeGeometry args={[ripple.radius * 1.15, ripple.radius * 0.06]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <mesh
      ref={setObjectRef}
      renderOrder={3}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[ripple.pos.x, TUNING.world.waterY + 0.018, ripple.pos.z]}
    >
      <ringGeometry args={[ripple.radius * (ripple.cue === 'surface_rise' ? 0.44 : 0.74), ripple.radius, TUNING.world.rippleSegments]} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function cueColor(ripple: Ripple): string {
  if (ripple.falseCue) {
    return '#c8c4b2';
  }

  if (ripple.cue === 'glint' || ripple.cue === 'tail_flash') {
    return '#f1d47a';
  }

  if (ripple.cue === 'silt_plume') {
    return '#78684d';
  }

  return '#d8d4c2';
}
