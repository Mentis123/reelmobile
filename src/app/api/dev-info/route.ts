import { networkInterfaces } from 'node:os';

import { NextResponse } from 'next/server';

import { CURRENT_CANDIDATE_TAG, CURRENT_MILESTONE } from '@/lib/buildInfo';

export const dynamic = 'force-dynamic';

function getLocalIpv4(): string | null {
  const networks = networkInterfaces();

  for (const entries of Object.values(networks)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }

  return null;
}

export function GET(request: Request) {
  const url = new URL(request.url);

  return NextResponse.json({
    localIp: getLocalIpv4(),
    port: url.port || process.env.PORT || '3000',
    candidateTag: CURRENT_CANDIDATE_TAG,
    milestone: CURRENT_MILESTONE
  });
}
