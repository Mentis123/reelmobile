import { DevGate } from '@/components/dev/DevGate';
import { getChecklist } from '@/game/dev/checklists';
import { CURRENT_MILESTONE } from '@/lib/buildInfo';

export default function DevPage() {
  return <DevGate checklist={getChecklist(CURRENT_MILESTONE)} />;
}
