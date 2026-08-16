import { motion } from 'motion/react';
import { RecommendationResponse } from '../types';

interface DataGridProps {
  data: RecommendationResponse | null;
}

export const DataGrid = ({ data }: DataGridProps) => {
  return (
    <motion.div 
      key="data-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full overflow-y-auto pr-2 custom-scrollbar"
    >
      {(['gkp', 'def', 'mid', 'fwd'] as const).map((pos) => {
        const posLabels = { gkp: 'Goalkeepers', def: 'Defenders', mid: 'Midfielders', fwd: 'Forwards' };
        return (
          <div key={pos} className="bg-slate-950/40 rounded-2xl border border-fpl-border overflow-hidden">
            <div className="px-3 py-2 bg-slate-900/50 border-b border-fpl-border flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-fpl-green tracking-widest">{posLabels[pos]}</span>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">xP / Own</span>
            </div>
            <div className="divide-y divide-fpl-border/50">
              {data?.topPicks[pos]?.map(p => {
                const ownPercent = parseFloat(p.selected_by_percent || '0');
                return (
                  <div key={p.id} className="p-2 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-200">{p.web_name}</span>
                      <span className="text-[9px] text-slate-500 uppercase font-medium">{p.team_short_name} • £{((p?.now_cost || 0)/10).toFixed(1)}m</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-fpl-green">
                        {typeof p.xP === 'number' ? p.xP.toFixed(1) : '—'} <span className="text-[8px] text-slate-500 font-normal">xP</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-fpl-border/30">
                        {ownPercent < 5 ? 'Diff' : `${ownPercent.toFixed(0)}%`} <span className="text-[8px] text-slate-600 font-normal uppercase">Own</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
};
