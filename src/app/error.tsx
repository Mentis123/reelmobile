'use client';

import { useEffect } from 'react';

// Route-level error boundary: without it, a render-time throw anywhere in the
// game (most plausibly WebGL/canvas setup on an old device) white-screens the
// whole app with no way back. Keep the copy in the pond's voice and give the
// player a real recovery action.
export default function ErrorBoundary({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[reel] route error:', error);
  }, [error]);

  return (
    <main className="error-shell">
      <div className="error-card" role="alert">
        <h1>The pond glitched.</h1>
        <p>Something broke below the surface. Your journal is safe.</p>
        <button type="button" className="error-retry" onClick={reset}>
          Cast again
        </button>
      </div>
    </main>
  );
}
