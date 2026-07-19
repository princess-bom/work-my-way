import { ShieldCheck, Sparkles } from 'lucide-react';
import type { SupportPacketResponse } from '../../shared/support-schema';

export function ModeBadge({ generation }: Pick<SupportPacketResponse, 'generation'>) {
  const isLive = generation.mode === 'live';
  const isSample = generation.mode === 'illustrative-sample';
  return (
    <span className={`mode-badge ${isLive ? 'is-live' : 'is-fallback'}`} title={generation.reason}>
      {isLive ? <Sparkles size={14} /> : <ShieldCheck size={14} />}
      {isLive ? `Adapted with ${generation.model}` : isSample ? 'Illustrative sample' : 'Safe demo response'}
    </span>
  );
}
