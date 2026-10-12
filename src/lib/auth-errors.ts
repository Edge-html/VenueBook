import { FirebaseError } from "firebase/app";

/** Turns Firebase's auth codes into something a student can act on. */
export function friendlyAuthError(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    if (error instanceof Error) return error.message;
    return "Something went wrong. Please try again.";
  }

  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email, phone number, or password is incorrect.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/email-already-in-use":
      return "An account already exists with that email. Try signing in instead.";
    case "auth/weak-password":
      return "Password must be at least 8 characters long.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/operation-not-allowed":
    case "auth/configuration-not-found":
      return "Email sign-in is not enabled for this project yet. An administrator needs to turn on Email/Password in the Firebase console (Authentication → Sign-in method).";
    case "auth/unauthorized-domain":
      return "This domain is not authorised in the Firebase console.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}