import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function app() {
  const existing = getApps()[0];
  if (existing) return existing;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("Email verification is not configured yet.");
  const credentials = JSON.parse(json);
  return initializeApp({ credential: cert(credentials) });
}

export function adminAuth() { return getAuth(app()); }
export function adminDb() { return getFirestore(app()); }
