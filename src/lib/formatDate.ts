/**
 * Format a YYYY-MM-DD (or ISO date prefix) string as dd/mm/yyyy for display.
 */
export function formatIsoDateToDDMMYYYY(iso: string | null | undefined): string {
  if (!iso || typeof iso !== "string") return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

/**
 * `YYYY-MM` (month picker value) → first day of month as dd/mm/yyyy.
 */
export function formatYearMonthToDDMMYYYY(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  return formatIsoDateToDDMMYYYY(`${ym}-01`);
}
