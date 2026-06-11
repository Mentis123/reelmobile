function currentCandidateTag() {
  if (process.env.NEXT_PUBLIC_REEL_CANDIDATE_TAG) {
    return process.env.NEXT_PUBLIC_REEL_CANDIDATE_TAG;
  }

  return 'v0.4-far-water-candidate';
}

function currentMilestone(tag) {
  if (tag.startsWith('v0.4-')) {
    return 'far-water';
  }

  if (tag.startsWith('v0.3.2-')) {
    return 'm3.2';
  }

  if (tag.startsWith('v0.3.1-')) {
    return 'm3.1';
  }

  if (tag.startsWith('v0.3-')) {
    return 'm3';
  }

  if (tag.startsWith('v0.2-')) {
    return 'm2';
  }

  if (tag.startsWith('v0.1.5-')) {
    return 'm1.5';
  }

  return tag.startsWith('v0.1-') ? 'm1' : 'm0';
}

const candidateTag = currentCandidateTag();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracing: !process.cwd().includes('#'),
  env: {
    NEXT_PUBLIC_REEL_CANDIDATE_TAG: candidateTag,
    NEXT_PUBLIC_REEL_MILESTONE: currentMilestone(candidateTag)
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // The game uses none of these; deny them outright.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' }
        ]
      },
      {
        // Content-addressed static assets are safe to cache forever.
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
      },
      {
        // The service worker itself must always revalidate, or updates stall.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }]
      }
    ];
  }
};

export default nextConfig;
