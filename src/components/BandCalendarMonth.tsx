"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { downloadDomAsPdf } from "@/src/lib/exportDomToPdf";
import {
  Drum,
  Guitar,
  Mars,
  Mic,
  Piano,
  Shirt,
  Venus,
  type LucideIcon,
} from "lucide-react";
import type { Service } from "@/src/lib/sanity/client";

const ROLE_ORDER = [
  "Lead Vocal",
  "Lead Keyboard",
  "Aux Keyboard",
  "Lead Guitar",
  "Bass Guitar",
  "Drummer",
  "MD",
] as const;

type UniformTab = "women" | "men";

/** Mobile: one line — musician name, or role label if unassigned; same colour family as the role */
const ROLE_MOBILE_LINE_CLASS: Record<(typeof ROLE_ORDER)[number], string> = {
  "Lead Vocal": "text-rose-700 dark:text-rose-200",
  "Lead Keyboard": "text-violet-700 dark:text-violet-200",
  "Aux Keyboard": "text-indigo-700 dark:text-indigo-200",
  "Lead Guitar": "text-sky-700 dark:text-sky-200",
  "Bass Guitar": "text-cyan-700 dark:text-cyan-200",
  Drummer: "text-amber-700 dark:text-amber-200",
  MD: "text-emerald-700 dark:text-emerald-200",
};

/** Export-only: strong contrast colors on white background */
const ROLE_EXPORT_LINE_CLASS: Record<(typeof ROLE_ORDER)[number], string> = {
  "Lead Vocal": "text-rose-900",
  "Lead Keyboard": "text-violet-900",
  "Aux Keyboard": "text-indigo-900",
  "Lead Guitar": "text-sky-900",
  "Bass Guitar": "text-cyan-900",
  Drummer: "text-amber-900",
  MD: "text-emerald-900",
};

