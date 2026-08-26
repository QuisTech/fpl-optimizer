import { Firestore } from '@google-cloud/firestore';

let db: Firestore | null = null;

export function getFirestore(): Firestore | null {
  if (db) return db;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  try {
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
