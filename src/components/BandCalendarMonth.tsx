"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";

type MusicianAssignment = { role: string; musicianName: string | null };
type Service = {
  date: string; // "YYYY-MM-DD"
  title: string;
  assignments: MusicianAssignment[];
};

const ROLE_ORDER = [
  "Lead Vocal",
  "Lead Keyboard",
  "Aux Keyboard",
  "Lead Guitar",
  "Bass Guitar",
  "Drummer",
  "MD",
] as const;

const ROLE_BADGE_CLASS: Record<(typeof ROLE_ORDER)[number], string> = {
  "Lead Vocal":
    "bg-rose-100 text-rose-800 dark:bg-rose-900/35 dark:text-rose-200",
  "Lead Keyboard":
    "bg-violet-100 text-violet-800 dark:bg-violet-900/35 dark:text-violet-200",
  "Aux Keyboard":
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/35 dark:text-indigo-200",
  "Lead Guitar":
    "bg-sky-100 text-sky-800 dark:bg-sky-900/35 dark:text-sky-200",
  "Bass Guitar":
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/35 dark:text-cyan-200",
  Drummer:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-200",
  MD: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200",
};

const ROLE_BADGE_EXPORT_CLASS: Record<(typeof ROLE_ORDER)[number], string> = {
  "Lead Vocal": "bg-rose-100 text-rose-900",
  "Lead Keyboard": "bg-violet-100 text-violet-900",
  "Aux Keyboard": "bg-indigo-100 text-indigo-900",
  "Lead Guitar": "bg-sky-100 text-sky-900",
  "Bass Guitar": "bg-cyan-100 text-cyan-900",
  Drummer: "bg-amber-100 text-amber-900",
  MD: "bg-emerald-100 text-emerald-900",
};

function formatYMDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMDLocal(ymd: string) {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatWeekdayShort(d: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d);
}

function formatMonthLabel(d: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(d);
}

function addMonths(d: Date, delta: number) {
  const next = new Date(d.getTime());
  next.setMonth(next.getMonth() + delta);
  return next;
}

