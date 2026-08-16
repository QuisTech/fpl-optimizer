import { motion } from 'motion/react';
import { PlayerCard } from './PlayerCard';
import { RecommendationResponse, ScoredPlayer } from '../types';
import { Lock, Ban, X } from 'lucide-react';

interface PitchViewProps {
  data: RecommendationResponse | null;
  formation: {
    gkp: ScoredPlayer[];
    def: ScoredPlayer[];
    mid: ScoredPlayer[];
    fwd: ScoredPlayer[];
  };
  lockedPlayerIds?: number[];
  excludedPlayerIds?: number[];
  onToggleLock?: (id: number) => void;
  onToggleExclude?: (id: number) => void;
  onClearConstraints?: () => void;
}

export const PitchView = ({ 
  data, 
  formation = { gkp: [], def: [], mid: [], fwd: [] },
  lockedPlayerIds = [],
  excludedPlayerIds = [],
  onToggleLock,
  onToggleExclude,
  onClearConstraints
}: PitchViewProps) => {
  const allPlayersMap = new Map<number, ScoredPlayer>();
  data?.squad?.forEach(p => { if (p) allPlayersMap.set(p.id, p); });
  data?.topPicks?.gkp?.forEach(p => { if (p) allPlayersMap.set(p.id, p); });
  data?.topPicks?.def?.forEach(p => { if (p) allPlayersMap.set(p.id, p); });
  data?.topPicks?.mid?.forEach(p => { if (p) allPlayersMap.set(p.id, p); });
  data?.topPicks?.fwd?.forEach(p => { if (p) allPlayersMap.set(p.id, p); });

  const safeLocked = Array.isArray(lockedPlayerIds) ? lockedPlayerIds : [];
  const safeExcluded = Array.isArray(excludedPlayerIds) ? excludedPlayerIds : [];
  const hasConstraints = safeLocked.length > 0 || safeExcluded.length > 0;

  const gkpList = Array.isArray(formation?.gkp) ? formation.gkp : [];
  const defList = Array.isArray(formation?.def) ? formation.def : [];
  const midList = Array.isArray(formation?.mid) ? formation.mid : [];
  const fwdList = Array.isArray(formation?.fwd) ? formation.fwd : [];
  const benchList = Array.isArray(data?.bench) ? data.bench.filter(Boolean) : [];

  return (
    <motion.div 
      key="pitch-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-grow flex flex-col justify-around py-4"
    >
      {/* Active Constraints Pill Bar */}
      {hasConstraints && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 mb-2 bg-slate-950/80 border border-slate-800 rounded-xl">
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider mr-1">Active Rules:</span>
          {safeLocked.map(id => {
            const p = allPlayersMap.get(id);
            return (
              <span key={'lock-' + id} className="inline-flex items-center gap-1 bg-amber-400/15 border border-amber-400/40 text-amber-300 px-2 py-0.5 rounded text-[9px] font-bold">
                <Lock className="w-2.5 h-2.5 text-amber-400" />
                <span>{p?.web_name || ('ID ' + id)}</span>
                {onToggleLock && (
                  <button onClick={() => onToggleLock(id)} className="hover:text-white ml-0.5">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            );
          })}
          {safeExcluded.map(id => {
            const p = allPlayersMap.get(id);
            return (
              <span key={'ex-' + id} className="inline-flex items-center gap-1 bg-rose-500/15 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded text-[9px] font-bold">
                <Ban className="w-2.5 h-2.5 text-rose-400" />
                <span>{p?.web_name || ('ID ' + id)}</span>
                {onToggleExclude && (
                  <button onClick={() => onToggleExclude(id)} className="hover:text-white ml-0.5">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            );
          })}
          {onClearConstraints && (
            <button 
              onClick={onClearConstraints}
              className="text-[9px] text-slate-400 hover:text-white underline ml-auto font-bold uppercase tracking-wider"
            >
              Reset All
            </button>
          )}
        </div>
      )}

      <div className="flex justify-around items-center">
        {gkpList.map(p => (
          <PlayerCard 
            key={p.id} 
            player={p} 
            isCaptain={!!(data?.captain?.id && p.id === data.captain.id)} 
            isViceCaptain={!!(data?.viceCaptain?.id && p.id === data.viceCaptain.id)}
            isLocked={safeLocked.includes(p.id)}
            isExcluded={safeExcluded.includes(p.id)}
            onToggleLock={onToggleLock}
            onToggleExclude={onToggleExclude}
          />
        ))}
      </div>
      <div className="flex justify-around items-center">
        {defList.map(p => (
          <PlayerCard 
            key={p.id} 
            player={p} 
            isCaptain={!!(data?.captain?.id && p.id === data.captain.id)} 
            isViceCaptain={!!(data?.viceCaptain?.id && p.id === data.viceCaptain.id)}
            isLocked={safeLocked.includes(p.id)}
            isExcluded={safeExcluded.includes(p.id)}
            onToggleLock={onToggleLock}
            onToggleExclude={onToggleExclude}
          />
        ))}
      </div>
      <div className="flex justify-around items-center">
        {midList.map(p => (
          <PlayerCard 
            key={p.id} 
            player={p} 
            isCaptain={!!(data?.captain?.id && p.id === data.captain.id)} 
            isViceCaptain={!!(data?.viceCaptain?.id && p.id === data.viceCaptain.id)}
            isLocked={safeLocked.includes(p.id)}
            isExcluded={safeExcluded.includes(p.id)}
            onToggleLock={onToggleLock}
            onToggleExclude={onToggleExclude}
          />
        ))}
      </div>
      <div className="flex justify-around items-center">
        {fwdList.map(p => (
          <PlayerCard 
            key={p.id} 
            player={p} 
            isCaptain={!!(data?.captain?.id && p.id === data.captain.id)} 
            isViceCaptain={!!(data?.viceCaptain?.id && p.id === data.viceCaptain.id)}
            isLocked={safeLocked.includes(p.id)}
            isExcluded={safeExcluded.includes(p.id)}
            onToggleLock={onToggleLock}
            onToggleExclude={onToggleExclude}
          />
        ))}
      </div>

      {/* Pitch Bench Sub-Component */}
      <div className="mt-8 pt-4 border-t border-fpl-border/50">
        <div className="flex justify-center gap-2">
           {benchList.map(p => (
             <PlayerCard 
               key={p.id} 
               player={p} 
               compact 
               isLocked={safeLocked.includes(p.id)}
               isExcluded={safeExcluded.includes(p.id)}
               onToggleLock={onToggleLock}
               onToggleExclude={onToggleExclude}
             />
           ))}
        </div>
        <p className="text-center text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-2 px-6">Substitution Bench</p>
      </div>
    </motion.div>
  );
};
