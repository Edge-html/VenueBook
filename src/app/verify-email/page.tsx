"use client";

import { applyActionCode } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";

export default function VerifyEmailPage() {
  const { user, profile, initialising, refreshProfile, sendVerificationEmail } = useAuth();
  const router = useRouter();
  const [actionCode] = useState(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("oobCode"),
  );
  const [returnedFromVerification] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("verified") === "1",
  );
  const processedCode = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkVerification = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await refreshProfile();
      if (!auth.currentUser?.emailVerified) {
        setError("Your email is not verified yet. Open the link from your inbox, then check again.");
        return;
      }
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not check your email status. Try again.");
    } finally {
      setBusy(false);
    }
  }, [refreshProfile, router]);

  useEffect(() => {
    if (!initialising && !user) router.replace("/signin?next=/verify-email");
  }, [initialising, user, router]);

  useEffect(() => {
    if (!user || !actionCode || processedCode.current === actionCode) return;
    processedCode.current = actionCode;
    setBusy(true);
    setError(null);
    void applyActionCode(auth, actionCode)
      .then(checkVerification)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "This verification link is invalid or has expired.");
      })
      .finally(() => setBusy(false));
  }, [user, actionCode, checkVerification]);

  useEffect(() => {
    if (user && returnedFromVerification && !actionCode) {
      void Promise.resolve().then(checkVerification);
    }
  }, [user, returnedFromVerification, actionCode, checkVerification]);

  useEffect(() => {
    if (user && profile?.emailOtpVerified) {
      router.replace("/");
    }
  }, [user, profile?.emailOtpVerified, router]);

  if (initialising || !user) return null;

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <section className="card p-6">
        <h1 className="page-title">Verify your email</h1>
        <p className="page-lede mt-2">
          We sent a verification link to <strong>{user.email}</strong>. Open it from your inbox to activate your account.
        </p>
        {sent && <p role="status" className="banner banner-notice mt-4">Verification link sent. Check your inbox and spam folder.</p>}
        {error && <p role="alert" className="banner banner-error mt-4">{error}</p>}
        <div className="mt-5 flex flex-col gap-3">
          <button type="button" disabled={busy} onClick={() => void checkVerification()} className="btn btn-primary w-full">
            {busy ? "Checking…" : "I verified my email"}
          </button>
          <button type="button" disabled={busy} onClick={() => {
            setBusy(true);
            setError(null);
            void sendVerificationEmail()
              .then(() => setSent(true))
              .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not send the verification link."))
              .finally(() => setBusy(false));
          }} className="link text-sm">
            Send a new verification link
          </button>
        </div>
      </section>
    </main>
  );
}
