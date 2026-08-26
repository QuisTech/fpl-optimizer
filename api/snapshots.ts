import type { Request, Response } from "express";

let memorySnapshotStore: Record<string, any> = {};

export default async function handler(req: Request, res: Response) {
  const origin = req.headers.origin || '';
  const allowedOrigin = origin.includes('localhost') || origin.includes('vercel.app') ? origin : (process.env.APP_URL || '*');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = (req.query.userId as string) || (req.body?.userId as string) || 'default_user';

  try {
    if (req.method === 'GET') {
      return res.json({ history: memorySnapshotStore[userId] || {} });
    }

    if (req.method === 'POST') {
      const { history } = req.body;
      if (!history || typeof history !== 'object') {
        return res.status(400).json({ error: "Invalid history payload" });
      }

      memorySnapshotStore[userId] = {
        ...(memorySnapshotStore[userId] || {}),
        ...history
      };

      return res.json({ success: true, history: memorySnapshotStore[userId] });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Snapshots API Error:", error);
    return res.json({ history: {} });
  }
}
