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
 * Storage uploads fail with a CORS error and a retry-limit message when the
 * bucket has never been created for the project. None of that reaches the
 * person filling in the form, so it is translated here.
 */
export function friendlyStorageError(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : "";
  const message = error instanceof Error ? error.message : "";

  const looksLikeNetwork =
    /Failed to fetch|NetworkError|ERR_FAILED|CORS|Load failed/i.test(message);

  if (
    code === "storage/retry-limit-exceeded" ||
    code === "storage/canceled" ||
    (looksLikeNetwork && code.startsWith("storage/")) ||
    (looksLikeNetwork && code === "")
  ) {
    return "We could not reach Firebase Storage, so your ID photo was not uploaded. Storage is probably not enabled for this project yet — please ask an administrator to set it up, or submit without a photo for now.";
  }

  if (code === "storage/unauthorized" || code === "storage/canceled") {
    return "Your session may have expired. Please sign in again and retry.";
  }

  if (code === "storage/quota-exceeded") {
    return "The upload is too large. Please use an image under 5 MB.";
  }

  if (code === "storage/invalid-argument") {
    return "That file could not be uploaded. Please choose a JPG, PNG, or WEBP image.";
  }

  return error instanceof Error && message ? message : "The ID photo could not be uploaded.";
}

/**
 * The Storage SDK retries for roughly a minute before giving up, which reads as
 * a frozen page. Failing sooner keeps the form usable.
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