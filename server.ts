import express from "express";
import { createServer as createViteServer } from "vite";
import { FPLService } from "./api/index";

const app = express();
const PORT = 3000;

async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  // Request Logging
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });

  // Local API Proxies to the Unified FPLService

  app.get("/api/recommendations", async (req, res) => {
    try {
      const riskMode = (req.query.riskMode as string) || 'safe';
      const budget = req.query.budget ? parseInt(req.query.budget as string) : 1000;
      const result = await FPLService.getRecommendations(riskMode, budget);
      res.json(result);
    } catch (error: any) {
      console.error("Local Dev Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sync/:teamId", async (req, res) => {
    try {
      const { teamId } = req.params;
      const riskMode = (req.query.riskMode as string) || 'safe';
      const result = await FPLService.syncTeam(teamId, riskMode);
      res.json(result);
    } catch (error: any) {
      console.error("Local Dev Sync Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  
  app.get("/api/live/:eventId", async (req, res) => {
    try {
      const { eventId } = req.params;
      const axios = (await import('axios')).default;
      const [liveRes, fixturesRes] = await Promise.all([
        axios.get(`https://fantasy.premierleague.com/api/event/${eventId}/live/`, {
          headers: { "User-Agent": "Mozilla/5.0" }
        }),
        axios.get(`https://fantasy.premierleague.com/api/fixtures/?event=${eventId}`, {
          headers: { "User-Agent": "Mozilla/5.0" }
        }).catch(() => ({ data: [] }))
      ]);
      res.json({
        elements: liveRes.data.elements,
        fixtures: fixturesRes.data || []
      });
    } catch (error: any) {
      console.error("Local Dev Live Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[GRAND CRU] Development server running on http://localhost:${PORT}`);
  });
}

startServer();
