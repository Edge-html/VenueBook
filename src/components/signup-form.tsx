"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { AuthLink, AuthShell, FormError } from "@/components/auth-shell";
import { useAuth } from "@/lib/auth-context";
import { friendlyAuthError } from "@/lib/auth-errors";
import { formatPhone, isValidMobilePhone, normalizePhone } from "@/lib/phone";
import { GRADES, SECTION_MAX_LENGTH } from "@/lib/constants";
import { validateIdPhoto } from "@/lib/data";

interface Errors {
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirm?: string;
  grade?: string;
  section?: string;
  idPhoto?: string;
}

export function SignUpForm() {
  return <SignUpFields />;
}

function SignUpFields() {
  const router = useRouter();
  const { signUp, user, initialising } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  /** Editing a field clears that field's previous error. */
  function edit<K extends keyof Errors>(
    field: K,
    setter: (value: string) => void,
  ): (value: string) => void {
    return (value: string) => {
      setter(value);
      setError(null);
      setFieldErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function validate(): Errors {
    const next: Errors = {};

    if (fullName.trim().length < 3) next.fullName = "Please enter your full name.";
    if (!isValidMobilePhone(phone)) next.phone = "Enter a valid 10-digit mobile number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (password.length < 8) next.password = "Use at least 8 characters.";
    if (confirm !== password) next.confirm = "Passwords do not match.";
    if (!grade) next.grade = "Choose your grade.";
    if (!section.trim()) next.section = "Enter your section.";
    if (!idPhoto) next.idPhoto = "Attach your school ID photo.";
    else next.idPhoto = validateIdPhoto(idPhoto) ?? undefined;

    return next;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      if (!idPhoto) return;
      await signUp({ fullName, phone, email, password, grade, section, idPhoto });
      router.replace("/verify-email");
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  if (initialising) return null;
  if (user && !busy) return <AuthShell title="Account created" subtitle="Verify your email and complete any missing profile details before booking." footer={null}><FormError message={error} /><div className="mt-4 flex flex-wrap gap-2"><Link href="/verify-email" className="btn btn-primary">Enter verification code</Link><Link href="/profile" className="btn btn-outline">Complete profile</Link></div></AuthShell>;

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes a minute, and it is all you need to reserve a venue."
      footer={
        <>
          Already registered? <AuthLink href="/signin">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <FormError message={error} />

        <Field
          id="fullName"
          label="Full name"
          value={fullName}
          onChange={edit("fullName", setFullName)}
          placeholder="Juan Dela Cruz"
          autoComplete="name"
          error={fieldErrors.fullName}
        />

        <Field
          id="phone"
          label="Phone number"
          value={phone}
          onChange={edit("phone", setPhone)}
          placeholder="0917 123 4567"
          inputMode="tel"
          autoComplete="tel"
          hint={
            phone && isValidMobilePhone(phone)
              ? `Saved as ${formatPhone(normalizePhone(phone))}`
              : undefined
          }
          error={fieldErrors.phone}
        />

        <Field
          id="email"
          label="Email address"
          type="email"
          value={email}
          onChange={edit("email", setEmail)}
          placeholder="you@knchs.edu.ph"
          autoComplete="email"
          error={fieldErrors.email}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="grade" className="field-label">Grade</label>
            <select id="grade" value={grade} onChange={(event) => setGrade(event.target.value)} className="field" aria-invalid={Boolean(fieldErrors.grade)}>
              <option value="">Select grade</option>
              {GRADES.map((value) => <option key={value} value={value}>Grade {value}</option>)}
            </select>
            <FieldError message={fieldErrors.grade} />
          </div>
          <Field id="section" label="Section" value={section} onChange={edit("section", setSection)} placeholder="e.g. STEM 1" error={fieldErrors.section} maxLength={SECTION_MAX_LENGTH} />
        </div>
        <div>
          <label htmlFor="registrationId" className="field-label">School ID photo</label>
          <input id="registrationId" type="file" accept="image/jpeg,image/png,image/webp" required className="field" onChange={(event) => setIdPhoto(event.target.files?.[0] ?? null)} aria-invalid={Boolean(fieldErrors.idPhoto)} />
          <FieldError message={fieldErrors.idPhoto} />
        </div>

        <div>
          <label htmlFor="password" className="field-label">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => edit("password", setPassword)(event.target.value)}
              placeholder="At least 8 characters"
              aria-invalid={Boolean(fieldErrors.password)}
              className="field pr-14"
            />
            <button
              type="button"
              onClick={() => setShowPassword((show) => !show)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 grid w-14 place-items-center text-ink-400 transition-colors hover:text-brand-700"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <FieldError message={fieldErrors.password} />
        </div>

        <Field
          id="confirm"
          label="Confirm password"
          type={showPassword ? "text" : "password"}
          value={confirm}
          onChange={edit("confirm", setConfirm)}
          placeholder="Repeat your password"
          autoComplete="new-password"
          error={fieldErrors.confirm}
        />

        <button type="submit" disabled={busy} className="btn btn-primary mt-1 w-full">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Creating account…" : "Create Account"}
        </button>

        <p className="text-center text-xs text-ink-500">
          Your details are used only to process venue reservations.
        </p>
      </form>
    </AuthShell>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  inputMode?: "text" | "tel" | "email";
  autoComplete?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="field"
        {...rest}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-2 text-xs text-ink-500">
          {hint}
        </p>
      )}
      <FieldError message={error} id={`${id}-error`} />
    </div>
  );
}

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;

  return (
    <p id={id} className="mt-2 text-xs font-medium text-booked">
      {message}
    </p>
  );
}
