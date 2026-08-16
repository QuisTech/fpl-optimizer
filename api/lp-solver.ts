import solver from "javascript-lp-solver";
import { XPOracle } from "./ingestion";

interface LPSolverModel {
  optimize: string;
  opType: "max" | "min";
  constraints: Record<string, { max?: number; min?: number; equal?: number }>;
  variables: Record<string, Record<string, number>>;
  ints: Record<string, 1>;
}

export function solveOptimalSquad(oracle: XPOracle, gameweek: number, budget: number, horizon: number = 8, riskMode: string = 'safe', playerScores?: Map<number, number>, lockedIds?: Set<number>, excludedIds?: Set<number>): number[] {
  const allIds = oracle.getAllPlayerIds();
  
  const model: LPSolverModel = {
    optimize: "score",
    opType: "max",
    constraints: { 
      cost: { max: budget }, 
      total: { equal: 15 }, 
      gkp: { equal: 2 }, 
      def: { equal: 5 }, 
      mid: { equal: 5 }, 
      fwd: { equal: 3 } 
    },
    variables: {},
    ints: {}
  };

  allIds.forEach(id => {
    if (excludedIds && excludedIds.has(id)) return;
    const team = oracle.getTeam(id);
    if (!model.constraints[`team_${team}`]) {
      model.constraints[`team_${team}`] = { max: 3 };
    }

    const v = `p_${id}`;
    const pos = oracle.getPosition(id).toLowerCase(); // "gkp", "def", "mid", "fwd"
    
    let score = 0;
    if (playerScores) {
      if (!playerScores.has(id)) return; // Skip players filtered out (e.g. injured/unavailable)
      score = playerScores.get(id)!;
    } else {
      for (let i = 0; i < horizon; i++) {
        score += oracle.getXP(id, gameweek + i);
      }
    }
    
    const cost = oracle.getCost(id);



    // Only consider players who have a score > 0 to keep the model small
    const isLocked = !!(lockedIds && lockedIds.has(id));
    if (score > 0 || isLocked) {
      model.variables[v] = { 
        score, 
        cost, 
        total: 1, 
        [pos]: 1, 
        [`team_${team}`]: 1, 
        [v]: 1 
      };
      model.constraints[v] = isLocked ? { equal: 1 } : { max: 1 };
      model.ints[v] = 1;
    }
  });

  const solution = solver.Solve(model) as Record<string, any>;
  
  const squadIds: number[] = [];
  for (const key in solution) {
    if (key.startsWith('p_')) {
      const val = solution[key];
      if (val === true || val === 1 || (typeof val === 'number' && val > 0.5)) {
        squadIds.push(parseInt(key.replace('p_', '')));
      }
    }
  }

  return squadIds;
}

export function solveOptimalTransfers(
  oracle: XPOracle, 
  gameweek: number, 
  currentSquad: number[], 
  bank: number, 
  maxTransfers: number,
  horizon: number = 8,
  riskMode: string = 'safe'
): { squad: number[]; transfersIn: number[]; transfersOut: number[] } | null {
  const allIds = oracle.getAllPlayerIds();
  const currentSet = new Set(currentSquad);
  
  // Calculate total squad value
  let squadValue = 0;
  currentSquad.forEach(id => squadValue += oracle.getCost(id));
  const budget = squadValue + bank;

  const model: LPSolverModel = {
    optimize: "score",
    opType: "max",
    constraints: { 
      cost: { max: budget }, 
      total: { equal: 15 }, 
      gkp: { equal: 2 }, 
      def: { equal: 5 }, 
      mid: { equal: 5 }, 
      fwd: { equal: 3 },
      keep: { min: 15 - maxTransfers }
    },
    variables: {},
    ints: {}
  };

  allIds.forEach(id => {
    const team = oracle.getTeam(id);
    if (!model.constraints[`team_${team}`]) {
      model.constraints[`team_${team}`] = { max: 3 };
    }

    const v = `p_${id}`;
    const pos = oracle.getPosition(id).toLowerCase();
    
    // Sum expected points over the lookahead horizon
    let score = 0;
    for (let i = 0; i < horizon; i++) {
      score += oracle.getXP(id, gameweek + i);
    }
    
    const cost = oracle.getCost(id);

    const isCurrent = currentSet.has(id);

    // Consider current squad players OR players with score > 0
    if (isCurrent || score > 0) {
      model.variables[v] = { 
        score, 
        cost, 
        total: 1, 
        [pos]: 1, 
        [`team_${team}`]: 1, 
        keep: isCurrent ? 1 : 0,
        [v]: 1 
      };
      model.constraints[v] = { max: 1 };
      model.ints[v] = 1;
    }
  });

  const solution = solver.Solve(model) as Record<string, any>;
  if (!solution || !solution.feasible) {
    return null;
  }

  const squad: number[] = [];
  for (const key in solution) {
    if (key.startsWith('p_')) {
      const val = solution[key];
      if (val === true || val === 1 || (typeof val === 'number' && val > 0.5)) {
        squad.push(parseInt(key.replace('p_', '')));
      }
    }
  }

  const newSet = new Set(squad);
  const transfersIn = squad.filter(id => !currentSet.has(id));
  const transfersOut = currentSquad.filter(id => !newSet.has(id));

  return { squad, transfersIn, transfersOut };
}
