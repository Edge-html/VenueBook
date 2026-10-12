"use client";

import { Check, Loader2, LogOut, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { FullPageLoader } from "@/components/auth-guard";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { formatPhone, isValidMobilePhone, normalizePhone } from "@/lib/phone";
import type { UserProfile } from "@/lib/types";

export function ProfileCard() {
  const { profile } = useAuth();

  // The form owns its field state, so remount it once per account instead of
  // syncing the loaded profile into state from an effect.
  if (!profile) return <FullPageLoader label="Loading your profile…" />;

  return <ProfileForm key={profile.uid} profile={profile} />;
}

function ProfileForm({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const { user, isAdmin, signOut, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    if (phone && !isValidMobilePhone(phone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      await setDoc(
        doc(db, "users", user.uid),
        { fullName: fullName.trim(), phone: normalizePhone(phone) },
        { merge: true },
      );

      await refreshProfile();
      setMessage("Profile updated.");
    } catch {
      setError("Could not save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  return (
    <div className="animate-fade-up mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold text-maroon-900">My Profile</h1>
        <p className="mt-1.5 text-neutral-600">
          Keep your details current so admins can reach you about a request.
        </p>
      </header>

      <div className="card p-6">
        <div className="mb-6 flex items-center gap-4 border-b border-cream-200 pb-5">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-maroon-700 font-display text-xl font-bold text-white">
            {(profile?.fullName ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-neutral-900">
              {profile?.fullName ?? "—"}
            </p>
            <span
              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                isAdmin ? "bg-gold-200 text-gold-600" : "bg-maroon-50 text-maroon-700"
              }`}
            >
              {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
              {isAdmin ? "Administrator" : "Student"}
            </span>
          </div>
        </div>

        <div className="mb-5 space-y-2">
          <p className="flex items-center gap-2 text-sm text-neutral-700">
            <Mail className="h-4 w-4 text-neutral-400" />
            {profile?.email ?? user?.email ?? "—"}
          </p>
          <p className="flex items-center gap-2 text-sm text-neutral-700">
            <Phone className="h-4 w-4 text-neutral-400" />
            {profile?.phone ? formatPhone(profile.phone) : "No phone number on file"}
          </p>
        </div>

        <form onSubmit={save} className="space-y-4">
          {error && (
            <p className="rounded-lg border border-booked/30 bg-booked-soft px-3 py-2.5 text-sm text-booked">
              {error}
            </p>
          )}
          {message && (
            <p className="flex items-center gap-1.5 rounded-lg border border-available/30 bg-available-soft px-3 py-2.5 text-sm text-available">
              <Check className="h-4 w-4" /> {message}
            </p>
          )}

          <div>
            <label htmlFor="profileName" className="field-label">
              Full name
            </label>
            <input
              id="profileName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="profilePhone" className="field-label">
              Phone number
            </label>
            <input
              id="profilePhone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+639171234567"
              className="field"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Stored in international format so you can sign in with it. Currently{" "}
              {phone ? formatPhone(phone) : "—"}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-cream-200 pt-4">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="btn btn-ghost text-booked hover:bg-booked-soft"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}