const ROLE_MOBILE_ICON: Record<(typeof ROLE_ORDER)[number], LucideIcon> = {
  "Lead Vocal": Mic,
  "Lead Keyboard": Piano,
  "Aux Keyboard": Piano,
  "Lead Guitar": Guitar,
  "Bass Guitar": Guitar,
  Drummer: Drum,
  MD: Mic,
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

function getSundayWeekBucket(d: Date): number | null {
  // Sunday is 0 in JS Date#getDay()
  if (d.getDay() !== 0) return null;
  return Math.floor((d.getDate() - 1) / 7) + 1;
}

function formatServiceTitleForDate(date: Date, title: string): string {
  const sundayBucket = getSundayWeekBucket(date);
  if (!sundayBucket) return title;
  return `Week ${sundayBucket} : ${title}`;
}

function formatExportGeneratedAt(d: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export default function BandCalendarMonth() {
  const [cursorMonth, setCursorMonth] = useState(() => new Date());
  const [services, setServices] = useState<Service[]>([]);
  const [rehearsalDates, setRehearsalDates] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState(false);
  const [exportGeneratedAt, setExportGeneratedAt] = useState<Date | null>(null);
  const [uniformTab, setUniformTab] = useState<UniformTab>("women");
  const exportRef = useRef<HTMLDivElement | null>(null);

  const todayKey = useMemo(() => formatYMDLocal(new Date()), []);
  const todayMonthStart = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  }, []);
  const maxMonthStart = useMemo(() => addMonths(todayMonthStart, 2), [todayMonthStart]);
  const cursorMonthStart = useMemo(
    () => new Date(cursorMonth.getFullYear(), cursorMonth.getMonth(), 1),
    [cursorMonth]
  );
  const canGoNext = cursorMonthStart < maxMonthStart;
  const skeletonCards = Array.from({ length: 8 });
  const baseButtonClass =
    "inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-black";
  const tabButtonBase =
    "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-50 dark:focus-visible:ring-offset-black";
  const tabButtonActive =
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200";
  const tabButtonInactive =
    "border-zinc-200 bg-white/70 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-200 dark:hover:bg-zinc-800/60";

  useEffect(() => {
    const year = cursorMonth.getFullYear();
    const month = cursorMonth.getMonth();

    const fromDate = new Date(year, month, 1);
    const toDate = new Date(year, month + 1, 0);
    const servicesToDate = new Date(toDate.getTime());
    // Include a small spillover so Wednesday rehearsals at month-end can list services through Sunday.
    servicesToDate.setDate(servicesToDate.getDate() + 6);

    const from = formatYMDLocal(fromDate);
    const to = formatYMDLocal(toDate);
    const servicesTo = formatYMDLocal(servicesToDate);

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
        `/api/services?from=${encodeURIComponent(from)}&to=${encodeURIComponent(servicesTo)}`
      ),
      fetchJSON<string[]>(`/api/rehearsals?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
    ])
      .then(([serviceData, rehearsalData]) => {
        if (cancelled) return;
        setServices(serviceData);
        setRehearsalDates(new Set(rehearsalData));
        setLoadError(null);
        setExportError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setServices([]);
        setRehearsalDates(new Set());
        setLoadError(e instanceof Error ? e.message : "Failed to load calendar data");
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

  const handleDownloadPdf = async () => {
    try {
      setExportError(null);
      setExportGeneratedAt(new Date());
      setExportMode(true);

      // Give the browser a moment to render the offscreen export container.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await new Promise((resolve) => setTimeout(resolve, 50));

      const node = exportRef.current;
      if (!node) return;

      const y = cursorMonth.getFullYear();
      const m = String(cursorMonth.getMonth() + 1).padStart(2, "0");
      const filename = `last-harvest-band-calendar-${y}-${m}.pdf`;

      await downloadDomAsPdf(node, {
        filename,
        scale: 2,
        backgroundColor: "#ffffff",
      });
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Failed to export PDF");
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
              setLoadError(null);
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
              setLoadError(null);
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
            onClick={handleDownloadPdf}
            disabled={loading || eventDateKeys.length === 0}
            aria-label="Download month schedule as PDF"
            className={[
              baseButtonClass,
              "border-emerald-300 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/35",
              (loading || eventDateKeys.length === 0)
                ? "opacity-50 cursor-not-allowed hover:bg-transparent"
                : "",
            ].join(" ")}
          >
            Download PDF
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
      ) : loadError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          <span className="font-semibold">Couldn&apos;t load calendar.</span> {loadError}
        </div>
      ) : eventDateKeys.length === 0 ? (
        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/40 px-4 py-4 text-sm text-zinc-600 dark:text-zinc-300">
          No services or rehearsals found for this month.
        </div>
      ) : null}

      {exportError ? (
        <div
          role="alert"
          className="mb-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/25 px-4 py-2.5 text-sm text-amber-900 dark:text-amber-200"
        >
          <span className="font-semibold">Couldn&apos;t export PDF.</span> {exportError}
        </div>
      ) : null}

      {!loading && !loadError && eventDateKeys.length !== 0 ? (
        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
            Uniform
          </div>
          <div
            role="tablist"
            aria-label="Uniform selection"
            className="flex items-center gap-2 flex-wrap"
          >
            <button
              type="button"
              role="tab"
              aria-selected={uniformTab === "women"}
              onClick={() => setUniformTab("women")}
              className={[
                tabButtonBase,
                uniformTab === "women" ? tabButtonActive : tabButtonInactive,
              ].join(" ")}
            >
              <Venus className="h-4 w-4 shrink-0" aria-hidden />
              Women
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={uniformTab === "men"}
              onClick={() => setUniformTab("men")}
              className={[
                tabButtonBase,
                uniformTab === "men" ? tabButtonActive : tabButtonInactive,
              ].join(" ")}
            >
              <Mars className="h-4 w-4 shrink-0" aria-hidden />
              Men
            </button>
          </div>
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
            const isWednesdayRehearsal = isRehearsal && date.getDay() === 3;
            const rehearsalServiceLines = isWednesdayRehearsal
              ? (() => {
                  const sunday = new Date(date.getTime());
                  sunday.setDate(sunday.getDate() + (7 - sunday.getDay()));
                  const sundayKey = formatYMDLocal(sunday);
                  return services
                    .filter((s) => s.date >= key && s.date <= sundayKey)
                    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
                    .map((s) => {
                      const serviceDate = parseYMDLocal(s.date);
                      return serviceDate ? formatServiceTitleForDate(serviceDate, s.title) : s.title;
                    });
                })()
              : [];

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
                      {formatServiceTitleForDate(date, svc.title)}
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {ROLE_ORDER.map((role) => {
                        const assignment = svc.assignments.find((a) => a.role === role);
                        const names = Array.isArray(assignment?.musicianNames)
                          ? assignment.musicianNames.filter((n) => typeof n === "string" && n.trim().length > 0)
                          : [];
                        const displayNames = names.join(" | ");
                        const hasName = displayNames.length > 0;
                        const lineClass = ROLE_MOBILE_LINE_CLASS[role];
                        const RoleIcon = ROLE_MOBILE_ICON[role];

                        return (
                          <div key={role} className="min-w-0">
                            <div className="inline-flex min-w-0 items-center gap-1.5">
                              <RoleIcon className={["h-3.5 w-3.5 shrink-0", lineClass].join(" ")} aria-hidden />
                              <span className={["text-[11px] font-medium shrink-0", lineClass].join(" ")}>:</span>
                              <span
                                className={[
                                  "text-[11px] truncate block min-w-0",
                                  lineClass,
                                  !hasName ? "font-semibold" : "",
                                ].join(" ")}
                              >
                                  {hasName ? displayNames : "—"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-2 border-t border-zinc-200/80 dark:border-zinc-800/80 pt-2">
                      {svc.uniformWomen && svc.uniformMen ? (
                        <div className="space-y-1">
                          <div className="inline-flex min-w-0 items-center gap-1.5">
                            <Venus className="h-3.5 w-3.5 shrink-0 text-zinc-600 dark:text-zinc-300" aria-hidden />
                            <span className="text-[11px] font-medium shrink-0 text-zinc-600 dark:text-zinc-300">:</span>
                            <span className="text-[11px] truncate block min-w-0 text-zinc-700 dark:text-zinc-200">
                              {svc.uniformWomen}
                            </span>
                          </div>
                          <div className="inline-flex min-w-0 items-center gap-1.5">
                            <Mars className="h-3.5 w-3.5 shrink-0 text-zinc-600 dark:text-zinc-300" aria-hidden />
                            <span className="text-[11px] font-medium shrink-0 text-zinc-600 dark:text-zinc-300">:</span>
                            <span className="text-[11px] truncate block min-w-0 text-zinc-700 dark:text-zinc-200">
                              {svc.uniformMen}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="inline-flex min-w-0 items-center gap-1.5">
                          <Shirt className="h-3.5 w-3.5 shrink-0 text-zinc-600 dark:text-zinc-300" aria-hidden />
                          <span className="text-[11px] font-medium shrink-0 text-zinc-600 dark:text-zinc-300">:</span>
                          <span className="text-[11px] truncate block min-w-0 text-zinc-700 dark:text-zinc-200">
                            {svc.uniform}
                          </span>
                        </div>
                      )}
                    </div>
                    {isOverlap ? <div className="h-6 shrink-0" aria-hidden /> : null}
                  </div>
                ) : null}

                {!svc && isRehearsal ? (
                  <div className="mt-2 space-y-1 rounded-sm border border-orange-500 bg-orange-500/95 px-2 py-1 text-white">
                    <div className="w-full text-center text-[10px] font-semibold">Rehearsal</div>
                    {rehearsalServiceLines.map((line, idx) => (
                      <div key={`${key}-rehearsal-service-${idx}`} className="text-[10px] font-semibold leading-snug">
                        {line}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Offscreen export container (single column, light styling) */}
      {exportMode ? (
        <div className="fixed top-0 left-[-10000px] pointer-events-none w-[900px]">
          <div
            ref={exportRef}
            className="w-full bg-white text-zinc-900 p-6"
            style={{ width: 900 }}
          >
            <header className="mb-5 flex flex-nowrap items-start gap-4 border-b border-zinc-200 pb-5">
              <div className="shrink-0">
                <Image
                  src="/logo.png"
                  alt=""
                  width={160}
                  height={160}
                  className="h-24 w-24 object-contain select-none"
                  unoptimized
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-left text-2xl font-semibold tracking-tight text-zinc-900">
                  Last Harvest Instrumentalists
                </h1>
                <p className="mt-1 text-left text-sm text-zinc-600">
                  Monthly schedule for services and rehearsals
                </p>
              </div>
            </header>

            <div className="mb-3">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">Schedule month</div>
              <div className="text-2xl font-semibold tracking-tight text-zinc-900">{monthYearLabel}</div>
            </div>

            <div
              className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5"
              aria-label="Uniform symbol legend"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                Uniform legend
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-zinc-800">
                <span className="inline-flex items-center gap-1.5">
                  <Venus className="h-4 w-4 shrink-0 text-zinc-700" aria-hidden />
                  <span>Women uniform</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mars className="h-4 w-4 shrink-0 text-zinc-700" aria-hidden />
                  <span>Men uniform</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-zinc-600">
                  <Shirt className="h-4 w-4 shrink-0" aria-hidden />
                  <span>Single dress code (when not split)</span>
                </span>
              </div>
            </div>

            {/* Fixed 3-column print layout — narrower cards than 2-up; no viewport breakpoints. */}
            <div className="grid grid-cols-3 gap-2 pb-1">
              {eventDateKeys.map((key) => {
                const svc = serviceByDate.get(key);
                const date = parseYMDLocal(key);
                if (!date) return null;

                const isRehearsal = rehearsalDates.has(key);
                const isOverlap = Boolean(svc) && isRehearsal;
                const isPast = key < todayKey;
                const isWednesdayRehearsal = isRehearsal && date.getDay() === 3;
                const rehearsalServiceLines = isWednesdayRehearsal
                  ? (() => {
                      const sunday = new Date(date.getTime());
                      sunday.setDate(sunday.getDate() + (7 - sunday.getDay()));
                      const sundayKey = formatYMDLocal(sunday);
                      return services
                        .filter((s) => s.date >= key && s.date <= sundayKey)
                        .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
                        .map((s) => {
                          const serviceDate = parseYMDLocal(s.date);
                          return serviceDate ? formatServiceTitleForDate(serviceDate, s.title) : s.title;
                        });
                    })()
                  : [];

                return (
                  <div
                    key={key}
                    className={[
                      "min-h-28 rounded-md border p-3 relative overflow-visible min-w-0",
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
                      <div className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                        {formatWeekdayShort(date)}
                      </div>
                    </div>

                    {svc ? (
                      <div className="mt-2">
                        <div className="text-xs font-semibold break-words leading-snug">
                          {formatServiceTitleForDate(date, svc.title)}
                        </div>
                        <div className="mt-2 space-y-1">
                          {ROLE_ORDER.map((role) => {
                            const assignment = svc.assignments.find((a) => a.role === role);
                            const names = Array.isArray(assignment?.musicianNames)
                              ? assignment.musicianNames.filter(
                                  (n) => typeof n === "string" && n.trim().length > 0
                                )
                              : [];
                            const displayNames = names.join(" | ");
                            const hasName = displayNames.length > 0;
                            const lineClass = ROLE_EXPORT_LINE_CLASS[role];
                            const RoleIcon = ROLE_MOBILE_ICON[role];

                            return (
                              <div key={role} className="flex w-full min-w-0 items-start gap-1.5">
                                <RoleIcon className={["h-3.5 w-3.5 shrink-0 mt-0.5", lineClass].join(" ")} aria-hidden />
                                <span className={["text-[11px] font-semibold shrink-0 pt-0.5", lineClass].join(" ")}>:</span>
                                <span
                                  className={[
                                    "text-[11px] min-w-0 flex-1 break-words leading-snug",
                                    lineClass,
                                    !hasName ? "font-semibold" : "",
                                  ].join(" ")}
                                >
                                  {hasName ? displayNames : "—"}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-2 border-t border-zinc-200 pt-2">
                          {svc.uniformWomen && svc.uniformMen ? (
                            <div className="space-y-2">
                              <div className="flex min-w-0 items-start gap-1.5">
                                <Venus className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-700" aria-hidden />
                                <span className="text-[11px] font-semibold shrink-0 text-zinc-700 pt-0.5">:</span>
                                <span className="text-[11px] min-w-0 flex-1 break-words leading-snug text-zinc-800">
                                  {svc.uniformWomen}
                                </span>
                              </div>
                              <div className="flex min-w-0 items-start gap-1.5">
                                <Mars className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-700" aria-hidden />
                                <span className="text-[11px] font-semibold shrink-0 text-zinc-700 pt-0.5">:</span>
                                <span className="text-[11px] min-w-0 flex-1 break-words leading-snug text-zinc-800">
                                  {svc.uniformMen}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex min-w-0 items-start gap-1.5">
                              <Shirt className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-700" aria-hidden />
                              <span className="text-[11px] font-semibold shrink-0 text-zinc-700 pt-0.5">:</span>
                              <span className="text-[11px] min-w-0 flex-1 break-words leading-snug text-zinc-800">
                                {svc.uniform}
                              </span>
                            </div>
                          )}
                        </div>
                        {isOverlap ? <div className="h-6 shrink-0" aria-hidden /> : null}
                      </div>
                    ) : null}

                    {!svc && isRehearsal ? (
                      <div className="mt-2 space-y-1 rounded-sm border border-orange-500 bg-orange-500/95 px-2 py-1 text-white">
                        <div className="w-full text-center text-[10px] font-semibold">Rehearsal</div>
                        {rehearsalServiceLines.map((line, idx) => (
                          <div
                            key={`${key}-export-rehearsal-service-${idx}`}
                            className="text-[10px] font-semibold leading-snug"
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-200 text-center text-[11px] text-zinc-600">
              Generated: {formatExportGeneratedAt(exportGeneratedAt ?? new Date())}
            </div>
            <div className="mt-2 text-center text-[11px] text-zinc-600">
              Powered by{" "}
              <a href="https://extrabrains.co.za/" className="font-semibold text-emerald-600 underline">
                Extra Brains
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

