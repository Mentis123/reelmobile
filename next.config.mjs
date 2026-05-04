function currentCandidateTag() {
  if (process.env.NEXT_PUBLIC_REEL_CANDIDATE_TAG) {
    return process.env.NEXT_PUBLIC_REEL_CANDIDATE_TAG;
  }

  return 'v0.1.5-rod-control-candidate';
}

function currentMilestone(tag) {
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
  }
};

export default nextConfig;
