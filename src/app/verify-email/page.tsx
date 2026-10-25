"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function VerifyEmailPage() {
  const { user, profile, initialising, refreshProfile } = useAuth();
  const router = useRouter();
  const sentOnce = useRef(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(action: "send" | "verify", value?: string) {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/email-otp", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, code: value }) });
      const result = await response.json() as { error?: string; verified?: boolean; sent?: boolean };
      if (!response.ok) throw new Error(result.error ?? "Verification failed. Try again.");
      if (action === "send") setSent(true);
      if (result.verified) { await refreshProfile(); router.replace("/"); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Verification failed."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!initialising && !user) { router.replace("/signin?next=/verify-email"); return; }
    if (profile?.emailOtpVerified) { router.replace("/"); return; }
    if (user && profile?.verificationRequired && !sentOnce.current) { sentOnce.current = true; void requestCode("send"); }
    // The automatic send is intentionally once per page visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, initialising, router]);

  if (initialising || !user) return null;
  return <main className="mx-auto max-w-md px-4 py-12"><section className="card p-6"><h1 className="page-title">Verify your email</h1><p className="page-lede mt-2">Enter the six-digit code sent to {user.email}. It expires after 10 minutes.</p>{sent && <p role="status" className="banner banner-notice mt-4">Code sent. Check your inbox and spam folder.</p>}{error && <p role="alert" className="banner banner-error mt-4">{error}</p>}<form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); void requestCode("verify", code); }}><label htmlFor="otp" className="field-label">Verification code</label><input id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="field text-center text-xl tracking-[0.35em]" /><button type="submit" disabled={busy || code.length !== 6} className="btn btn-primary w-full">Verify account</button></form><button type="button" disabled={busy} onClick={() => void requestCode("send")} className="link mt-4 text-sm">Send a new code</button></section></main>;
}
