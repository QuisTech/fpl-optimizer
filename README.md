# FPL Optimizer (V3)

> **An elite Fantasy Premier League (FPL) solver utilizing Integer Linear Programming (LP) and Multi-Horizon Beam Search. Features real-time FPL team syncing, automated xP scraping, probabilistic variance modeling, and risk-adjusted squad optimization.**

🌐 **Live Web Application**: [fpl-optimizer-mu.vercel.app](https://fpl-optimizer-mu.vercel.app/)

## 🚀 The V3 Architecture

Unlike traditional FPL tools that only look at the immediate upcoming gameweek, the V3 Engine simulates multiple gameweeks into the future. It traverses thousands of potential squad states, evaluating the mathematical Expected Value (EV) of free transfers, points hits, and chip usage.

### 🧠 The Core Components
1. **The Multi-Horizon Simulator (`api/simulator.ts`)**
   - Implements a Beam Search algorithm to explore the massive combinatorial tree of future Gameweeks.
   - Natively understands FPL constraints (Budget limits, 2/5/5/3 positional rules).
   - Tracks the **Chip State Machine**, allowing it to autonomously decide when to play `Wildcard`, `Free Hit`, `Bench Boost`, or `Triple Captain`.

2. **The LP Solver (`api/lp-solver.ts`)**
   - Built on `javascript-lp-solver`.
   - Used heavily during `Wildcard` and `Free Hit` simulation branches. When a chip is played in a simulated future, the Simulator passes the exact available budget to the LP Solver, which instantly returns the mathematically perfect 15-man squad for that Gameweek horizon.

3. **The Autonomous Oracle (`scripts/fetch-xp.ts` & `scripts/check-deadline.ts`)**
   - The engine is powered by Expected Points (xP) data ingested from FPLForm.
   - We utilize a **"Sniper Bot"** GitHub Action (`.github/workflows/sniper-fetch.yml`). 
   - Every hour, the bot checks the Official FPL API for the upcoming deadline. Exactly 1-2 hours before the deadline (after all press conferences and leaks), it fires up a headless Playwright browser, scrapes the freshest xP data, and commits it back to the repository autonomously.

## ⚙️ Running Locally

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Test the V3 Engine locally (without spinning up the frontend):
```bash
npx tsx test_api.ts
```

## ☁️ Vercel Deployment

This project is perfectly tuned for Vercel. Because Vercel serverless functions have strict execution time limits, the Simulator automatically scales its `beamWidth` and `maxDepth` based on the environment to ensure it always returns a result before the Vercel timeout.

To deploy manually:
```bash
npx vercel --prod
```

## 🤝 Using "Elite 1000" EO Data
To take the optimization to the next level, you can manually input FPLReview "Elite 1000" Effective Ownership (EO) data into the Oracle. This allows the Engine to calculate **Risk Penalties**. If a player has >100% Elite EO, the Engine knows that *not* owning them is a mathematical rank risk, and will adjust its transfers accordingly.
