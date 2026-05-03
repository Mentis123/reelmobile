import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="begin-gate" aria-label="Tap to begin gate">
        <h1 className="wordmark">Reel Mobile</h1>
        <p className="tap-copy">Tap to begin.</p>
        <Link className="begin-button" href="/game">
          Enter the pond
        </Link>
      </section>
    </main>
  );
}
