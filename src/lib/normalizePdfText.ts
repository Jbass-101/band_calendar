/**
 * jsPDF's built-in Helvetica only handles WinAnsi / Latin-1 reliably. Smart quotes,
 * primes, and other Unicode punctuation break `splitTextToSize` and `text()` —
 * often producing letter-by-letter spacing or wrong glyphs. Map to ASCII before PDF.
 */
export function normalizeTextForHelveticaPdf(input: string): string {
  let s = input;

  // Zero-width and BOM
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");

  // Apostrophe-like (incl. prime U+2032 often pasted as "apostrophe")
  s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u00B4\u0060\u02BC\u02BB]/g, "'");

  // Double quotes
  s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');

  // Dashes
  s = s.replace(/[\u2013\u2014\u2015]/g, "-");

  // Ellipsis
  s = s.replace(/\u2026/g, "...");

  // Misc spaces → regular space
  s = s.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ");

  // Compatibility normalization (does not remove accents; use after punctuation fix)
  s = s.normalize("NFKC");

  return s;
}
