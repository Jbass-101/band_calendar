const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDDMMMYYYY(date: Date): string {
  const dd = `${date.getDate()}`.padStart(2, "0");
  const mmm = MONTH_SHORT[date.getMonth()] ?? "";
  const yyyy = date.getFullYear();
  return `${dd}-${mmm}-${yyyy}`;
}

/**
 * Format a YYYY-MM-DD (or ISO date prefix) string as DD-MMM-YYYY for display.
 */
export function formatIsoDateToDDMMYYYY(iso: string | null | undefined): string {
  if (!iso || typeof iso !== "string") return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return "";
  const [, y, mo, d] = m;
  const parsed = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(parsed.getTime())) return "";
  return formatDDMMMYYYY(parsed);
}

/**
 * `YYYY-MM` (month picker value) -> first day of month as DD-MMM-YYYY.
 */
export function formatYearMonthToDDMMYYYY(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  return formatIsoDateToDDMMYYYY(`${ym}-01`);
}

/**
 * Format an ISO datetime string for display as DD-MMM-YYYY HH:mm (local).
 */
export function formatIsoDateTimeToDisplay(iso: string | null | undefined): string {
  if (!iso || typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = `${d.getHours()}`.padStart(2, "0");
  const min = `${d.getMinutes()}`.padStart(2, "0");
  return `${formatDDMMMYYYY(d)} ${hh}:${min}`;
}
