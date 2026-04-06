/**
 * Normalize user input for storage: digits only, optional SA local (0…) → 27….
 * Returns null when empty or invalid length.
 */
export function normalizeWhatsappForStorage(input: string | null | undefined): string | null {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return null;

  if (digits.length === 10 && digits.startsWith("0")) {
    digits = `27${digits.slice(1)}`;
  }

  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** Digits only for https://wa.me/<digits> (no leading +). */
export function whatsappDigitsForWaMe(stored: string | null | undefined): string | null {
  if (stored == null || stored === "") return null;
  const digits = String(stored).replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}
