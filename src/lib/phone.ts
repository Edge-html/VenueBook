/**
 * Philippine mobile numbers are the expected input here, so anything typed as
 * `09171234567`, `9171234567` or `+63 917 123 4567` collapses to the same
 * E.164 string we store in Firestore.
 */
export function normalizePhone(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("63")) return `+${digits}`;
  if (digits.startsWith("0")) return `+63${digits.slice(1)}`;

  // Bare 10-digit mobile number, e.g. 9171234567
  if (digits.length === 10 && digits.startsWith("9")) return `+63${digits}`;

  return `+${digits}`;
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Human-friendly rendering, e.g. `+639171234567` → `0917 123 4567`. */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    const local = `0${digits.slice(2)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return value;
}

/** A PH mobile is 10 digits and starts with 9. */
export function isValidMobilePhone(input: string): boolean {
  const digits = normalizePhone(input).replace(/\D/g, "");
  const local = digits.startsWith("63") ? digits.slice(2) : digits;
  return local.length === 10 && local.startsWith("9");
}