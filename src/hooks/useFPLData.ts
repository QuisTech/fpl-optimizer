import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { RecommendationResponse, TeamSyncResponse, ScoredPlayer } from '../types';

export const useFPLData = (riskMode: 'safe' | 'aggressive' | 'value') => {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string>('');
  const [syncedData, setSyncedData] = useState<TeamSyncResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lockedPlayerIds, setLockedPlayerIds] = useState<number[]>([]);
  const [excludedPlayerIds, setExcludedPlayerIds] = useState<number[]>([]);

  const [history, setHistory] = useState<any>(() => {
    const saved = localStorage.getItem('fpl_strategist_history') || localStorage.getItem('fpl_optimizer_history');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('fpl_strategist_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    fetchRecommendations();
  }, [riskMode, syncedData?.totalCost, syncedData?.bank, lockedPlayerIds, excludedPlayerIds]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const budgetQuery = syncedData ? `&budget=${(syncedData.totalCost || 0) + (syncedData.bank || 0)}` : '';
      const lockedQuery = (lockedPlayerIds || []).length > 0 ? `&locked=${lockedPlayerIds.join(',')}` : '';
      const excludedQuery = (excludedPlayerIds || []).length > 0 ? `&excluded=${excludedPlayerIds.join(',')}` : '';
      const res = await axios.get(`/api/recommendations?riskMode=${riskMode}${budgetQuery}${lockedQuery}${excludedQuery}`);
      if (res.data) {
        setData(res.data);
      }
      setError(null);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.response?.data?.message || err.message || "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  };

  const takeSnapshot = (gwId: number, currentModeData: RecommendationResponse, mode: string) => {
    if (!gwId || !currentModeData) {
      console.warn("[Snapshot] Missing GW ID or Data");
      return false;
    }
    
    const newHistory = { ...history };
    const gwHistory = newHistory[gwId] || { safe: null, aggressive: null, value: null };
    
    newHistory[gwId] = {
      ...gwHistory,
      [mode]: {
        players: (currentModeData.startingXI || []).map(p => ({
          id: p.id,
          web_name: p.web_name,
          score: p.score,
          position: p.position
        })),
        xP: currentModeData.expectedPoints,
        captainId: currentModeData.captain?.id,
        viceCaptainId: currentModeData.viceCaptain?.id,
        timestamp: Date.now()
      }
    };

    setHistory(newHistory);
    localStorage.setItem('fpl_strategist_history', JSON.stringify(newHistory));
    return true;
  };

  const fetchLivePoints = async (gwId: number) => {
    try {
      const res = await axios.get(`/api/live/${gwId}`);
      return res.data.elements;
    } catch (err) {
      console.error("Live points fetch error:", err);
      return null;
    }
  };

  const syncTeam = async () => {
    if (!teamId) return;
    setSyncing(true);
    try {
      const res = await axios.get(`/api/sync/${teamId}?riskMode=${riskMode}`);
      setSyncedData(res.data);
      setError(null);
      return true;
    } catch (err) {
      setError("Failed to sync team. Check your Team ID.");
      return false;
    } finally {
      setSyncing(false);
    }
  };

  const formation = useMemo(() => {
    if (!data || !data.startingXI) return { def: [], mid: [], fwd: [], gkp: [] };
    const validXI = data.startingXI.filter((p): p is ScoredPlayer => !!p);
    return {
      def: validXI.filter(p => p.position === 'DEF'),
      mid: validXI.filter(p => p.position === 'MID'),
      fwd: validXI.filter(p => p.position === 'FWD'),
      gkp: validXI.filter(p => p.position === 'GKP'),
    };
  }, [data]);

  const toggleLock = (id: number) => {
    setExcludedPlayerIds(prev => (prev || []).filter(pId => pId !== id));
    setLockedPlayerIds(prev => (prev || []).includes(id) ? (prev || []).filter(pId => pId !== id) : [...(prev || []), id]);
  };

  const toggleExclude = (id: number) => {
    setLockedPlayerIds(prev => (prev || []).filter(pId => pId !== id));
    setExcludedPlayerIds(prev => (prev || []).includes(id) ? (prev || []).filter(pId => pId !== id) : [...(prev || []), id]);
  };

  const clearConstraints = () => {
    setLockedPlayerIds([]);
    setExcludedPlayerIds([]);
  };

  return {
    data,
    loading,
    error,
    teamId,
    setTeamId,
    syncedData,
    syncing,
    syncTeam,
    formation,
    refresh: fetchRecommendations,
    history,
    takeSnapshot,
    fetchLivePoints,
    lockedPlayerIds: lockedPlayerIds || [],
    excludedPlayerIds: excludedPlayerIds || [],
    toggleLock,
    toggleExclude,
    clearConstraints
  };
};
