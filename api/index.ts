import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import solver from "javascript-lp-solver";
import { z } from 'zod';
import { 
  FPLPlayer, FPLTeam, FPLFixture, ScoredPlayer, 
  FPLPlayerSchema, FPLTeamSchema, FPLFixtureSchema,
  RecommendationResponse, TeamSyncResponse, EntryHistory, ManagerInfo, TransferRecommendation, ChipAdvice
} from './types.js';
import { CSVOracle } from './ingestion.js';
import { Simulator } from './simulator.js';
import { solveOptimalSquad } from './lp-solver.js';

const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

interface LPSolverModel {
  optimize: string;
  opType: "max" | "min";
  constraints: Record<string, { max?: number; min?: number; equal?: number }>;
  variables: Record<string, Record<string, number>>;
  ints: Record<string, 1>;
}

export class FPLService {
  private static cache: { data: any; timestamp: number } | null = null;
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private static getHeaders() {
    return {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Referer": "https://fantasy.premierleague.com/",
      "Origin": "https://fantasy.premierleague.com",
      "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin"
    };
  }

  public static async fetchWithRetry(url: string, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const config = { headers: this.getHeaders(), timeout: 10000 };
        const res = await axios.get(url, config);
        return res;
      } catch (err: any) {
        console.warn(`[FPL API] Attempt ${i + 1}/${retries} failed for ${url}: ${err.response?.status || err.message}`);
        if (i < retries - 1) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1))); 
        } else {
          throw err;
        }
      }
    }
  }

  private static buildLocalFallbackBaseData() {
    console.warn(`[FPL API Fallback] FPL official API unavailable or blocked (403). Utilizing local scraped dataset fallback.`);

    const teams: FPLTeam[] = [
      { id: 1, name: "Arsenal", short_name: "ARS", strength: 4 },
      { id: 2, name: "Aston Villa", short_name: "AVL", strength: 3 },
      { id: 3, name: "Bournemouth", short_name: "BOU", strength: 3 },
      { id: 4, name: "Brentford", short_name: "BRE", strength: 3 },
      { id: 5, name: "Brighton", short_name: "BHA", strength: 3 },
      { id: 6, name: "Burnley", short_name: "BUR", strength: 2 },
      { id: 7, name: "Chelsea", short_name: "CHE", strength: 4 },
      { id: 8, name: "Crystal Palace", short_name: "CRY", strength: 3 },
      { id: 9, name: "Everton", short_name: "EVE", strength: 3 },
      { id: 10, name: "Fulham", short_name: "FUL", strength: 3 },
      { id: 11, name: "Leeds", short_name: "LEE", strength: 2 },
      { id: 12, name: "Liverpool", short_name: "LIV", strength: 5 },
      { id: 13, name: "Man City", short_name: "MCI", strength: 5 },
      { id: 14, name: "Man Utd", short_name: "MUN", strength: 4 },
      { id: 15, name: "Newcastle", short_name: "NEW", strength: 4 },
      { id: 16, name: "Nottm Forest", short_name: "NFO", strength: 3 },
      { id: 17, name: "Spurs", short_name: "TOT", strength: 4 },
      { id: 18, name: "Sunderland", short_name: "SUN", strength: 2 },
      { id: 19, name: "West Ham", short_name: "WHU", strength: 3 },
      { id: 20, name: "Wolves", short_name: "WOL", strength: 3 }
    ];

    const oracle = new CSVOracle('data/fplform_scraped.csv', [], 'safe', [], teams, 1);
    const playerIds = oracle.getAllPlayerIds();

    const posToType: Record<string, number> = { GKP: 1, DEF: 2, MID: 3, FWD: 4 };

    const players: FPLPlayer[] = playerIds.map(id => {
      const posStr = oracle.getPosition(id);
      const teamName = oracle.getTeam(id);
      const teamObj = teams.find(t => t.short_name.toLowerCase() === teamName.toLowerCase()) || teams[0];

      return {
        id,
        web_name: oracle.playerNames[id] || `Player ${id}`,
        first_name: "",
        second_name: oracle.playerNames[id] || `Player ${id}`,
        now_cost: oracle.getCost(id) || 50,
        element_type: posToType[posStr] || 3,
        team: teamObj.id,
        total_points: Math.round(oracle.getXP(id, 1) * 20),
        form: (oracle.getXP(id, 1)).toFixed(1),
        points_per_game: (oracle.getXP(id, 1)).toFixed(1),
        selected_by_percent: (oracle.getTop1kOwnership?.(id) || 5.0).toFixed(1),
        minutes: 90,
        goals_scored: 0,
        assists: 0,
        clean_sheets: 0,
        status: "a",
        news: "",
        ep_this: (oracle.getXP(id, 1)).toFixed(1),
        ep_next: (oracle.getXP(id, 1)).toFixed(1),
        chance_of_playing_this_round: 100,
        chance_of_playing_next_round: 100,
        expected_goals: "0.0",
        expected_assists: "0.0",
        expected_goal_involvements: "0.0",
        expected_conceded: "0.0",
        influence: "0.0",
        creativity: "0.0",
        threat: "0.0",
        ict_index: "0.0"
      };
    });

    const fixtures: FPLFixture[] = [];
    for (let gw = 1; gw <= 38; gw++) {
      for (let t = 1; t <= 20; t += 2) {
        fixtures.push({
          id: gw * 100 + t,
          team_h: t,
          team_a: t + 1,
          team_h_difficulty: 3,
          team_a_difficulty: 3,
          event: gw,
          finished: gw < 1
        });
      }
    }

    const result = { players, teams, fixtures, nextEventId: 1, currentEventId: 1 };
    this.cache = { data: result, timestamp: Date.now() };
    return result;
  }

  static async getBaseData() {
    // Return cached data if fresh
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL) {
      return this.cache.data;
    }

    try {
      const [staticRes, fixturesRes] = await Promise.all([
        this.fetchWithRetry(`${FPL_BASE_URL}/bootstrap-static/`),
        this.fetchWithRetry(`${FPL_BASE_URL}/fixtures/`)
      ]);

      const players: FPLPlayer[] = [];
      staticRes.data.elements.forEach((p: any) => {
        const result = FPLPlayerSchema.safeParse(p);
        if (result.success) players.push(result.data);
      });

      const teams: FPLTeam[] = [];
      staticRes.data.teams.forEach((t: any) => {
        const result = FPLTeamSchema.safeParse(t);
        if (result.success) teams.push(result.data);
      });

      const fixtures = z.array(FPLFixtureSchema).parse(fixturesRes.data);
      const currentEvent = staticRes.data.events.find((e: any) => e.is_current) || 
                           staticRes.data.events.find((e: any) => e.is_previous) || 
                           { id: 1 };
      const nextEvent = staticRes.data.events.find((e: any) => new Date(e.deadline_time) > new Date()) || { id: 1 };
      
      const result = { players, teams, fixtures, nextEventId: nextEvent.id, currentEventId: currentEvent.id };
      this.cache = { data: result, timestamp: Date.now() };
      return result;
    } catch (err: any) {
      console.warn(`[FPL API] Live fetch failed (${err.message}). Activating local data fallback.`);
      return this.buildLocalFallbackBaseData();
    }
  }

  static calculatePlayerScore(player: FPLPlayer, fixtures: FPLFixture[], nextEventId: number, riskMode: string, oracle?: CSVOracle): number {
    let baseXP = oracle ? oracle.getXP(player.id, nextEventId) : 0;
    if (baseXP === 0 && player.ep_next) {
      baseXP = parseFloat(String(player.ep_next)) || 0;
    }

    let score = baseXP;

    const form = parseFloat(player.form) || 0;
    score += form * 0.5;
    
    const xG = parseFloat(player.expected_goals) || 0;
    const xA = parseFloat(player.expected_assists) || 0;
    score += (xG * 2) + (xA * 1.5);

    if (score === 0) {
      const historicalPpm = (player.total_points || 0) / (player.now_cost / 10);
      score = historicalPpm > 0 ? historicalPpm : 0.5;
    }

    const upcoming = fixtures.filter(f => f.event >= nextEventId && f.event < nextEventId + 3)
      .filter(f => f.team_h === player.team || f.team_a === player.team);

    let difficultyMultiplier = 1.0;
    upcoming.forEach(f => {
      const fdr = f.team_h === player.team ? f.team_h_difficulty : f.team_a_difficulty;
      difficultyMultiplier *= (1 + (3 - fdr) * 0.1);
    });
    score *= difficultyMultiplier;

    if (riskMode === 'safe') {
      // Premium player protection (captaincy value)
      const costInMillions = player.now_cost / 10;
      if (costInMillions >= 10.0) score *= 1.15;
      else if (costInMillions >= 8.0) score *= 1.08;

      // Smart Template Protection: Use Top 1k EO if available (post-GW1), else fallback to Global Ownership (pre-season)
      const eo = oracle?.getTop1kEO?.(player.id) ?? 0;
      const globalOwnership = parseFloat(player.selected_by_percent || "0");
      const reliableOwnership = eo > 0 ? eo : globalOwnership;
      
      // Heavy template protection (boost high ownership players)
      score *= (1 + 0.01 * reliableOwnership);
    } 
    else if (riskMode === 'aggressive') {
      // Premium player protection
      const costInMillions = player.now_cost / 10;
      if (costInMillions >= 10.0) score *= 1.15;
      else if (costInMillions >= 8.0) score *= 1.08;

      // Smart Differential Boost: Use Top 1k EO if available, else fallback to Global Ownership
      const eo = oracle?.getTop1kEO?.(player.id) ?? 0;
      const globalOwnership = parseFloat(player.selected_by_percent || "0");
      const reliableOwnership = eo > 0 ? eo : globalOwnership;

      // Differential Boost (+25%) for < 5% ownership
      if (reliableOwnership < 5) {
        score *= 1.25;
      }
    }
    else if (riskMode === 'value') {
      // Value Mode: Pure points/value optimization. No biases.
      // We just add a deterministic microscopic tiebreaker for the LP solver
      score += (player.id % 10000) * 1e-4;
    }

    return score;
  }

  static mapToScoredPlayer(p: FPLPlayer, teams: FPLTeam[], fixtures: FPLFixture[], nextEventId: number, riskMode: string, oracle?: CSVOracle, baseXp: number = 0): ScoredPlayer {
    const posMap: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
    const position = posMap[p.element_type] || "MID";
    const team = teams.find(t => t.id === p.team);
    const next3Fix = (fixtures || [])
      .filter(f => (f.team_h === p.team || f.team_a === p.team) && f.event !== null && f.event >= nextEventId)
      .slice(0, 10)
      .map(f => {
        const isHome = f.team_h === p.team;
        const oppTeam = teams.find(t => t.id === (isHome ? f.team_a : f.team_h));
        return {
          event: f.event,
          opponent: oppTeam ? oppTeam.short_name : "TBD",
          difficulty: isHome ? f.team_h_difficulty : f.team_a_difficulty,
          is_home: isHome
        };
      });

    return {
      ...p,
      position,
      team_name: team?.name || "Unknown",
      team_short_name: team?.short_name || "UNK",
      score: this.calculatePlayerScore(p, fixtures, nextEventId, riskMode, oracle),
      xP: oracle ? oracle.getXP(p.id, nextEventId) : (baseXp || parseFloat(String(p.ep_next || "0")) || (p.total_points || 0)),
      ppm: (p.total_points || 0) / ((p.now_cost || 50) / 10),
      next_fixtures: next3Fix,
      isCaptain: false,
      isViceCaptain: false
    };
  }

  static async getRecommendations(riskMode: string, budget: number = 1000, lockedPlayerIds: number[] = [], excludedPlayerIds: number[] = []): Promise<RecommendationResponse> {
    const { players, teams, fixtures, nextEventId } = await this.getBaseData();

    const oracle = new CSVOracle('data/fplform_scraped.csv', players, riskMode, fixtures, teams, nextEventId);

    const available = players.filter(p => p.status === 'a' || p.chance_of_playing_next_round === 100);
    const scored = available.map(p => {
      const mapped = this.mapToScoredPlayer(p, teams, fixtures, nextEventId, riskMode, oracle);
      mapped.xP = oracle.getXP(p.id, nextEventId);
      mapped.eo = oracle.getTop1kEO?.(p.id) ?? 0;
      mapped.ownership = oracle.getTop1kOwnership?.(p.id) ?? parseFloat(p.selected_by_percent || "0") ?? 0;
      return mapped;
    });

    const playerScores = new Map<number, number>();
    scored.forEach(p => playerScores.set(p.id, p.score));

    const lockedSet = new Set<number>(lockedPlayerIds);
    const excludedSet = new Set<number>(excludedPlayerIds);
    const optimalIds = solveOptimalSquad(oracle, nextEventId, budget, 8, riskMode, playerScores, lockedSet, excludedSet);
    const squad = scored.filter(p => optimalIds.includes(p.id));
    
    const sortByScore = (a: ScoredPlayer, b: ScoredPlayer) => (b.score || 0) - (a.score || 0);
    const gkps = squad.filter(p => p.position === "GKP").sort(sortByScore);
    const defs = squad.filter(p => p.position === "DEF").sort(sortByScore);
    const mids = squad.filter(p => p.position === "MID").sort(sortByScore);
    const fwds = squad.filter(p => p.position === "FWD").sort(sortByScore);
    
    // Find the best valid formation by enumerating all legal FPL formations
    // Valid: 3-5 DEF, 2-5 MID, 1-3 FWD, exactly 1 GKP, total 11
    let bestXI: ScoredPlayer[] = [];
    let bestXIScore = -Infinity;
    
    for (let nDef = 3; nDef <= Math.min(5, defs.length); nDef++) {
      for (let nMid = 2; nMid <= Math.min(5, mids.length); nMid++) {
        const nFwd = 10 - nDef - nMid; // 10 outfield slots
        if (nFwd < 1 || nFwd > 3 || nFwd > fwds.length) continue;
        
        const candidate = [
          gkps[0],
          ...defs.slice(0, nDef),
          ...mids.slice(0, nMid),
          ...fwds.slice(0, nFwd)
        ].filter(Boolean) as ScoredPlayer[];
        
        const totalScore = candidate.reduce((sum, p) => sum + (p.score || 0), 0);
        if (totalScore > bestXIScore) {
          bestXIScore = totalScore;
          bestXI = candidate;
        }
      }
    }
    
    const startingXI = bestXI;
    
    // Captaincy Strategy: Heavily favor Attackers (MID/FWD) over DEF/GKP due to higher point ceilings
    const captaincyCandidates = [...startingXI].sort((a, b) => {
      const aWeight = (a.position === 'MID' || a.position === 'FWD') ? 1.5 : 1.0;
      const bWeight = (b.position === 'MID' || b.position === 'FWD') ? 1.5 : 1.0;
      return ((b.xP || 0) * bWeight) - ((a.xP || 0) * aWeight);
    });
    
    return { 
      squad, startingXI, 
      bench: squad.filter(p => !startingXI.find(x => x.id === p.id)).sort((a, b) => {
        if (a.position === 'GKP' && b.position !== 'GKP') return -1;
        if (a.position !== 'GKP' && b.position === 'GKP') return 1;
        return (b.score || 0) - (a.score || 0);
      }),
      captain: captaincyCandidates[0] || null,
      viceCaptain: captaincyCandidates[1] || null,
      expectedPoints: startingXI.reduce((sum, p) => sum + (p.xP || 0), 0),
      totalCost: squad.reduce((sum, p) => sum + (p.now_cost || 0), 0),
      topPicks: {
        gkp: scored.filter(p => p.position === "GKP").sort(sortByScore).slice(0, 5),
        def: scored.filter(p => p.position === "DEF").sort(sortByScore).slice(0, 5),
        mid: scored.filter(p => p.position === "MID").sort(sortByScore).slice(0, 5),
        fwd: scored.filter(p => p.position === "FWD").sort(sortByScore).slice(0, 5)
      },
      nextEventId,
      lastUpdated: Date.now()
    };
  }

  static generateTransfers(squad: ScoredPlayer[], candidates: ScoredPlayer[], oracle: CSVOracle, riskMode: string, gameweek: number): TransferRecommendation[] {
    const transfers: TransferRecommendation[] = [];
    const squadIds = new Set(squad.map(p => p.id));
    const lambda = riskMode === 'safe' ? 0.15 : riskMode === 'aggressive' ? 0.02 : 0.05;

    const get8GwXp = (id: number) => {
      let sum = 0;
      for (let step = 0; step < 8; step++) {
        sum += oracle.getXP(id, gameweek + step);
      }
      return Math.round(sum * 10) / 10;
    };

    const squad8GwXpBefore = Math.round(
      squad.reduce((sum, p) => sum + get8GwXp(p.id), 0) * 10
    ) / 10;

    squad.forEach(outPlayer => {
      const betterOptions = candidates.filter(p => 
        p.position === outPlayer.position && 
        !squadIds.has(p.id) && 
        p.now_cost <= outPlayer.now_cost &&
        (p.score || 0) > (outPlayer.score || 0) + 0.5
      ).sort((a, b) => (b.score || 0) - (a.score || 0));

      if (betterOptions.length > 0) {
        const inPlayer = betterOptions[0];
        const inVar = oracle.getVariance(inPlayer.id, gameweek);
        const outVar = oracle.getVariance(outPlayer.id, gameweek);
        const transferUtilityDelta = (inPlayer.xP - outPlayer.xP) - lambda * (inVar - outVar);
        const xPDelta = inPlayer.xP - outPlayer.xP;

        const horizon8GwXpIn = get8GwXp(inPlayer.id);
        const horizon8GwXpOut = get8GwXp(outPlayer.id);
        const horizon8GwDelta = Math.round((horizon8GwXpIn - horizon8GwXpOut) * 10) / 10;
        const squad8GwXpAfter = Math.round((squad8GwXpBefore + horizon8GwDelta) * 10) / 10;

        transfers.push({ 
          out: outPlayer, 
          in: inPlayer, 
          localTransferSignal: transferUtilityDelta, 
          xPDelta,
          horizon8GwXpIn,
          horizon8GwXpOut,
          horizon8GwDelta,
          squad8GwXpBefore,
          squad8GwXpAfter
        });
      }
    });
    return transfers.sort((a, b) => b.localTransferSignal - a.localTransferSignal).slice(0, 5);
  }

  static generateChipAdvice(squad: ScoredPlayer[], riskMode: string): ChipAdvice[] {
    const avgScore = squad.reduce((sum, p) => sum + (p.score || 0), 0) / (squad.length || 1);
    const topPlayer = [...squad].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    const isRisky = riskMode === 'aggressive';

    return [
      {
        chip: "Wildcard",
        recommendation: (isRisky && avgScore < 5.0) || avgScore < 4.0 ? "STRONG BUY" : "HOLD",
        reason: isRisky && avgScore < 5.0 
          ? "Strategic Overhaul: Your squad is falling behind the differential curve. Wildcard to attack the leaderboard."
          : "Your squad has solid projected points. Save it."
      },
      {
        chip: "Free Hit",
        recommendation: isRisky && avgScore < 4.5 ? "STRONG BUY" : "HOLD",
        reason: isRisky && avgScore < 4.5 
          ? "One-Week Strike: Use your Free Hit to target specific high-upside matchups while keeping your core team intact."
          : "Save your Free Hit for upcoming Blank or Double Gameweeks."
      },
      {
        chip: "Bench Boost",
        recommendation: "AVOID",
        reason: "Wait for a Double Gameweek where your bench players have two fixtures."
      },
      {
        chip: "Triple Captain",
        recommendation: isRisky && topPlayer && topPlayer.score > 12 && topPlayer.selected_by_percent && parseFloat(topPlayer.selected_by_percent) < 10 ? "STRONG BUY" : "HOLD",
        reason: isRisky && topPlayer && topPlayer.score > 12 && topPlayer.selected_by_percent && parseFloat(topPlayer.selected_by_percent) < 10
          ? `High-Risk Gamble: ${topPlayer.web_name} is an elite differential with a massive ceiling this week. Go for the kill.`
          : "Save your Triple Captain for a premium asset with a highly favorable Double Gameweek."
      }
    ];
  }

  static async syncTeam(teamId: string, riskMode: string): Promise<TeamSyncResponse> {
    const baseData = await this.getBaseData();
    const currentEvent = baseData.currentEventId || Math.max(1, baseData.nextEventId - 1);
    
    // 1. Initialize the V3 Engine Oracle first
    const oracle = new CSVOracle('data/fplform_scraped.csv', baseData.players, riskMode, baseData.fixtures, baseData.teams, baseData.nextEventId);

    // 2. Fetch live user team
    let teamRes: any;
    let managerInfo: any = null;
    try {
      const [picksRes, entryRes] = await Promise.allSettled([
        this.fetchWithRetry(`${FPL_BASE_URL}/entry/${teamId}/event/${currentEvent}/picks/`),
        this.fetchWithRetry(`${FPL_BASE_URL}/entry/${teamId}/`)
      ]);
      if (picksRes.status === 'fulfilled' && picksRes.value?.data) {
        teamRes = picksRes.value;
      } else {
        const err: any = (picksRes as any).reason;
        if (err?.response?.status === 404) {
          throw new Error(`FPL API Error: Team ID ${teamId} not found, or squads are locked.`);
        }
        throw err || new Error("Failed to fetch team picks");
      }
      if (entryRes.status === 'fulfilled' && entryRes.value?.data) {
        const d = entryRes.value.data;
        managerInfo = {
          id: d.id,
          teamName: d.name || 'FPL Team',
          managerName: `${d.player_first_name || ''} ${d.player_last_name || ''}`.trim(),
          summary_overall_rank: d.summary_overall_rank,
          summary_overall_points: d.summary_overall_points,
          summary_event_points: d.summary_event_points,
            summary_event_rank: d.summary_event_rank,
          last_deadline_total_transfers: d.last_deadline_total_transfers
        };
      }
    } catch (err: any) {
      if (err.message?.includes('FPL API Error')) throw err;
      throw new Error(`FPL Sync Error: ${err.message || 'Could not retrieve team data'}`);
    }

    const myPicks = teamRes.data.picks.map((p: any) => {
      const player = baseData.players.find((pl: any) => pl.id === p.element);
      if (!player) return null;
      const baseMapped = this.mapToScoredPlayer(player, baseData.teams, baseData.fixtures, baseData.nextEventId, riskMode);
      return {
        ...baseMapped,
        xP: oracle.getXP(player.id, baseData.nextEventId),
        eo: oracle.getTop1kEO?.(player.id) ?? 0,
        ownership: oracle.getTop1kOwnership?.(player.id) ?? parseFloat(player.selected_by_percent || "0") ?? 0,
        isCaptain: p.is_captain,
        isViceCaptain: p.is_vice_captain,
        position_in_squad: p.position,
        multiplier: p.multiplier
      };
    }).filter(Boolean) as ScoredPlayer[];

    const simulator = new Simulator(true); // Vercel mode = true
    
    const bank = teamRes.data.entry_history?.bank || 0;

    const initialState = {
      squad: myPicks.map(p => p.id),
      bank, // Live bank value
      freeTransfers: 1, // Defaulting to 1 for live pull
      chipState: { 'WC': 1, 'BB': 1, 'TC': 1, 'FH': 1 }, // Assuming chips are available for testing
      gameweek: baseData.nextEventId,
      accumulatedScore: 0
    };

    // 3. Execute the Multi-Horizon Beam Search
    console.log(`[V3 Engine] Executing Beam Search for Team ${teamId}...`);
    const bestFutures = simulator.simulateHorizon(initialState, oracle, riskMode);
    
    // 4. Map the V3 Output to the V1 UI format
    // We will look at the immediate next step in the best trajectory
    let optimalFirstMove = 'ROLL';
    if (bestFutures.length > 0) {
      optimalFirstMove = bestFutures[0].firstAction || 'ROLL';
    }

    const recommendations = await this.getRecommendations(riskMode);
    const candidates = [
      ...recommendations.topPicks.gkp,
      ...recommendations.topPicks.def,
      ...recommendations.topPicks.mid,
      ...recommendations.topPicks.fwd
    ];

    let transfers: TransferRecommendation[] = [];

    const get8GwXp = (id: number) => {
      let sum = 0;
      for (let step = 0; step < 8; step++) {
        sum += oracle.getXP(id, baseData.nextEventId + step);
      }
      return Math.round(sum * 10) / 10;
    };

    const squad8GwXpBefore = Math.round(
      myPicks.reduce((sum, p) => sum + get8GwXp(p.id), 0) * 10
    ) / 10;

    if (optimalFirstMove === 'TRANSFER' && bestFutures.length > 0 && bestFutures[0].firstTransfersIn && bestFutures[0].firstTransfersOut) {
      const ins = bestFutures[0].firstTransfersIn;
      const outs = bestFutures[0].firstTransfersOut;
      const lambda = riskMode === 'safe' ? 0.15 : riskMode === 'aggressive' ? 0.02 : 0.05;
      for (let i = 0; i < ins.length; i++) {
        const inPlayer = baseData.players.find(p => p.id === ins[i]);
        const outPlayer = myPicks.find(p => p.id === outs[i]);
        if (inPlayer && outPlayer) {
          const inMapped = FPLService.mapToScoredPlayer(inPlayer, baseData.teams, baseData.fixtures, baseData.nextEventId, riskMode);
          const inScored = { ...inMapped, xP: oracle.getXP(inPlayer.id, baseData.nextEventId) };
          
          const inVar = oracle.getVariance(inPlayer.id, baseData.nextEventId);
          const outVar = oracle.getVariance(outPlayer.id, baseData.nextEventId);
          const transferUtilityDelta = (inScored.xP - outPlayer.xP) - lambda * (inVar - outVar);
          const xPDelta = inScored.xP - outPlayer.xP;

          const horizon8GwXpIn = get8GwXp(inPlayer.id);
          const horizon8GwXpOut = get8GwXp(outPlayer.id);
          const horizon8GwDelta = Math.round((horizon8GwXpIn - horizon8GwXpOut) * 10) / 10;
          const squad8GwXpAfter = Math.round((squad8GwXpBefore + horizon8GwDelta) * 10) / 10;

          transfers.push({
            out: outPlayer,
            in: inScored,
            localTransferSignal: transferUtilityDelta,
            xPDelta,
            horizon8GwXpIn,
            horizon8GwXpOut,
            horizon8GwDelta,
            squad8GwXpBefore,
            squad8GwXpAfter
          });
        }
      }
    }

    if (transfers.length === 0) {
      transfers = this.generateTransfers(myPicks, candidates, oracle, riskMode, baseData.nextEventId);
    }

    const targetEvent = baseData.nextEventId;
    const isSet1 = targetEvent <= 19;
    const remainingGwsInSet = isSet1 ? Math.max(0, 19 - targetEvent) : Math.max(0, 38 - targetEvent);
    const setHeader = isSet1 ? "Set 1 (GW1–19)" : "Set 2 (GW20–38)";

    const chips: ChipAdvice[] = [
      {
        chip: `Wildcard (${setHeader})`,
        recommendation: optimalFirstMove === 'WC' ? "STRONG BUY" : "HOLD",
        reason: optimalFirstMove === 'WC' 
          ? "V3 Engine recommends activating Wildcard to restructure your squad." 
          : isSet1 
            ? `Set 1 Wildcard expires at the GW19 deadline (${remainingGwsInSet} GWs left). Optimal window: GW6–GW8 during the international break.`
            : "Set 2 Wildcard active. Hold for major spring Double Gameweek preparation."
      },
      {
        chip: `Free Hit (${setHeader})`,
        recommendation: optimalFirstMove === 'FH' ? "STRONG BUY" : "HOLD",
        reason: optimalFirstMove === 'FH' 
          ? "V3 Engine recommends a Free Hit this week." 
          : isSet1 
            ? `Set 1 Free Hit expires at GW19 (${remainingGwsInSet} GWs left). Hold for an autumn fixture clash, European rotation, or postponement.`
            : "Set 2 Free Hit active. Hold for the major spring Blank Gameweek (GW29/30)."
      },
      {
        chip: `Bench Boost (${setHeader})`,
        recommendation: optimalFirstMove === 'BB' ? "STRONG BUY" : "HOLD",
        reason: optimalFirstMove === 'BB' 
          ? "V3 Engine detects extraordinary bench expected points (>= 16.0 xP). Play now!" 
          : isSet1 
            ? `Set 1 Bench Boost expires at GW19 (${remainingGwsInSet} GWs left). Optimal play: deploy immediately after your Wildcard when all 15 squad players are fit and starting.`
            : "Set 2 Bench Boost active. Hold for the massive spring Double Gameweek (GW34/GW37)."
      },
      {
        chip: `Triple Captain (${setHeader})`,
        recommendation: optimalFirstMove === 'TC' ? "STRONG BUY" : "HOLD",
        reason: optimalFirstMove === 'TC' 
          ? "V3 Engine detects an elite captaincy matchup (>= 9.5 xP). Play now!" 
          : isSet1 
            ? `Set 1 Triple Captain expires at GW19 (${remainingGwsInSet} GWs left). Prime target: Haaland in GW5 (vs Sunderland at Home) or GW7.`
            : "Set 2 Triple Captain active. Hold for a premium asset in a confirmed Double Gameweek."
      }
    ];

    const totalCost = myPicks.reduce((sum, p) => sum + (p.now_cost || 0), 0);

    const rawHistory = teamRes?.data?.entry_history;
    const entryHistory = rawHistory ? {
      points: rawHistory.points ?? 0,
      total_points: rawHistory.total_points ?? 0,
      overall_rank: rawHistory.overall_rank ?? 0,
      rank: rawHistory.rank ?? 0,
      event_transfers: rawHistory.event_transfers ?? 0,
      event_transfers_cost: rawHistory.event_transfers_cost ?? 0,
      value: rawHistory.value ? rawHistory.value / 10 : 0,
      bank: rawHistory.bank ? rawHistory.bank / 10 : 0
    } : null;

    return {
      squad: myPicks,
      transfers,
      chips,
      bank,
      totalCost,
      entryHistory,
      managerInfo
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const query = req.query || {};
    const riskMode = parsedUrl.searchParams.get('riskMode') || (query.riskMode as string) || 'safe';

    if (pathname.includes('/api/recommendations')) {
      const budgetParam = parsedUrl.searchParams.get('budget');
      const budget = budgetParam ? parseInt(budgetParam) : query.budget ? parseInt(query.budget as string) : 1000;
      const lockedStr = parsedUrl.searchParams.get('locked') || (query.locked as string) || '';
      const excludedStr = parsedUrl.searchParams.get('excluded') || (query.excluded as string) || '';
      const lockedParam = lockedStr ? lockedStr.split(',').map(Number).filter(Boolean) : [];
      const excludedParam = excludedStr ? excludedStr.split(',').map(Number).filter(Boolean) : [];
      const result = await FPLService.getRecommendations(riskMode, budget, lockedParam, excludedParam);
      return res.status(200).json(result);
    } 
    
    if (pathname.includes('/api/sync')) {
      const teamId = pathname.split('/').pop()?.split('?')[0];
      if (!teamId || teamId === 'sync') return res.status(400).json({ error: "Missing Team ID" });
      const result = await FPLService.syncTeam(teamId, riskMode);
      return res.status(200).json(result);
    }

    if (pathname.includes('/api/live')) {
      const eventId = pathname.split('/').pop()?.split('?')[0];
      if (!eventId || eventId === 'live') return res.status(400).json({ error: "Missing Event ID" });
      const liveRes = await FPLService.fetchWithRetry(`${FPL_BASE_URL}/event/${eventId}/live/`);
      return res.status(200).json(liveRes.data);
    }

    if (pathname.includes('/api/auto-snapshot')) {
      const db = (await import('../lib/firestore.js')).getFirestore();
      if (!db) {
        return res.status(500).json({ error: "Firestore not configured" });
      }

      const staticRes = await axios.get(`${FPL_BASE_URL}/bootstrap-static/`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const nextEvent = staticRes.data.events?.find((e: any) => e.is_next) ??
                        staticRes.data.events?.find((e: any) => new Date(e.deadline_time) > new Date());
      const gwId = nextEvent?.id || 1;

      const defaultTeamIds: string[] = ['532002', '1884833', '3097103', '902458', '904491', '601847', '906422', '1921923', '1924837', '600311', '3274378', '9291073', '903137'];
      const teamIdList: string[] = [...defaultTeamIds];

      try {
        const snapshotDocs = await db.collection('user_snapshots').get();
        snapshotDocs.forEach((doc: any) => {
          if (doc.id.startsWith('team_')) {
            const tid = doc.id.replace('team_', '').trim();
            if (tid && !teamIdList.includes(tid)) {
              teamIdList.push(tid);
            }
          }
        });
      } catch (err: any) {
        console.warn("[AutoSnapshot] Notice fetching Firestore team documents:", err.message);
      }

      const fuels: ('fplform' | 'native' | 'eye-test')[] = ['fplform', 'native', 'eye-test'];
      const modes: ('safe' | 'aggressive' | 'value')[] = ['safe', 'aggressive', 'value'];
      const scenarios: ('quant' | 'template')[] = ['quant', 'template'];

      let count = 0;
      for (const tid of teamIdList) {
        const docKey = `team_${tid}`;
        try {
          const docRef = db.collection('user_snapshots').doc(docKey);
          const docSnap = await docRef.get();
          const existingHistory = docSnap.exists ? (docSnap.data()?.history || {}) : {};
          const newGwHistory = { ...(existingHistory[gwId] || {}) };

          for (const fuel of fuels) {
            for (const scenario of scenarios) {
              for (const mode of modes) {
                const snapshotKey = `${fuel}_${scenario}_${mode}`;
                const snapshotItem = {
                  key: snapshotKey,
                  fuel,
                  scenario,
                  riskMode: mode,
                  fuelLabel: fuel === 'eye-test' ? 'Eye Test' : fuel === 'native' ? 'Native FPL' : 'FPLForm',
                  scenarioLabel: scenario === 'quant' ? 'Quant Optimal' : 'Risky Template Shield',
                  riskLabel: mode.toUpperCase(),
                  autoGenerated: true,
                  timestamp: Date.now()
                };
                newGwHistory[snapshotKey] = snapshotItem;
                newGwHistory[mode] = snapshotItem;
              }
            }
          }

          existingHistory[gwId] = newGwHistory;
          await docRef.set({
            history: existingHistory,
            season: '2026/27',
            lastAutoSnapshotAt: new Date()
          }, { merge: true });
          count++;
        } catch (e: any) {
          console.error(`[AutoSnapshot] Error processing team ${tid}:`, e.message);
        }
      }

      return res.status(200).json({ success: true, message: `Auto-snapshot completed for GW${gwId}`, snapshottedCount: count, totalTeams: teamIdList.length });
    }

    if (pathname.includes('/api/ping')) {
      return res.status(200).json({ status: "ok", message: "Grand Cru Engine Online" });
    }

    res.status(404).json({ error: "Route not found" });
  } catch (error: any) {
    console.error("[CRITICAL] FPL Engine Failure:", error);
    res.status(500).json({ 
      error: "FPL Engine Failure", 
      message: error.message
    });
  }
}
