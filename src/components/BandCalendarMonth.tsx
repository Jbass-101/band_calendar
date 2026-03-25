"use client";

import { useEffect, useMemo, useState } from "react";

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

function formatYMDLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const year = cursorMonth.getFullYear();
    const month = cursorMonth.getMonth();

    const fromDate = new Date(year, month, 1);
    const toDate = new Date(year, month + 1, 0);

    const from = formatYMDLocal(fromDate);
    const to = formatYMDLocal(toDate);

    let cancelled = false;

    fetch(`/api/services?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg = body?.error ? String(body.error) : `Request failed (${res.status})`;
          throw new Error(msg);
        }
        return (await res.json()) as Service[];
      })
      .then((data) => {
        if (cancelled) return;
        setServices(data);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setServices([]);
        setError(e instanceof Error ? e.message : "Failed to load services");
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

  return (
    <section className="w-full">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">{monthYearLabel}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              setCursorMonth((d) => addMonths(d, -1));
            }}
            className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              setCursorMonth((d) => addMonths(d, 1));
            }}
            className="px-3 py-1 rounded border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2 text-sm text-zinc-600 dark:text-zinc-300">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="font-medium text-center">
            {d}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-300">Loading services...</div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : services.length === 0 ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-300">No services found for this month.</div>
      ) : null}

      <div className="grid grid-cols-7 gap-2">
        {grid.map(({ date, inMonth, key }) => {
          const svc = serviceByDate.get(key);

          return (
            <div
              key={key}
              className={[
                "min-h-28 rounded-md border p-2",
                inMonth
                  ? "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black/20"
                  : "border-transparent bg-transparent opacity-40",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold">{date.getDate()}</div>
                {svc ? (
                  <div className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">
                    {formatWeekdayShort(date)}
                  </div>
                ) : null}
              </div>

              {svc && inMonth ? (
                <div className="mt-2">
                  <div className="text-xs font-semibold truncate">{svc.title}</div>
                  <div className="mt-2 space-y-1">
                    {ROLE_ORDER.map((role) => {
                      const assignment = svc.assignments.find((a) => a.role === role);
                      const name = assignment?.musicianName ?? null;

                      return (
                        <div key={role} className="flex items-baseline gap-2">
                          <span className="text-[11px] font-medium whitespace-nowrap">{role} :</span>
                          <span className="text-[11px] text-zinc-700 dark:text-zinc-200 truncate">
                            {name ?? "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

