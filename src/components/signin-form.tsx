"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthLink, AuthShell, FormError } from "@/components/auth-shell";
import { RedirectIfAuthed } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth-context";
import { friendlyAuthError } from "@/lib/auth-errors";

export function SignInForm() {
  return (
    <RedirectIfAuthed>
      <SignInFields />
    </RedirectIfAuthed>
  );
}

function SignInFields() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, resetPassword } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  const next = searchParams.get("next");
  const destination = next?.startsWith("/") && next !== "/dashboard" ? next : "/";

  /** Typing again should clear whatever the last attempt said. */
  function edit(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setError(null);
      setNotice(null);
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await signIn(identifier, password);
      router.replace(destination);
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!identifier.trim()) {
      setError("Enter your email or phone number first.");
      return;
    }

    setResetting(true);
    setError(null);
    setNotice(null);

    try {
      await resetPassword(identifier);
      setNotice(`Password reset link sent. Check the inbox for ${identifier.trim()}.`);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setResetting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your email address or your phone number."
      footer={
        <>
          Don&rsquo;t have an account yet? <AuthLink href="/signup">Create one</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError message={error} />

        {notice && (
          <p className="rounded-lg border border-available/30 bg-available-soft px-3 py-2.5 text-sm font-medium text-available">
            {notice}
          </p>
        )}

        <div>
          <label htmlFor="identifier" className="field-label">
            Email or phone number
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            inputMode="email"
            required
            value={identifier}
            onChange={(event) => edit(setIdentifier)(event.target.value)}
            placeholder="you@knchs.edu.ph or 0917 123 4567"
            className="field"
          />
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting || busy}
              className="text-xs font-semibold text-maroon-700 hover:underline disabled:opacity-50"
            >
              {resetting ? "Sending…" : "Forgot password?"}
            </button>
          </div>

          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => edit(setPassword)(event.target.value)}
              placeholder="••••••••"
              className="field pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((show) => !show)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-neutral-500 hover:text-maroon-700"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </AuthShell>
  );
}