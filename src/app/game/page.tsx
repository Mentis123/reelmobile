import { Suspense } from 'react';

import { GameClient } from '@/components/game/GameClient';

export default function GamePage() {
  return (
    <Suspense fallback={null}>
      <GameClient />
    </Suspense>
  );
}
