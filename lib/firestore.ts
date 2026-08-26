import { Firestore } from '@google-cloud/firestore';

let db: Firestore | null = null;

export function getFirestore(): Firestore | null {
  if (db) return db;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim();
  let privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("[Firestore] Missing credentials env vars:", {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey
    });
    return null;
  }

  try {
    privateKey = privateKey.trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim();
    db = new Firestore({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey
      },
      ignoreUndefinedProperties: true
    });
    return db;
  } catch (error) {
    console.warn("[Firestore] Error initializing Firestore client:", error);
    return null;
  }
}
