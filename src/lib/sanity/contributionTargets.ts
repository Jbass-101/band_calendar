export const DEFAULT_NON_COMMITTEE_TARGET = 100;
export const DEFAULT_COMMITTEE_TARGET = 250;

export type TargetHistoryRow = {
  /** Sanity array item key — required for Studio; optional in app logic. */
  _key?: string;
  effectiveFrom: string;
  nonCommitteeTarget: number;
  committeeTarget: number;
};

function randomSanityArrayKey(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `th_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Ensures every target history row has a unique `_key` for Sanity array fields.
 * Preserves existing keys when present.
 */
export function ensureTargetHistoryKeys(rows: TargetHistoryRow[]): TargetHistoryRow[] {
  return rows.map((row) => ({
    ...row,
    _key:
      typeof row._key === "string" && row._key.trim().length > 0 ? row._key : randomSanityArrayKey(),
  }));
}

export type ResolvedTargets = {
  nonCommitteeTarget: number;
  committeeTarget: number;
  effectiveFrom: string | null;
};

function compareMonthKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Pick the latest target row where effectiveFrom <= monthKey (YYYY-MM-01).
 */
export function resolveTargetsForMonth(
  monthKey: string,
  history: TargetHistoryRow[] | undefined | null,
  fallbackNon: number,
  fallbackCommittee: number
): ResolvedTargets {
  const non =
    typeof fallbackNon === "number" && !Number.isNaN(fallbackNon)
      ? fallbackNon
      : DEFAULT_NON_COMMITTEE_TARGET;
  const com =
    typeof fallbackCommittee === "number" && !Number.isNaN(fallbackCommittee)
      ? fallbackCommittee
      : DEFAULT_COMMITTEE_TARGET;

  const rows = Array.isArray(history)
    ? [...history].filter(
        (r) =>
          r &&
          typeof r.effectiveFrom === "string" &&
          typeof r.nonCommitteeTarget === "number" &&
          typeof r.committeeTarget === "number"
      )
    : [];

  if (rows.length === 0) {
    const useNon = non > 0 ? non : DEFAULT_NON_COMMITTEE_TARGET;
    const useCom = com > 0 ? com : DEFAULT_COMMITTEE_TARGET;
    return {
      nonCommitteeTarget: useNon,
      committeeTarget: useCom,
      effectiveFrom: null,
    };
  }

  rows.sort((x, y) => compareMonthKeys(x.effectiveFrom, y.effectiveFrom));
  let best: TargetHistoryRow | null = null;
  for (const row of rows) {
    if (compareMonthKeys(row.effectiveFrom, monthKey) <= 0) {
      best = row;
    } else {
      break;
    }
  }

  if (!best) {
    return {
      nonCommitteeTarget: non > 0 ? non : DEFAULT_NON_COMMITTEE_TARGET,
      committeeTarget: com > 0 ? com : DEFAULT_COMMITTEE_TARGET,
      effectiveFrom: null,
    };
  }

  return {
    nonCommitteeTarget: best.nonCommitteeTarget,
    committeeTarget: best.committeeTarget,
    effectiveFrom: best.effectiveFrom,
  };
}

export function currentMonthStartUtc(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}-01`;
}
