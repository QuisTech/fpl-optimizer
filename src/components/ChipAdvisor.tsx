import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { TeamSyncResponse } from '../types';

interface ChipAdvisorProps {
  syncedData: TeamSyncResponse | null;
}

export const ChipAdvisor = ({ syncedData }: ChipAdvisorProps) => {
  return (
    <motion.div
      key="chip-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
       <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-4">Strategic Chip Advisor</h3>
       {!syncedData ? (
         <div className="p-8 text-center text-slate-500 text-sm italic">Sync your team to get personalized chip advice based on your current roster.</div>
       ) : (
         <div className="grid grid-cols-1 gap-4">
           {/* 🌟 2026/27 Official Two-Set Chip System HUD */}
           <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-950/60 p-4 rounded-2xl border border-purple-500/30">
             <div className="flex items-center justify-between mb-1.5">
               <div className="flex items-center gap-2">
                 <span className="text-xs font-black text-purple-300 uppercase tracking-widest flex items-center gap-1.5">
                   <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                   2026/27 Chip Rules: Set 1 Active (GW1–19)
                 </span>
               </div>
               <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                 GW19 Expiration Cutoff
               </span>
             </div>
             <p className="text-[11px] text-slate-300 leading-relaxed">
               In the 2026/27 season, you receive <strong>two full sets of 4 chips</strong>. 
               <span className="text-amber-300 font-semibold"> Set 1 chips must be used before Gameweek 19</span> or they are lost forever (chips do not roll over!). A brand-new <strong>Set 2 (Wildcard, Free Hit, Bench Boost, Triple Captain)</strong> activates in Gameweek 20.
             </p>
           </div>

           {syncedData.chips.map((chip, i) => (
             <div key={i} className="bg-slate-950/80 p-5 rounded-3xl border border-fpl-border flex flex-col gap-3">
               <div className="flex justify-between items-center">
                 <div className="flex items-center gap-3">
                   <div className={cn(
                     "w-2 h-2 rounded-full",
                     chip.recommendation === 'STRONG BUY' ? "bg-fpl-green shadow-[0_0_8px_rgba(0,255,133,0.5)]" :
                     chip.recommendation === 'HOLD' ? "bg-amber-500" : "bg-rose-500"
                   )}></div>
                   <span className="text-sm font-black text-white uppercase tracking-wider">{chip.chip}</span>
                 </div>
                 <span className={cn(
                   "text-[10px] font-black px-2 py-0.5 rounded",
                   chip.recommendation === 'STRONG BUY' ? "bg-fpl-green/10 text-fpl-green" :
                   chip.recommendation === 'HOLD' ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
                 )}>{chip.recommendation}</span>
               </div>
               <p className="text-xs text-slate-400 leading-relaxed">{chip.reason}</p>
             </div>
           ))}
         </div>
       )}
    </motion.div>
  );
};
