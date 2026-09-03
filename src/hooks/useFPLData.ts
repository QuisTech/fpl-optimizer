import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { RecommendationResponse, TeamSyncResponse, ScoredPlayer } from '../types';

export const useFPLData = (riskMode: 'safe' | 'aggressive' | 'value') => {
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string>(() => {
    return localStorage.getItem('fpl_team_id') || '';
  });
  const [syncedData, setSyncedData] = useState<TeamSyncResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lockedPlayerIds, setLockedPlayerIds] = useState<number[]>([]);
  const [excludedPlayerIds, setExcludedPlayerIds] = useState<number[]>([]);

  useEffect(() => {
    if (teamId) {
      localStorage.setItem('fpl_team_id', teamId);
    }
  }, [teamId]);

  const [userId] = useState<string>(() => {
    let id = localStorage.getItem('fpl_user_id');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('fpl_user_id', id);
    }
    return id;
  });

  const effectiveKey = teamId ? `team_${teamId.trim()}` : userId;

  const [history, setHistory] = useState<any>(() => {
    const saved = localStorage.getItem('fpl_strategist_history') || localStorage.getItem('fpl_optimizer_history');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('fpl_strategist_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    axios.get(`/api/snapshots?userId=${effectiveKey}`)
      .then(res => {
        if (res.data?.history && typeof res.data.history === 'object' && Object.keys(res.data.history).length > 0) {
          setHistory((prev: any) => {
            const merged = { ...res.data.history, ...prev };
            localStorage.setItem('fpl_strategist_history', JSON.stringify(merged));
            return merged;
          });
        }
      })
      .catch(err => console.warn("[Snapshots API] Fetch notice:", err));
  }, [effectiveKey]);

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

  const takeSnapshot = async (gwId: number, currentModeData: RecommendationResponse, mode: string) => {
    if (!gwId || !currentModeData) {
      console.warn("[Snapshot] Missing GW ID or Data");
      return false;
    }

    const now = Date.now();
    
    // 1. Snapshot the active mode
    const snapshotItem = {
      key: mode,
      riskMode: mode,
      riskLabel: mode.toUpperCase(),
      players: (currentModeData.startingXI || []).map(p => ({
        id: p.id,
        web_name: p.web_name,
        score: p.score,
        position: p.position
      })),
      xP: currentModeData.expectedPoints,
      captainId: currentModeData.captain?.id,
      viceCaptainId: currentModeData.viceCaptain?.id,
      timestamp: now
    };

    const newHistory = { ...history };
    const gwHistory = { ...(newHistory[gwId] || {}) };
    gwHistory[mode] = snapshotItem;

    // 2. Snapshot the user's synced Starting XI if squad is synced
    if (syncedData && syncedData.squad && syncedData.squad.length >= 11) {
      const startingXI = syncedData.squad.filter(p => (p.position_in_squad ?? 0) <= 11);
      const captain = syncedData.squad.find(p => p.isCaptain || p.is_captain) || (startingXI.length > 0 ? startingXI[0] : null);
      const viceCaptain = syncedData.squad.find(p => p.isViceCaptain || p.is_vice_captain);
      const captainBonus = captain ? (captain.xP || 0) : 0;
      const startingTotalXp = startingXI.reduce((sum, p) => sum + (p.xP || 0), 0) + captainBonus;

      gwHistory['user_synced_squad'] = {
        key: 'user_synced_squad',
        riskMode: 'user',
        riskLabel: 'HUMAN',
        teamName: syncedData.managerInfo?.teamName || 'Synced FPL Squad',
        isUserSquad: true,
        players: startingXI.map(p => ({
          id: p.id,
          web_name: p.web_name,
          score: p.xP || p.score || 0,
          position: p.position
        })),
        xP: Math.round(startingTotalXp * 10) / 10,
        captainId: captain?.id,
        viceCaptainId: viceCaptain?.id,
        timestamp: now
      };
    }

    // Immediately commit the active mode + user squad so UI updates instantly
    newHistory[gwId] = gwHistory;
    setHistory(newHistory);
    localStorage.setItem('fpl_strategist_history', JSON.stringify(newHistory));

    // 3. Concurrently fetch and snapshot the other AI modes so all 3 modes (safe, aggressive, value) are captured!
    const otherModes = (['safe', 'aggressive', 'value'] as const).filter(m => m !== mode);
    const budgetQuery = syncedData ? `&budget=${(syncedData.totalCost || 0) + (syncedData.bank || 0)}` : '';
    const lockedQuery = (typeof lockedPlayerIds !== 'undefined' && (lockedPlayerIds || []).length > 0) ? `&locked=${lockedPlayerIds.join(',')}` : '';
    const excludedQuery = (typeof excludedPlayerIds !== 'undefined' && (excludedPlayerIds || []).length > 0) ? `&excluded=${excludedPlayerIds.join(',')}` : '';
    const userQuery = '';

    try {
      const results = await Promise.allSettled(
        otherModes.map(m => axios.get(`/api/recommendations?riskMode=${m}${budgetQuery}${lockedQuery}${excludedQuery}`))
      );

      results.forEach((res, idx) => {
        const m = otherModes[idx];
        if (res.status === 'fulfilled' && res.value?.data?.startingXI) {
          const d = res.value.data;
          gwHistory[m] = {
            key: m,
            riskMode: m,
            riskLabel: m.toUpperCase(),
            players: d.startingXI.map((player: any) => ({
              id: player.id,
              web_name: player.web_name,
              score: player.score,
              position: player.position
            })),
            xP: d.expectedPoints,
            captainId: d.captain?.id,
            viceCaptainId: d.viceCaptain?.id,
            timestamp: now
          };
        }
      });

      newHistory[gwId] = { ...gwHistory };
      setHistory({ ...newHistory });
      localStorage.setItem('fpl_strategist_history', JSON.stringify(newHistory));

      axios.post('/api/snapshots', { userId: effectiveKey, history: newHistory })
        .catch(err => console.warn("[Snapshots API] Post notice:", err));
    } catch (fetchErr) {
      console.warn("[Snapshot] Error capturing other modes:", fetchErr);
    }

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
    localStorage.setItem('fpl_team_id', teamId);
    try {
      const res = await axios.get(`/api/sync/${teamId}?riskMode=${riskMode}`);
      setSyncedData(res.data);
      setError(null);

      // Fetch team snapshots from cloud backend
      axios.get(`/api/snapshots?userId=team_${teamId.trim()}`)
        .then(snapRes => {
          if (snapRes.data?.history && typeof snapRes.data.history === 'object') {
            setHistory((prev: any) => ({ ...prev, ...snapRes.data.history }));
          }
        })
        .catch(err => console.warn("[Snapshots API] Fetch notice on sync:", err));

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
