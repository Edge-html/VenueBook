import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/**
 * The web config is public by design — it ships to the browser either way. The
 * literals below keep the app working the moment it is cloned; every field can
 * be overridden with a `NEXT_PUBLIC_FIREBASE_*` variable on Vercel.
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyAhzRNxu9CnlzAbPnC9BiX3d2yDVUV6GyU",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "simple-note-app-e9e59.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "simple-note-app-e9e59",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "simple-note-app-e9e59.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "135416078600",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:135416078600:web:7dd249ba5a22f48d58ccbd",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-KGQ28LX5H5",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

/**
 * Analytics is opt-in and defensive: it is a client-only concern, throws when
 * cookies/storage are blocked, and adds nothing when measurementId is absent.
 */
export async function enableAnalytics(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!firebaseConfig.measurementId) return false;
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (!(await isSupported())) return false;
    getAnalytics(firebaseApp);
    return true;
  } catch {
    return false;
  }
}