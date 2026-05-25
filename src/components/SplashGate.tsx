"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { OfflineStatus } from "@/components/pwa/OfflineStatus";

type SplashStage = "primary" | "secondary";

export function SplashGate() {
  const router = useRouter();
  const [stage, setStage] = useState<SplashStage>("primary");
  const [isFading, setIsFading] = useState(false);

  const advance = () => {
    setIsFading(true);
    window.setTimeout(() => {
      setIsFading(false);
      if (stage === "primary") {
        setStage("secondary");
        return;
      }
      router.push("/game");
    }, 260);
  };

  return (
    <main className="home-shell">
      {stage === "primary" ? (
        <button
          className={`splash-title-screen ${isFading ? "is-fading" : ""}`}
          type="button"
          aria-label="Continue to Vibe Academy splash"
          onClick={advance}
        >
          {/* Direct public image path keeps the splash independent of Next's image optimizer. */}
          <img
            src="/images/reel-mobile-splash.png"
            alt="Reel Mobile"
            className="splash-title-image"
            draggable={false}
          />
          <span className="splash-hint">Tap to continue</span>
        </button>
      ) : (
        <button
          className={`splash-credit-screen ${isFading ? "is-fading" : ""}`}
          type="button"
          aria-label="Enter the pond"
          onClick={advance}
        >
          <span className="splash-credit-card">
            <span className="splash-kicker">Birb Labs Artefact</span>
            <span className="splash-title">Build yours at Vibe Academy</span>
            <span className="splash-copy">
              From the mind of Mentis. A small playable pond, shipped as a
              breakable toy for builders to inspect, remix, and learn from.
            </span>
            <span className="splash-links">
              <a
                href="https://www.vibeacademy.com.au/"
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                Vibe Academy
              </a>
              <a
                href="https://x.com/adam_x_mentis"
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                Mentis
              </a>
            </span>
            <OfflineStatus />
          </span>
          <span className="splash-hint">Tap to start</span>
        </button>
      )}
    </main>
  );
}
