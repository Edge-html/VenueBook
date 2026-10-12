"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
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
import type { Role, UserProfile } from "./types";

/** Emails allowed to self-provision as admins on first sign-in. */
const BOOTSTRAP_ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export interface SignUpInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  /** True until Firebase has resolved the session on first paint. */
  initialising: boolean;
  isAdmin: boolean;
  signUp: (input: SignUpInput) => Promise<void>;
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
    const bootstrapRole: Role = BOOTSTRAP_ADMIN_EMAILS.includes(email.toLowerCase())
      ? "admin"
      : "student";

    try {
      const snap = await getDoc(doc(db, "users", nextUser.uid));

      if (snap.exists()) {
        const data = snap.data() as Omit<UserProfile, "uid">;
        setProfile({ uid: nextUser.uid, ...data });
        return;
      }

      // First sign-in on an account with no profile document yet.
      const seed: UserProfile = {
        uid: nextUser.uid,
        fullName: nextUser.displayName ?? email.split("@")[0] ?? "Student",
        email,
        phone: "",
        role: bootstrapRole,
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
        fullName: nextUser.displayName ?? email.split("@")[0] ?? "Student",
        email,
        phone: "",
        role: bootstrapRole,
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

  const signUp = useCallback(async ({ fullName, phone, email, password }: SignUpInput) => {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const phoneE164 = normalizePhone(phone);

    // Phone is unique per person, so a duplicate is a real conflict worth
    // reporting rather than silently overwriting someone else's account.
    const existing = await getDocs(
      query(collection(db, "users"), where("phone", "==", phoneE164)),
    );
    if (!existing.empty) {
      await fbSignOut(auth);
      throw new Error("That phone number is already linked to an account.");
    }

    await updateProfile(credential.user, { displayName: fullName.trim() });
    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phoneE164,
      role: BOOTSTRAP_ADMIN_EMAILS.includes(email.trim().toLowerCase()) ? "admin" : "student",
      createdAt: serverTimestamp(),
    } satisfies Omit<UserProfile, "createdAt"> & { createdAt: unknown });
  }, []);

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
    if (auth.currentUser) await loadProfile(auth.currentUser);
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      initialising,
      isAdmin: profile?.role === "admin",
      signUp,
      signIn,
      signOut,
      resetPassword,
      refreshProfile,
    }),
    [user, profile, initialising, signUp, signIn, signOut, resetPassword, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}