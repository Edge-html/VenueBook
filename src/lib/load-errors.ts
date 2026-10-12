import { FirebaseError } from "firebase/app";

/**
 * True when Firestore/Storage refused the request because the security rules
 * are still the default "deny everything" ones.
 */
export function isPermissionError(error: unknown): boolean {
  if (error instanceof FirebaseError) {
    return error.code === "permission-denied" || /permission/i.test(error.message);
  }
  return error instanceof Error && /permission/i.test(error.message);
}

/**
 * The one message that explains the most common setup gap, instead of a raw
 * Firestore error that leaves people stuck.
 */
export const RULES_NOT_DEPLOYED =
  "Database rules have not been deployed yet. An administrator needs to run: firebase deploy --only firestore:rules,firestore:indexes,storage";

/** Human-readable reason for any load failure. */
export function describeLoadError(error: unknown, fallback: string): string {
  if (isPermissionError(error)) return RULES_NOT_DEPLOYED;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}