import { getFirestore } from "../lib/firestore.js";
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
    const db = getFirestore();

    if (req.method === 'GET') {
      if (db) {
        try {
          const doc = await db.collection('user_snapshots').doc(userId).get();
          if (doc.exists && doc.data()?.history) {
            return res.json({ history: doc.data()?.history, source: 'firestore' });
          }
        } catch (dbErr: any) {
          console.error("Firestore GET error:", dbErr);
          return res.json({ history: memorySnapshotStore[userId] || {}, source: 'memory_fallback', error: dbErr.message });
        }
      }
      return res.json({ history: memorySnapshotStore[userId] || {}, source: db ? 'firestore_empty' : 'memory_no_db' });
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

      let firestoreSynced = false;
      let syncError: string | null = null;

      if (db) {
        try {
          await db.collection('user_snapshots').doc(userId).set({
            history: memorySnapshotStore[userId],
            updatedAt: new Date()
          }, { merge: true });
          firestoreSynced = true;
        } catch (dbErr: any) {
          console.error("Firestore POST error:", dbErr);
          syncError = dbErr.message;
        }
      }

      return res.json({ 
        success: true, 
        history: memorySnapshotStore[userId], 
        source: firestoreSynced ? 'firestore' : 'memory',
        ...(syncError ? { warning: syncError } : {}) 
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Snapshots API Error:", error);
    return res.json({ history: memorySnapshotStore[userId] || {}, error: error.message });
  }
}
