import { useState } from 'react';
import { cn } from '../lib/utils';
import { TrendingUp, Award, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface PerformanceViewProps {
  history: any;
  fetchLivePoints: (gwId: number) => Promise<any>;
}

export const PerformanceView = ({ history, fetchLivePoints }: PerformanceViewProps) => {
  const [actualScores, setActualScores] = useState<Record<number, Record<number, { points: number; minutes: number }>>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [selectedGwIndex, setSelectedGwIndex] = useState<number>(0);
  const [viewAll, setViewAll] = useState<boolean>(false);

  const gws = Object.keys(history).map(Number).sort((a, b) => b - a);

  const calculateActual = (gwId: number, snapshot: any) => {
    if (!actualScores[gwId]) return 0;
    let total = 0;
    
    const playerIds = snapshot.players ? snapshot.players.map((p: any) => p.id) : (snapshot.ids || []);
    const captainId = snapshot.captainId;
    const viceCaptainId = snapshot.viceCaptainId;

    let activeCaptainId = captainId;
    if (captainId && actualScores[gwId][captainId] && actualScores[gwId][captainId].minutes === 0) {
      activeCaptainId = viceCaptainId;
    }

    playerIds.forEach((id: number) => {
      const pData = actualScores[gwId][id];
      if (pData !== undefined) {
        total += pData.points;
        if (id === activeCaptainId) total += pData.points;
      }
    });
    return total;
  };

  const [expandedModes, setExpandedModes] = useState<Record<string, boolean>>({});

  const toggleExpand = (gwId: number, mode: string) => {
    const key = `${gwId}-${mode}`;
    setExpandedModes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const refreshActuals = async (gwId: number) => {
    setLoading(prev => ({ ...prev, [gwId]: true }));
    const elements = await fetchLivePoints(gwId);
    if (elements) {
      const scores: Record<number, { points: number; minutes: number }> = {};
      elements.forEach((el: any) => {
        scores[el.id] = { points: el.stats.total_points, minutes: el.stats.minutes };
      });
      setActualScores(prev => ({ ...prev, [gwId]: scores }));
    }
    setLoading(prev => ({ ...prev, [gwId]: false }));
  };

  if (gws.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Clock className="w-12 h-12 text-slate-700 mb-4" />
        <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">No history snapshots yet.</p>
        <p className="text-slate-600 text-[10px] mt-2 max-w-[250px]">
          Snapshots are taken when you use the <span className="text-fpl-green font-bold">SNAPSHOT</span> button in the Pitch view. 
          Use it before the deadline to lock in your final recommendations!
        </p>
      </div>
    );
  }

  const activeGwIndex = Math.min(selectedGwIndex, gws.length - 1);
  const visibleGws = viewAll ? gws : [gws[activeGwIndex] || gws[0]];

  return (
    <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
      {/* Gameweek Enveloped Chevron Navigator */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-2xl border border-fpl-border/60">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-fpl-green/10 border border-fpl-green/30 flex items-center justify-center text-fpl-green shadow-inner">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Performance Analysis
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              {gws.length} Gameweek{gws.length > 1 ? 's' : ''} Tracked
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          {/* User Requested Enveloped Chevron Bar */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-fpl-border/50">
            <button 
              onClick={() => {
                setViewAll(false);
                setSelectedGwIndex(prev => Math.min(gws.length - 1, prev + 1));
              }}
              disabled={viewAll || activeGwIndex >= gws.length - 1}
              className="p-0.5 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors" 
              title="Previous Gameweek"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-[8.5px] font-mono text-emerald-400 font-bold px-1.5 select-none">
              {viewAll ? `GWs ${gws[gws.length - 1]}–${gws[0]}` : `GW ${gws[activeGwIndex]}`}
            </span>

            <button 
              onClick={() => {
                setViewAll(false);
                setSelectedGwIndex(prev => Math.max(0, prev - 1));
              }}
              disabled={viewAll || activeGwIndex <= 0}
              className="p-0.5 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors" 
              title="Next Gameweek"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Gameweek Quick Pills */}
          {gws.length > 1 && (
            <div className="hidden md:flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {gws.map((gw, idx) => (
                <button
                  key={gw}
                  onClick={() => {
                    setViewAll(false);
                    setSelectedGwIndex(idx);
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all",
                    !viewAll && activeGwIndex === idx 
                      ? "bg-fpl-green text-slate-950 shadow-sm" 
                      : "text-slate-400 hover:text-white hover:bg-slate-900"
                  )}
                >
                  GW{gw}
                </button>
              ))}
            </div>
          )}

          {/* Toggle View All */}
          {gws.length > 1 && (
            <button
              onClick={() => setViewAll(!viewAll)}
              className={cn(
                "text-[9px] font-mono font-black px-2.5 py-1 rounded-lg border transition-all uppercase tracking-wider",
                viewAll ? "bg-fpl-purple/20 text-fpl-purple border-fpl-purple/40" : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              )}
            >
              {viewAll ? "Single GW" : "View All"}
            </button>
          )}
        </div>
      </div>

      {visibleGws.map(gwId => {
        const modes = history[gwId] || {};
        return (
          <div key={gwId} className="bg-slate-950/40 border border-fpl-border rounded-2xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-fpl-green" />
                GAMEWEEK {gwId} PERFORMANCE
              </h3>
              <button 
                onClick={() => refreshActuals(gwId)}
                disabled={loading[gwId]}
                className="text-[9px] font-black uppercase tracking-widest bg-fpl-purple px-3 py-1 rounded-lg hover:bg-fpl-purple/80 transition-colors disabled:opacity-50 w-full sm:w-auto text-white font-bold"
              >
                {loading[gwId] ? 'FETCHING...' : 'REFRESH ACTUALS'}
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {(() => {
                const availableKeys = ['safe', 'aggressive', 'value', 'user_synced_squad'];
                const entries = availableKeys
                  .map(key => {
                    const data = modes[key];
                    if (!data) return null;
                    const normalizedXP = data.xP || 0;
                    const actual = calculateActual(gwId, data);
                    const diff = actual - normalizedXP;
                    const hasStarted = actual > 0;
                    return {
                      key,
                      data,
                      normalizedXP,
                      actual,
                      diff,
                      hasStarted
                    };
                  })
                  .filter((item): item is NonNullable<typeof item> => item !== null);

                // Sort: Pre-match (actual === 0), rank by highest expected points. Post-kickoff, rank by actual points.
                const sortedEntries = [...entries].sort((a, b) => {
                  if (a.actual === 0 && b.actual === 0) {
                    return b.normalizedXP - a.normalizedXP;
                  }
                  const actualDiff = b.actual - a.actual;
                  if (actualDiff !== 0) return actualDiff;
                  const scoreDiff = b.diff - a.diff;
                  if (scoreDiff !== 0) return scoreDiff;
                  return b.normalizedXP - a.normalizedXP;
                });

                return sortedEntries.map(({ key, data, normalizedXP, actual, diff, hasStarted }, rankIndex) => {
                  const isExpanded = !!expandedModes[`${gwId}-${key}`];
                  const isUserSquad = !!data.isUserSquad || key === 'user_synced_squad';
                  const activeCaptainId = data.captainId && actualScores[gwId]?.[data.captainId]?.minutes === 0 
                    ? data.viceCaptainId 
                    : data.captainId;

                  return (
                    <div 
                      key={key} 
                      className={cn(
                        "relative bg-card-bg border rounded-xl p-4 transition-all",
                        isUserSquad 
                          ? "border-emerald-500/70 bg-gradient-to-r from-emerald-500/[0.08] via-card-bg to-card-bg ring-1 ring-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.12)]" 
                          : "border-fpl-border"
                      )}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Rank Badge */}
                          <span className={cn(
                            "text-[8.5px] font-mono font-black px-2 py-0.5 rounded-md border flex items-center gap-0.5",
                            rankIndex === 0 ? "bg-amber-400/20 text-amber-300 border-amber-400/40" :
                            rankIndex === 1 ? "bg-slate-300/20 text-slate-200 border-slate-300/40" :
                            rankIndex === 2 ? "bg-amber-700/20 text-amber-400 border-amber-700/40" :
                            "bg-slate-900 text-slate-500 border-slate-800"
                          )}>
                            {rankIndex === 0 ? '🥇 #1' : rankIndex === 1 ? '🥈 #2' : rankIndex === 2 ? '🥉 #3' : `#${rankIndex + 1}`}
                          </span>

                          {/* Mode / Team Badge */}
                          <p className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border inline-block",
                            isUserSquad ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-400 font-black shadow-sm" :
                            key === 'aggressive' ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : 
                            key === 'value' ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : 
                            "bg-fpl-green/20 text-fpl-green border-fpl-green/30"
                          )}>
                            {isUserSquad ? '👤 My Synced Squad' : key}
                          </p>

                          {isUserSquad && (
                            <span className="text-[8.5px] font-bold text-emerald-400/90 font-mono">
                              {data.teamName || 'Synced FPL Squad'}
                            </span>
                          )}
                        </div>
                        
                        <button 
                          onClick={() => toggleExpand(gwId, key)}
                          className="text-[8px] text-slate-500 hover:text-white uppercase font-bold tracking-tighter"
                        >
                          {isExpanded ? '[ HIDE SQUAD ]' : '[ VIEW SQUAD ]'}
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 sm:gap-6">
                        <div>
                          <p className="text-[8px] text-slate-500 uppercase font-medium">Expected</p>
                          <p className="text-sm sm:text-lg font-black text-white">{normalizedXP.toFixed(1)} <span className="text-[9px] sm:text-[10px] font-normal text-slate-500">xP</span></p>
                        </div>
                        
                        <div>
                          <p className="text-[8px] text-slate-500 uppercase font-medium">Actual</p>
                          <p className="text-sm sm:text-lg font-black text-white">
                            {actualScores[gwId] ? actual.toFixed(0) : '--'}
                            <span className="text-[9px] sm:text-[10px] font-normal text-slate-500 ml-1">pts</span>
                          </p>
                        </div>

                        <div className="flex flex-col justify-center">
                          {hasStarted ? (
                            <div className={cn(
                              "flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] font-black",
                              diff >= 0 ? "text-fpl-green" : "text-fpl-pink"
                            )}>
                              <TrendingUp className={cn("w-2.5 h-2.5 sm:w-3 sm:h-3", diff < 0 && "rotate-180")} />
                              {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)} <span className="hidden sm:inline">vs xP</span>
                            </div>
                          ) : (
                            <span className="text-[8px] text-slate-600 font-mono uppercase tracking-tighter">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expandable Squad Details */}
                      {isExpanded && data.players && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                              {isUserSquad ? 'Manager Starting XI & Captaincy' : 'Locked Starting Lineup'}
                            </span>
                            <span className="text-[8px] font-mono text-slate-500">
                              {data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                            {data.players.map((player: any) => {
                              const pScore = actualScores[gwId]?.[player.id];
                              const isCaptain = player.id === activeCaptainId;
                              const isVice = player.id === data.viceCaptainId;
                              
                              return (
                                <div key={player.id} className="bg-slate-950/60 border border-slate-800/60 rounded p-1.5 flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 overflow-hidden">
                                    <span className="text-[7.5px] font-mono px-1 py-0.2 bg-slate-900 text-slate-400 rounded">
                                      {player.position}
                                    </span>
                                    <span className="text-[9px] text-slate-200 truncate font-medium">
                                      {player.web_name}
                                      {isCaptain && <span className="text-amber-400 font-bold ml-0.5">(C)</span>}
                                      {isVice && <span className="text-slate-400 font-bold ml-0.5">(V)</span>}
                                    </span>
                                  </div>
                                  <span className="text-[9px] font-mono font-bold text-white ml-1 shrink-0">
                                    {pScore !== undefined ? (pScore.points * (isCaptain ? 2 : 1)) : '--'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
};
