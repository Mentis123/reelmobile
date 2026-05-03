import { create } from 'zustand';

import type { FailureKind } from '@/game/state/gameStateMachine';
import { TUNING } from '@/game/tuning/tuning';

export type Catch = {
  id: string;
  at: number;
  species: string;
  sizeScore: number;
  lure: string;
  durationMs: number;
  peakTension: number;
  nearSnaps: number;
  storyText: string;
};

export type Failure = {
  at: number;
  kind: FailureKind;
  context: {
    fishSpecies?: string;
    peakTension?: number;
    distanceToFish?: number;
  };
};

export type Session = {
  id: string;
  pondSeed: string;
  startedAt: number;
  endedAt: number | null;
  device: {
    userAgent: string;
    pixelRatio: number;
    viewportW: number;
    viewportH: number;
    isIOSSafari: boolean;
    isAndroidChrome: boolean;
  };
  prefs: {
    haptics: boolean;
    audio: boolean;
    reducedMotion: boolean;
  };
  casts: number;
  catches: Catch[];
  failures: Failure[];
  perf: {
    avgFps: number;
    minFps: number;
    pixelRatioDegradationsCount: number;
    glContextLossCount: number;
  };
};

type SessionStore = {
  session: Session | null;
  startSession: (seed: string) => Session;
  recordCast: () => void;
  recordCatch: (catchEntry: Catch) => void;
  recordFailure: (failure: Failure) => void;
  recordPerf: (avgFps: number, minFps: number) => void;
  recordPixelRatioDegradation: () => void;
  recordGlContextLoss: () => void;
};

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  startSession: (seed) => {
    const session = createSession(seed);
    set({ session });
    return session;
  },
  recordCast: () => {
    const session = get().session;
    if (session) {
      set({ session: { ...session, casts: session.casts + 1 } });
    }
  },
  recordCatch: (catchEntry) => {
    const session = get().session;
    if (session) {
      set({ session: { ...session, catches: [...session.catches, catchEntry] } });
    }
  },
  recordFailure: (failure) => {
    const session = get().session;
    if (session) {
      set({ session: { ...session, failures: [...session.failures, failure] } });
    }
  },
  recordPerf: (avgFps, minFps) => {
    const session = get().session;
    if (session) {
      set({ session: { ...session, perf: { ...session.perf, avgFps, minFps } } });
    }
  },
  recordPixelRatioDegradation: () => {
    const session = get().session;
    if (session) {
      set({
        session: {
          ...session,
          perf: {
            ...session.perf,
            pixelRatioDegradationsCount: session.perf.pixelRatioDegradationsCount + 1
          }
        }
      });
    }
  },
  recordGlContextLoss: () => {
    const session = get().session;
    if (session) {
      set({
        session: {
          ...session,
          perf: {
            ...session.perf,
            glContextLossCount: session.perf.glContextLossCount + 1
          }
        }
      });
    }
  }
}));

function createSession(seed: string): Session {
  const navigatorRef = typeof navigator === 'undefined' ? null : navigator;
  const userAgent = navigatorRef?.userAgent ?? 'server';
  const isIOSSafari = /iP(hone|od|ad)/.test(userAgent) && /Safari/.test(userAgent) && !/CriOS|FxiOS/.test(userAgent);
  const isAndroidChrome = /Android/.test(userAgent) && /Chrome/.test(userAgent);
  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  return {
    id: createId(),
    pondSeed: seed,
    startedAt: Date.now(),
    endedAt: null,
    device: {
      userAgent,
      pixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
      viewportW: typeof window === 'undefined' ? 0 : window.innerWidth,
      viewportH: typeof window === 'undefined' ? 0 : window.innerHeight,
      isIOSSafari,
      isAndroidChrome
    },
    prefs: {
      haptics: true,
      audio: true,
      reducedMotion
    },
    casts: 0,
    catches: [],
    failures: [],
    perf: {
      avgFps: 0,
      minFps: 0,
      pixelRatioDegradationsCount: 0,
      glContextLossCount: 0
    }
  };
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(TUNING.session.idRadix).slice(
    TUNING.session.idSliceStart,
    TUNING.session.idSliceEnd
  );
}

export function dailySeed(date = new Date()): string {
  return `${date.toISOString().slice(0, 10)}-${TUNING.seed.defaultSuffix}`;
}
