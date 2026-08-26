import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, CheckCircle2, X } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SnapshotToastData {
  gwId: number;
  riskMode: 'safe' | 'aggressive' | 'value';
  riskLabel: string;
  timestamp?: number;
}

interface SnapshotToastProps {
  toast: SnapshotToastData | null;
  onClose: () => void;
  duration?: number;
}

export const SnapshotToast: React.FC<SnapshotToastProps> = ({ toast, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, duration, onClose]);

  return (
    <AnimatePresence>
      {toast && (
        <div className="fixed top-5 right-5 z-50 pointer-events-none flex flex-col items-end">
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.9, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -20, scale: 0.95, filter: 'blur(5px)' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="bg-slate-950/95 backdrop-blur-2xl border border-fpl-green/50 shadow-[0_10px_40px_rgba(0,255,133,0.25)] rounded-2xl p-4 text-white max-w-sm w-full relative overflow-hidden pointer-events-auto border-l-4 border-l-fpl-green"
          >
            {/* Background Ambient Glow */}
            <div className="absolute -top-10 -right-10 w-28 h-28 bg-fpl-green/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-start justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-fpl-green/10 border border-fpl-green/30 flex items-center justify-center text-fpl-green shrink-0 shadow-inner">
                  <Camera className="w-4 h-4 animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-fpl-green" />
                    <span className="text-xs font-black tracking-wider uppercase text-white">
                      Snapshot Saved
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Synced to cloud cross-device backend
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="bg-fpl-purple/30 border border-fpl-purple/50 text-fpl-purple font-mono font-black text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                  GW{toast.gwId}
                </span>
                <button
                  onClick={onClose}
                  className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
                  aria-label="Close notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-800/80">
              {/* Risk Mode Badge */}
              <span className={cn(
                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                toast.riskMode === 'aggressive' ? "bg-orange-500/20 text-orange-400" : 
                toast.riskMode === 'value' ? "bg-cyan-500/20 text-cyan-400" : 
                "bg-fpl-green/20 text-fpl-green"
              )}>
                {toast.riskLabel}
              </span>
            </div>

            {/* Animated Shrinking Timer Bar */}
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: duration / 1000, ease: 'linear' }}
              className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-fpl-green via-emerald-400 to-fpl-purple"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
