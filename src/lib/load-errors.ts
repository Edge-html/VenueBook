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

/**
 * ID photos are written to Firestore as bytes. A failure there is almost
 * always a connectivity problem or the document limit, neither of which should
 * reach the person filling in the form.
 */
export function friendlyStorageError(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : "";
  const message = error instanceof Error ? error.message : "";

  if (error instanceof TimeoutError) {
    return "The ID photo took too long to upload. You can submit without it and an admin can ask you for it later.";
  }

  const looksLikeNetwork = /Failed to fetch|NetworkError|ERR_FAILED|CORS|Load failed/i.test(message);

  if (code === "permission-denied" || looksLikeNetwork) {
    return "We could not save your ID photo. You can still submit the request without it and an admin can ask you for it later.";
  }

  if (code === "resource-exhausted" || /too large|exceeds/i.test(message)) {
    return "That image is too large. Please use a smaller photo, or submit without it for now.";
  }

  if (code === "unauthenticated") {
    return "Your session has expired. Please sign in again and retry.";
  }

  return "The ID photo could not be saved. You can submit without it and an admin can ask you for it later.";
}

/**
 * Firestore writes can hang on a flaky connection; failing sooner keeps the
 * form usable.
 */
export class TimeoutError extends Error {
  constructor() {
    super("The upload took too long.");
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}