export default function BandCalendarMonth() {
  const [cursorMonth, setCursorMonth] = useState(() => new Date());
  const [services, setServices] = useState<Service[]>([]);
  const [rehearsalDates, setRehearsalDates] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  const todayKey = useMemo(() => formatYMDLocal(new Date()), []);
  const todayMonthStart = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  }, []);
  const maxMonthStart = useMemo(() => addMonths(todayMonthStart, 1), [todayMonthStart]);
  const cursorMonthStart = useMemo(
    () => new Date(cursorMonth.getFullYear(), cursorMonth.getMonth(), 1),
    [cursorMonth]
  );
  const canGoNext = cursorMonthStart < maxMonthStart;
  const skeletonCards = Array.from({ length: 8 });
  const baseButtonClass =
    "inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-black";

  useEffect(() => {
    const year = cursorMonth.getFullYear();
    const month = cursorMonth.getMonth();

    const fromDate = new Date(year, month, 1);
    const toDate = new Date(year, month + 1, 0);

    const from = formatYMDLocal(fromDate);
    const to = formatYMDLocal(toDate);

    let cancelled = false;

    const fetchJSON = async <T,>(url: string): Promise<T> => {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.error ? String(body.error) : `Request failed (${res.status})`;
        throw new Error(msg);
      }
      return (await res.json()) as T;
    };

    Promise.all([
      fetchJSON<Service[]>(
        `/api/services?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      ),
      fetchJSON<string[]>(`/api/rehearsals?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    ])
      .then(([serviceData, rehearsalData]) => {
        if (cancelled) return;
        setServices(serviceData);
        setRehearsalDates(new Set(rehearsalData));
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setServices([]);
        setRehearsalDates(new Set());
        setError(e instanceof Error ? e.message : "Failed to load calendar data");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cursorMonth]);

  const serviceByDate = useMemo(() => {
    return new Map<string, Service>(services.map((s) => [s.date, s]));
  }, [services]);

  const monthYearLabel = formatMonthLabel(cursorMonth);

  const grid = useMemo(() => {
    const year = cursorMonth.getFullYear();
    const month = cursorMonth.getMonth();

    const firstOfMonth = new Date(year, month, 1);
    const firstWeekday = firstOfMonth.getDay(); // 0=Sun
    const gridStart = new Date(year, month, 1 - firstWeekday);

    const cells: { date: Date; inMonth: boolean; key: string }[] = [];
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(gridStart.getTime());
      cellDate.setDate(gridStart.getDate() + i);
      const inMonth = cellDate.getMonth() === month;
      cells.push({
        date: cellDate,
        inMonth,
        key: formatYMDLocal(cellDate),
      });
    }

    return cells;
  }, [cursorMonth]);

  const eventDateKeys = useMemo(() => {
    const keys: string[] = [];
    for (const cell of grid) {
      if (!cell.inMonth) continue;
      if (serviceByDate.has(cell.key) || rehearsalDates.has(cell.key)) {
        keys.push(cell.key);
      }
    }
    // YYYY-MM-DD string sort is chronological.
    return keys.sort();
  }, [grid, serviceByDate, rehearsalDates]);

  const handleDownloadPng = async () => {
    try {
      setError(null);
      setExportMode(true);

      // Give the browser a moment to render the offscreen export container.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await new Promise((resolve) => setTimeout(resolve, 50));

      const node = exportRef.current;
      if (!node) return;

      const dataUrl = await toPng(node, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });

      const y = cursorMonth.getFullYear();
      const m = String(cursorMonth.getMonth() + 1).padStart(2, "0");
      const filename = `last-harvest-band-calendar-${y}-${m}.png`;

      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export PNG");
    } finally {
      setExportMode(false);
    }
  };

  return (
    <section className="w-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/40 shadow-sm backdrop-blur-sm p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Schedule month
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {monthYearLabel}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            aria-label="Go to previous month"
            onClick={() => {
              setError(null);
              setLoading(true);
              setCursorMonth((d) => addMonths(d, -1));
            }}
            className={[
              baseButtonClass,
              "border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/70 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800",
            ].join(" ")}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!canGoNext}
            aria-label="Go to next month"
            onClick={() => {
              if (!canGoNext) return;
              setError(null);
              setLoading(true);
              setCursorMonth((d) => addMonths(d, 1));
            }}
            className={[
              baseButtonClass,
              "border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/70 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800",
              !canGoNext ? "opacity-50 cursor-not-allowed hover:bg-transparent" : "",
            ].join(" ")}
          >
            Next
          </button>

          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={loading || eventDateKeys.length === 0}
            aria-label="Download month schedule as PNG"
            className={[
              baseButtonClass,
              "border-emerald-300 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/35",
              (loading || eventDateKeys.length === 0)
                ? "opacity-50 cursor-not-allowed hover:bg-transparent"
                : "",
            ].join(" ")}
          >
            Download PNG
          </button>
        </div>
      </div>

      {loading ? (
        <div aria-live="polite" className="space-y-3">
          <div className="h-4 w-40 rounded bg-zinc-200/80 dark:bg-zinc-800/80 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pb-1">
            {skeletonCards.map((_, idx) => (
              <div
                key={`skeleton-${idx}`}
                className="min-h-28 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/40 p-3 animate-pulse"
              >
                <div className="h-4 w-10 rounded bg-zinc-200 dark:bg-zinc-700 mb-2" />
                <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-700 mb-3" />
                <div className="space-y-1.5">
                  <div className="h-2.5 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-2.5 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-2.5 w-4/6 rounded bg-zinc-200 dark:bg-zinc-700" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          <span className="font-semibold">Couldn&apos;t load calendar.</span> {error}
        </div>
      ) : eventDateKeys.length === 0 ? (
        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/40 px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">
          No services or rehearsals found for this month.
        </div>
      ) : null}

      {/* Event cards grid (desktop + mobile) */}
      <div className="overflow-y-auto max-h-[85vh] pr-1 sm:max-h-none sm:overflow-visible">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pb-1">
          {eventDateKeys.map((key) => {
            const svc = serviceByDate.get(key);
            const date = parseYMDLocal(key);
            if (!date) return null;

            const isRehearsal = rehearsalDates.has(key);
            const isOverlap = Boolean(svc) && isRehearsal;
            const isPast = key < todayKey;

            return (
              <div
                key={key}
                className={[
                  "min-h-28 rounded-xl border p-2.5 relative overflow-hidden shadow-sm transition-all duration-200",
                  "hover:-translate-y-0.5 hover:shadow-md",
                  isPast
                    ? "border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-black/30 opacity-70"
                    : "border-zinc-200/90 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-900/50",
                ].join(" ")}
              >
                {isOverlap ? (
                  <div className="absolute bottom-0 right-0 p-1 pointer-events-none z-10">
                    <div className="text-[10px] font-bold whitespace-nowrap border border-orange-500 bg-orange-500 text-white rounded-tl-sm px-2 py-0.5">
                      R
                    </div>
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-2">
                  <div className="text-base font-semibold">{date.getDate()}</div>
                  <div className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
                    {formatWeekdayShort(date)}
                  </div>
                </div>

                {svc ? (
                  <div className="mt-2">
                    <div className="text-xs font-semibold tracking-tight truncate text-zinc-900 dark:text-zinc-100">
                      {svc.title}
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {ROLE_ORDER.map((role) => {
                        const assignment = svc.assignments.find((a) => a.role === role);
                        const name = assignment?.musicianName ?? null;

                        return (
                          <div key={role} className="flex items-center gap-2.5">
                            <span
                              className={[
                                "text-[11px] font-semibold whitespace-nowrap px-1.5 py-0.5 rounded-md inline-flex w-[7.5rem] justify-start",
                                ROLE_BADGE_CLASS[role],
                              ].join(" ")}
                            >
                              {role} :
                            </span>
                            <span className="text-[11px] text-zinc-800 dark:text-zinc-100 truncate">
                              {name ?? "—"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {!svc && isRehearsal ? (
                  <div className="mt-2 w-full text-center text-[10px] font-semibold whitespace-nowrap border border-orange-500 bg-orange-500 text-white rounded-sm py-1">
                    Rehearsal
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Offscreen export container (single column, light styling) */}
      {exportMode ? (
        <div className="fixed top-0 left-[-100000px] pointer-events-none">
          <div
            ref={exportRef}
            className="w-full bg-white text-zinc-900 p-6"
            style={{ maxWidth: 900 }}
          >
            <div className="text-2xl font-bold mb-4">{monthYearLabel}</div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pb-1">
              {eventDateKeys.map((key) => {
                const svc = serviceByDate.get(key);
                const date = parseYMDLocal(key);
                if (!date) return null;

                const isRehearsal = rehearsalDates.has(key);
                const isOverlap = Boolean(svc) && isRehearsal;
                const isPast = key < todayKey;

                return (
                  <div
                    key={key}
                    className={[
                      "min-h-28 rounded-md border p-3 relative overflow-hidden",
                      isPast
                        ? "border-zinc-200 bg-zinc-50 opacity-70"
                        : "border-zinc-200 bg-white",
                    ].join(" ")}
                  >
                    {isOverlap ? (
                      <div className="absolute bottom-0 right-0 p-1 pointer-events-none z-10">
                        <div className="text-[10px] font-bold whitespace-nowrap border border-orange-500 bg-orange-500 text-white rounded-tl-sm px-2 py-0.5">
                          R
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-start justify-between gap-2">
                      <div className="text-base font-semibold">
                        {date.getDate()}
                      </div>
                      {svc ? (
                        <div className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                          {formatWeekdayShort(date)}
                        </div>
                      ) : null}
                    </div>

                    {svc ? (
                      <div className="mt-2">
                        <div className="text-xs font-semibold truncate">{svc.title}</div>
                        <div className="mt-2 space-y-1">
                          {ROLE_ORDER.map((role) => {
                            const assignment = svc.assignments.find((a) => a.role === role);
                            const name = assignment?.musicianName ?? null;

                            return (
                              <div key={role} className="flex items-center gap-2.5">
                                <span
                                  className={[
                                    "text-[11px] font-semibold whitespace-nowrap px-1.5 py-0.5 rounded-md inline-flex w-[7.5rem] justify-start",
                                    ROLE_BADGE_EXPORT_CLASS[role],
                                  ].join(" ")}
                                >
                                  {role} :
                                </span>
                                <span className="text-[11px] text-zinc-700 truncate">
                                  {name ?? "—"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {!svc && isRehearsal ? (
                      <div className="absolute bottom-0 left-0 right-0 p-1 pointer-events-none">
                        <div className="w-full text-center text-[10px] font-semibold whitespace-nowrap border border-orange-500 bg-orange-500 text-white rounded-sm py-1">
                          Rehearsal
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

