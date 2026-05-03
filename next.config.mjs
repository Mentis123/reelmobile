import { execSync } from 'node:child_process';

function currentCandidateTag() {
  if (process.env.NEXT_PUBLIC_REEL_CANDIDATE_TAG) {
    return process.env.NEXT_PUBLIC_REEL_CANDIDATE_TAG;
  }

  try {
    return execSync('git describe --tags --match "*-candidate" --abbrev=0', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return 'v0.0-shell-candidate';
  }
}

function currentMilestone(tag) {
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
