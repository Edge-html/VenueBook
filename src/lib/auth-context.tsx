"use client";

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  reload,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { auth, db } from "./firebase";
import { looksLikeEmail, normalizePhone } from "./phone";
import type { UserProfile } from "./types";
import { uploadIdPhoto } from "./data";

export interface SignUpInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  grade: string;
  section: string;
  idPhoto: File;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  /** True until Firebase has resolved the session on first paint. */
  initialising: boolean;
  isAdmin: boolean;
  signUp: (input: SignUpInput) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (identifier: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initialising, setInitialising] = useState(true);

  const loadProfile = useCallback(async (nextUser: User) => {
    const email = nextUser.email ?? "";
    const displayName = nextUser.displayName ?? email.split("@")[0] ?? "Student";

    try {
      const snap = await getDoc(doc(db, "users", nextUser.uid));

      if (snap.exists()) {
        const data = snap.data() as Omit<UserProfile, "uid">;
        if (nextUser.emailVerified && data.emailOtpVerified !== true) {
          try {
            await updateDoc(doc(db, "users", nextUser.uid), { emailOtpVerified: true });
            data.emailOtpVerified = true;
          } catch {
            // Firestore rules must allow a verified Firebase email claim to
            // promote this legacy profile flag. Booking rules also check the
            // claim directly, so a missing profile write cannot bypass auth.
          }
        }
        setProfile({ uid: nextUser.uid, ...data });
        return;
      }

      // First sign-in on an account with no profile document yet. New accounts
      // are always students — the security rules reject any other role here,
      // and admins are promoted deliberately rather than self-granted.
      const seed: UserProfile = {
        uid: nextUser.uid,
        fullName: displayName,
        email,
        phone: "",
        role: "student",
        verificationRequired: true,
        emailOtpVerified: false,
        createdAt: serverTimestamp() as never,
      };
      await setDoc(doc(db, "users", nextUser.uid), seed);
      setProfile(seed);
    } catch {
      // The read or write was refused — almost always because the security
      // rules have not been deployed. Fall back to what Auth itself knows so
      // the app stays usable instead of hanging on a profile that never lands.
      setProfile({
        uid: nextUser.uid,
        fullName: displayName,
        email,
        phone: "",
        role: "student",
        verificationRequired: true,
        emailOtpVerified: false,
      });
    }
  }, []);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;
      try {
        if (nextUser) {
          // loadProfile handles its own failures, so a profile always lands.
          await loadProfile(nextUser);
        } else {
          setProfile(null);
        }
      } catch {
        // Belt and braces: never leave the UI waiting on a profile.
        if (nextUser) {
          const email = nextUser.email ?? "";
          setProfile({
            uid: nextUser.uid,
            fullName: nextUser.displayName ?? email.split("@")[0] ?? "Student",
            email,
            phone: "",
            role: "student",
            verificationRequired: true,
            emailOtpVerified: false,
          });
        } else {
          setProfile(null);
        }
      } finally {
        if (active) {
          setUser(nextUser);
          setInitialising(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadProfile]);

  const sendVerificationEmail = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Sign in to request an email verification link.");
    await sendEmailVerification(currentUser, {
      url: `${window.location.origin}/verify-email?verified=1`,
      handleCodeInApp: false,
    });
  }, []);

  const signUp = useCallback(async ({ fullName, phone, email, password, grade, section, idPhoto }: SignUpInput) => {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const phoneE164 = normalizePhone(phone);
    const idPhotoUrl = await uploadIdPhoto(idPhoto, credential.user.uid);
    await updateProfile(credential.user, { displayName: fullName.trim() });

    // Never overwrite an existing profile: this can run on a re-signup, and a
    // blanket write would silently reset an admin's role back to student.
    const profileRef = doc(db, "users", credential.user.uid);
    {
      await setDoc(profileRef, {
        uid: credential.user.uid,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phoneE164,
        grade,
        section: section.trim(),
        idPhotoUrl,
        verificationRequired: true,
        emailOtpVerified: false,
        // Always a student. Admins are promoted deliberately in the Firebase
        // console, never by the client.
        role: "student",
      } satisfies Omit<UserProfile, "createdAt">, { merge: true });
    }
    await sendEmailVerification(credential.user, {
      url: `${window.location.origin}/verify-email?verified=1`,
      handleCodeInApp: false,
    });
    await loadProfile(credential.user);
  }, [loadProfile]);

  const resolveEmail = useCallback(async (identifier: string): Promise<string> => {
    const value = identifier.trim();
    if (looksLikeEmail(value)) return value.toLowerCase();

    // Phone sign-in: the password still belongs to the email account, so look
    // the number up in Firestore and sign in with the email behind it.
    const phoneE164 = normalizePhone(value);
    const snap = await getDocs(query(collection(db, "users"), where("phone", "==", phoneE164)));
    if (snap.empty) {
      throw new Error("No account matches that phone number.");
    }
    const match = snap.docs[0].data() as UserProfile;
    if (!match.email) {
      throw new Error("That account is missing an email. Please sign in with your email.");
    }
    return match.email;
  }, []);

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      const email = await resolveEmail(identifier);
      await signInWithEmailAndPassword(auth, email, password);
    },
    [resolveEmail],
  );

  const resetPassword = useCallback(async (identifier: string) => {
    const email = await resolveEmail(identifier);
    await sendPasswordResetEmail(auth, email);
  }, [resolveEmail]);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      await reload(auth.currentUser);
      await auth.currentUser.getIdToken(true);
      await loadProfile(auth.currentUser);
    }
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      initialising,
      isAdmin: profile?.role === "admin",
      signUp,
      sendVerificationEmail,
      signIn,
      signOut,
      resetPassword,
      refreshProfile,
    }),
    [user, profile, initialising, signUp, sendVerificationEmail, signIn, signOut, resetPassword, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
