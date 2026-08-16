import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { RefreshCw } from 'lucide-react';

import { useFPLData } from './hooks/useFPLData';
import { Header } from './components/Header';
import { MetricsColumn } from './components/MetricsColumn';
import { PitchView } from './components/PitchView';
import { DataGrid } from './components/DataGrid';
import { TransferView } from './components/TransferView';
import { ChipAdvisor } from './components/ChipAdvisor';
import { PerformanceView } from './components/PerformanceView';
import { FixtureList } from './components/FixtureList';
import { OptimizerPositioning } from './components/OptimizerPositioning';
import { Camera } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [riskMode, setRiskMode] = useState<'safe' | 'aggressive' | 'value'>('safe');
  const [tab, setTab] = useState<'optimizer' | 'pitch' | 'picks' | 'transfers' | 'chips' | 'performance'>('optimizer');
  
  const { 
    data, 
    loading, 
    error,
    teamId, 
    setTeamId, 
    syncedData, 
    syncing, 
    syncTeam, 
    formation,
    history,
    takeSnapshot,
    fetchLivePoints
  } = useFPLData(riskMode);

  const handleSync = async () => {
    const success = await syncTeam();
    if (success) setTab('transfers');
  };

  const handleSnapshot = () => {
    if (data) {
      const success = takeSnapshot(data.nextEventId, data, riskMode);
      if (success) {
        alert(`Snapshot taken for GW${data.nextEventId} [${riskMode.toUpperCase()}]`);
      }
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-8 h-8 text-fpl-green animate-spin mb-4" />
        <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">Optimizing Strategy...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-[#f8fafc] p-4 sm:p-6 font-sans">
      {error && (
        <div className="max-w-[1400px] mx-auto mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-400 text-xs font-mono">
          <span className="font-bold uppercase mr-2">[Engine Error]:</span> {error}
        </div>
      )}
      <div className="max-w-[1400px] mx-auto grid grid-cols-12 gap-4 auto-rows-min">

        
        <Header data={data} riskMode={riskMode} setRiskMode={setRiskMode} />

        <MetricsColumn data={data} syncedData={syncedData} riskMode={riskMode} />

        {/* Primary Content Area */}
        <div className="col-span-12 lg:col-span-6 bg-card-bg border border-fpl-border rounded-3xl overflow-hidden relative shadow-xl min-h-[600px]">
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.1) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.1) 40px)` }}></div>
          
          <div className="relative z-10 p-4 sm:p-6 h-full flex flex-col">
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between mb-8">
              <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-fpl-border w-full md:w-auto justify-center">
                {(['optimizer', 'pitch', 'picks', 'transfers', 'chips', 'performance'] as const).map((t) => (
                  <button 
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all",
                      tab === t ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
                    )}
                  >{t}</button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full md:w-auto">
                {tab === 'pitch' && data && (
                  <button 
                    onClick={handleSnapshot}
                    className="flex items-center gap-2 bg-slate-900 border border-fpl-border rounded-lg px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white hover:bg-slate-800 transition-all mr-2 sm:mr-4"
                  >
                    <Camera className="w-3 h-3 text-fpl-green" />
                    Snapshot
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="TEAM ID" 
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="bg-slate-950 border border-fpl-border rounded-lg px-3 py-1 text-[10px] font-mono text-fpl-green w-24 focus:outline-none focus:border-fpl-green"
                  />
                  <button 
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-fpl-purple hover:bg-fpl-purple/80 disabled:opacity-50 text-white text-[10px] font-black px-3 py-1 rounded-lg transition-colors"
                  >
                    {syncing ? 'SYNCING...' : 'SYNC TEAM'}
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {tab === 'optimizer' ? (
                <OptimizerPositioning />
              ) : tab === 'pitch' ? (
                <PitchView data={data} formation={formation} lockedPlayerIds={lockedPlayerIds} excludedPlayerIds={excludedPlayerIds} onToggleLock={toggleLock} onToggleExclude={toggleExclude} onClearConstraints={clearConstraints} />
              ) : tab === 'picks' ? (
                <DataGrid data={data} lockedPlayerIds={lockedPlayerIds} excludedPlayerIds={excludedPlayerIds} onToggleLock={toggleLock} onToggleExclude={toggleExclude} />
              ) : tab === 'transfers' ? (
                <TransferView syncedData={syncedData} />
              ) : tab === 'performance' ? (
                <PerformanceView history={history} fetchLivePoints={fetchLivePoints} />
              ) : (
                <ChipAdvisor syncedData={syncedData} />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-3 grid grid-cols-1 gap-4">
           {/* Top Value Picks Card */}
           <div className="bg-card-bg border border-fpl-border rounded-3xl p-5 flex flex-col shadow-sm">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Top Value Picks (PPM)</h2>
            <div className="space-y-3 flex-grow">
               {data?.topPicks?.mid?.slice(0, 5).map((p, i) => (
                <div key={p.id} className={cn("flex items-center justify-between border-b border-fpl-border pb-2", i >= 4 && "border-0")}>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-200">{p.web_name}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{p.position} | £{((p?.now_cost || 0)/10).toFixed(1)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-bold text-fpl-green">{(p?.ppm || 0).toFixed(2)}</span>
                    <div className="text-[8px] text-slate-500 uppercase font-bold">Pts/£M</div>
                  </div>
                </div>
               ))}
            </div>
          </div>
          
          <FixtureList data={data} />
        </div>
      </div>
    </div>
  );
}
