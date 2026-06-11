'use client';

// Last-resort boundary: catches errors thrown by the root layout itself, where
// app/error.tsx can't help. Must render its own <html>/<body> because the
// layout is gone. Styles are inline for the same reason — globals.css may not
// have loaded.
export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#3d6068',
          color: '#c8c4b2',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center'
        }}
      >
        <div role="alert">
          <h1 style={{ fontSize: '1.4rem', marginBottom: 8 }}>The pond glitched.</h1>
          <p style={{ opacity: 0.8, marginBottom: 20 }}>Something broke below the surface.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: '10px 22px',
              borderRadius: 999,
              border: '1px solid #c8a85c',
              background: 'transparent',
              color: '#c8a85c',
              fontSize: '1rem'
            }}
          >
            Cast again
          </button>
        </div>
      </body>
    </html>
  );
}
