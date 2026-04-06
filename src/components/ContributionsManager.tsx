"use client";

import Image from "next/image";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { CONTRIBUTION_LOG_EVENT_TYPES } from "@/src/lib/contributionLogConstants";
import { formatIsoDateTimeToDisplay, formatIsoDateToDDMMYYYY, formatYearMonthToDDMMYYYY } from "@/src/lib/formatDate";
import { normalizeWhatsappForStorage, whatsappDigitsForWaMe } from "@/src/lib/whatsappNumber";

type Member = {
  _id: string;
  name: string;
  roles?: string[];
  whatsapp?: string | null;
};

type Contribution = {
  _id: string;
  month: string;
  amount: number;
  paid: boolean;
  paidDate?: string | null;
  notes?: string | null;
  member: { _ref: string } | null;
  memberName: string | null;
};

type ContributionSettings = {
  nonCommitteeTarget: number;
  committeeTarget: number;
  effectiveFrom: string | null;
};

type ExpenseRecord = {
  _id: string;
  month: string;
  date?: string | null;
  amount: number;
  description: string;
  notes?: string | null;
};

type DashboardStatus = "paid" | "partial" | "owed" | "overpaid";

type DashboardRow = {
  memberId: string;
  memberName: string;
  roles: string[];
  isCommittee: boolean;
  expectedAmount: number;
  paidAmount: number;
  balance: number;
  status: DashboardStatus;
  whatsapp?: string | null;
};

type MemberYtdTotal = {
  memberId: string;
  memberName: string;
  paidTotal: number;
};

type ReportMonthPayload = {
  scope: "month";
  month: string;
  periodLabel: string;
  generatedAt: string;
  settings: ContributionSettings;
  summary: {
    totalCollected: number;
    expenseTotal: number;
    netAfterExpenses: number;
  };
  dashboardRows: DashboardRow[];
  contributions: Contribution[];
  expenses: ExpenseRecord[];
};

type ReportYtdPayload = {
  scope: "ytd";
  month: string;
  fromMonth: string;
  toMonth: string;
  periodLabel: string;
  generatedAt: string;
  summary: {
    totalCollected: number;
    expenseTotal: number;
    netAfterExpenses: number;
  };
  memberYtdTotals: MemberYtdTotal[];
  contributions: Contribution[];
  expenses: ExpenseRecord[];
};

type ReportPayload = ReportMonthPayload | ReportYtdPayload;

type ActiveTab = "overview" | "entry" | "expenses" | "settings" | "logs";

type ContributionLogRow = {
  _id: string;
  timestamp: string;
  eventType: string;
  action: string;
  entityType: string;
  entityId?: string;
  month?: string;
  summary: string;
  details?: string;
  deviceId: string;
  ip?: string;
  userAgent?: string;
};

function currentMonth() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function money(value: number): string {
  return value.toFixed(2);
}

function formatGeneratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = `${d.getDate()}`.padStart(2, "0");
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = `${d.getHours()}`.padStart(2, "0");
  const min = `${d.getMinutes()}`.padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function shortDeviceId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function statementStatusBadgeClass(status: DashboardStatus): string {
  if (status === "paid") return "bg-emerald-100 text-emerald-700";
  if (status === "overpaid") return "bg-sky-100 text-sky-700";
  if (status === "partial") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function ContributionsStatementExport({ report }: { report: ReportPayload }) {
  const s = report.summary;
  const cell = "py-2.5 pr-3 align-top";
  const headCell = "py-3 pr-3 font-medium";
  return (
    <div className="space-y-8 text-sm text-zinc-900 leading-relaxed">
      <div>
        <div className="flex items-center gap-3">
          <Image
            src="/contributions-logo.png"
            alt="Last Harvest Mission logo"
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover"
            unoptimized
          />
          <h1 className="text-xl font-bold tracking-tight">
            {report.scope === "month"
              ? `Monthly contributions — ${report.periodLabel}`
              : `Year-to-date contributions — ${report.periodLabel}`}
          </h1>
        </div>
        <p className="mt-3 text-zinc-600">Generated {formatGeneratedAt(report.generatedAt)}</p>
        {report.scope === "month" ? (
          <p className="mt-3 text-zinc-700">
            Targets: Non-committee R{money(report.settings.nonCommitteeTarget)} | Committee R
            {money(report.settings.committeeTarget)}
            {report.settings.effectiveFrom ? (
              <span> (from {report.settings.effectiveFrom})</span>
            ) : (
              <span> (defaults)</span>
            )}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-4 rounded-lg border border-zinc-200 p-5">
        <div>
          <p className="text-xs text-zinc-500">Collected</p>
          <p className="text-base font-semibold">R{money(s.totalCollected)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Expenses</p>
          <p className="text-base font-semibold">R{money(s.expenseTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Net after expenses</p>
          <p className="text-base font-semibold text-emerald-800">R{money(s.netAfterExpenses)}</p>
        </div>
      </div>

      {report.scope === "month" ? (
        <div className="rounded-lg border border-zinc-200 p-4">
          <h2 className="text-sm font-semibold text-zinc-800 mb-3">Member summary</h2>
          <table className="w-full caption-bottom text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-600">
                <th className={`${headCell}`}>Member</th>
                <th className={`${headCell}`}>Type</th>
                <th className={`${headCell}`}>Expected</th>
                <th className={`${headCell}`}>Paid</th>
                <th className={`${headCell}`}>Balance</th>
                <th className={`${headCell}`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.dashboardRows.map((row) => (
                <tr key={row.memberId} className="border-b border-zinc-100">
                  <td className={cell}>{row.memberName}</td>
                  <td className={cell}>{row.isCommittee ? "Committee" : "Non-committee"}</td>
                  <td className={cell}>R{money(row.expectedAmount)}</td>
                  <td className={cell}>R{money(row.paidAmount)}</td>
                  <td className={cell}>R{money(row.balance)}</td>
                  <td className={cell}>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statementStatusBadgeClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 p-4">
          <h2 className="text-sm font-semibold text-zinc-800 mb-3">Member totals (YTD paid)</h2>
          <table className="w-full caption-bottom text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-600">
                <th className={`${headCell}`}>Member</th>
                <th className={`${headCell}`}>Paid</th>
              </tr>
            </thead>
            <tbody>
              {report.memberYtdTotals.map((row) => (
                <tr key={row.memberId} className="border-b border-zinc-100">
                  <td className={cell}>{row.memberName}</td>
                  <td className={cell}>R{money(row.paidTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold text-zinc-800 mb-3">Contribution lines</h2>
        {report.contributions.length === 0 ? (
          <p className="text-zinc-500">None</p>
        ) : (
          <table className="w-full caption-bottom text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-600">
                <th className={`${headCell}`}>Member</th>
                <th className={`${headCell}`}>Amount</th>
                <th className={`${headCell}`}>Paid date</th>
                <th className={`${headCell}`}>Month</th>
                <th className={`${headCell}`}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {report.contributions.map((c) => (
                <tr key={c._id} className="border-b border-zinc-100">
                  <td className={cell}>{c.memberName ?? "—"}</td>
                  <td className={cell}>R{money(c.amount)}</td>
                  <td className={cell}>{formatIsoDateToDDMMYYYY(c.paidDate ?? null) || "—"}</td>
                  <td className={cell}>{formatIsoDateToDDMMYYYY(c.month) || "—"}</td>
                  <td className={`${cell} max-w-[220px]`}>{c.notes?.trim() || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 p-4">
        <h2 className="text-sm font-semibold text-zinc-800 mb-3">Expenses</h2>
        {report.expenses.length === 0 ? (
          <p className="text-zinc-500">None</p>
        ) : (
          <table className="w-full caption-bottom text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-600">
                <th className={`${headCell}`}>Description</th>
                <th className={`${headCell}`}>Amount</th>
                <th className={`${headCell}`}>Date</th>
                <th className={`${headCell}`}>Month</th>
                <th className={`${headCell}`}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {report.expenses.map((ex) => (
                <tr key={ex._id} className="border-b border-zinc-100">
                  <td className={cell}>{ex.description}</td>
                  <td className={cell}>R{money(ex.amount)}</td>
                  <td className={cell}>{formatIsoDateToDDMMYYYY(ex.date ?? null) || "—"}</td>
                  <td className={cell}>{formatIsoDateToDDMMYYYY(ex.month) || "—"}</td>
                  <td className={`${cell} max-w-[220px]`}>{ex.notes?.trim() || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function ContributionsManager({ authorized }: { authorized: boolean }) {
  const [isAuthed, setIsAuthed] = useState(authorized);
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [month, setMonth] = useState(currentMonth());
  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [settings, setSettings] = useState<ContributionSettings>({
    nonCommitteeTarget: 0,
    committeeTarget: 0,
    effectiveFrom: null,
  });
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [totalCollected, setTotalCollected] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [netAfterExpenses, setNetAfterExpenses] = useState(0);
  const [ytdTotalCollected, setYtdTotalCollected] = useState(0);
  const [ytdExpenseTotal, setYtdExpenseTotal] = useState(0);
  const [ytdNetAfterExpenses, setYtdNetAfterExpenses] = useState(0);
  const [dashboardRows, setDashboardRows] = useState<DashboardRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | DashboardStatus>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [exportMode, setExportMode] = useState(false);
  const [reportForExport, setReportForExport] = useState<ReportPayload | null>(null);
  const [statementExporting, setStatementExporting] = useState(false);
  const statementRef = useRef<HTMLDivElement | null>(null);

  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [notes, setNotes] = useState("");

  const [expenseDate, setExpenseDate] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [contributionDeletingId, setContributionDeletingId] = useState<string | null>(null);

  const [settingsNon, setSettingsNon] = useState("100");
  const [settingsCom, setSettingsCom] = useState("250");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [entryFormError, setEntryFormError] = useState<string | null>(null);
  const [expenseFormError, setExpenseFormError] = useState<string | null>(null);

  const [logs, setLogs] = useState<ContributionLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logTypeFilter, setLogTypeFilter] = useState<string>("all");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [whatsappDraftByMember, setWhatsappDraftByMember] = useState<Record<string, string>>({});
  const [whatsappSavingId, setWhatsappSavingId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contributions?month=${encodeURIComponent(month)}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load contributions");
      }
      const data = (await res.json()) as {
        month: string;
        members: Member[];
        contributions: Contribution[];
        settings?: ContributionSettings;
        dashboardRows?: DashboardRow[];
        expenses?: ExpenseRecord[];
        totalCollected?: number;
        expenseTotal?: number;
        netAfterExpenses?: number;
        ytdTotalCollected?: number;
        ytdExpenseTotal?: number;
        ytdNetAfterExpenses?: number;
      };
      setMembers(data.members ?? []);
      setContributions(data.contributions ?? []);
      setSettings(
        data.settings ?? {
          nonCommitteeTarget: 0,
          committeeTarget: 0,
          effectiveFrom: null,
        }
      );
      setDashboardRows(data.dashboardRows ?? []);
      setExpenses(data.expenses ?? []);
      setTotalCollected(typeof data.totalCollected === "number" ? data.totalCollected : 0);
      setExpenseTotal(typeof data.expenseTotal === "number" ? data.expenseTotal : 0);
      setNetAfterExpenses(typeof data.netAfterExpenses === "number" ? data.netAfterExpenses : 0);
      setYtdTotalCollected(typeof data.ytdTotalCollected === "number" ? data.ytdTotalCollected : 0);
      setYtdExpenseTotal(typeof data.ytdExpenseTotal === "number" ? data.ytdExpenseTotal : 0);
      setYtdNetAfterExpenses(typeof data.ytdNetAfterExpenses === "number" ? data.ytdNetAfterExpenses : 0);
      setWhatsappDraftByMember({});
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function downloadStatementPng(scope: "month" | "ytd") {
    setStatementExporting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contributions/report?month=${encodeURIComponent(month)}&scope=${scope}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load report");
      }
      const data = (await res.json()) as ReportPayload;
      setReportForExport(data);
      setExportMode(true);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await new Promise((resolve) => setTimeout(resolve, 50));
      const node = statementRef.current;
      if (!node) throw new Error("Statement not ready");
      const dataUrl = await toPng(node, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const suffix = scope === "month" ? "month" : "ytd";
      const link = document.createElement("a");
      link.download = `contributions-statement-${month}-${suffix}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(
        scope === "month" ? "Month statement downloaded" : "YTD statement downloaded"
      );

      const ym =
        data.scope === "ytd" && "toMonth" in data && typeof data.toMonth === "string"
          ? data.toMonth.slice(0, 7)
          : month;
      try {
        await fetch("/api/contributions/logs", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: scope === "month" ? "statement.download_month" : "statement.download_ytd",
            summary:
              scope === "month"
                ? `Downloaded month statement PNG (${formatYearMonthToDDMMYYYY(month)})`
                : `Downloaded YTD statement PNG (${data.periodLabel})`,
            month: /^\d{4}-\d{2}$/.test(ym) ? ym : undefined,
          }),
        });
      } catch {
        /* non-blocking */
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "PNG export failed";
      setError(message);
      toast.error(message);
    } finally {
      setExportMode(false);
      setReportForExport(null);
      setStatementExporting(false);
    }
  }

  useEffect(() => {
    if (!isAuthed) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when month changes; avoid loadData in deps
  }, [isAuthed, month]);

  async function loadSettingsTab() {
    setSettingsLoading(true);
    setSettingsMessage(null);
    try {
      const res = await fetch("/api/contributions/settings", { credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load settings");
      }
      const data = (await res.json()) as {
        nonCommitteeTarget: number;
        committeeTarget: number;
      };
      setSettingsNon(String(data.nonCommitteeTarget));
      setSettingsCom(String(data.committeeTarget));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load settings";
      setSettingsMessage(message);
    } finally {
      setSettingsLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthed || activeTab !== "settings") return;
    void loadSettingsTab();
  }, [isAuthed, activeTab]);

  async function loadLogs() {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const res = await fetch(
        `/api/contributions/logs?type=${encodeURIComponent(logTypeFilter)}&limit=100`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load logs");
      }
      const data = (await res.json()) as { logs?: ContributionLogRow[] };
      setLogs(data.logs ?? []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load logs";
      setLogsError(message);
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthed || activeTab !== "logs") return;
    void loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when filter or tab changes
  }, [isAuthed, activeTab, logTypeFilter]);

  const selectedMember = useMemo(
    () => members.find((m) => m._id === memberId) ?? null,
    [memberId, members]
  );
  const selectedIsCommittee = Boolean(selectedMember?.roles?.includes("Committee Member"));
  const selectedExpectedTarget = selectedIsCommittee
    ? settings.committeeTarget
    : settings.nonCommitteeTarget;
  const amountValue = Number(amount);
  const showTargetWarning =
    memberId.length > 0 &&
    amount.length > 0 &&
    !Number.isNaN(amountValue) &&
    amountValue < selectedExpectedTarget;

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return dashboardRows;
    return dashboardRows.filter((row) => row.status === statusFilter);
  }, [dashboardRows, statusFilter]);

  const summary = useMemo(() => {
    let totalExpected = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let fullyPaidCount = 0;

    for (const row of dashboardRows) {
      totalExpected += row.expectedAmount;
      totalPaid += row.paidAmount;
      if (row.balance < 0) totalOutstanding += Math.abs(row.balance);
      if (row.balance >= 0) fullyPaidCount += 1;
    }

    return { totalExpected, totalPaid, totalOutstanding, fullyPaidCount };
  }, [dashboardRows]);

  function statusBadgeClass(status: DashboardStatus): string {
    if (status === "paid") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    if (status === "overpaid") return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
    if (status === "partial") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  }

  function contributionReminderMessage(row: DashboardRow): string | null {
    if (row.balance >= 0) return null;
    const period = formatYearMonthToDDMMYYYY(month);
    const shortBy = money(Math.abs(row.balance));
    return `Hi ${row.memberName}, your band contribution for ${period} is short by R${shortBy}. Please pay when you can. Thank you!`;
  }

  function whatsappReminderHref(row: DashboardRow): string | null {
    const draft = whatsappDraftByMember[row.memberId];
    const raw = draft !== undefined ? draft : (row.whatsapp ?? "");
    const normalized = normalizeWhatsappForStorage(raw);
    if (raw.trim() !== "" && normalized === null) return null;
    const digits = normalized ? whatsappDigitsForWaMe(normalized) : null;
    const msg = contributionReminderMessage(row);
    if (!digits || !msg) return null;
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
  }

  async function commitWhatsapp(memberId: string) {
    const row = dashboardRows.find((r) => r.memberId === memberId);
    if (!row) return;
    const draft = whatsappDraftByMember[memberId];
    const effective = draft !== undefined ? draft : (row.whatsapp ?? "");
    const nextNorm = normalizeWhatsappForStorage(effective);
    const prevNorm = row.whatsapp ?? null;
    if (nextNorm === prevNorm) return;

    setWhatsappSavingId(memberId);
    try {
      const res = await fetch("/api/contributions/member-whatsapp", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          whatsapp: effective.trim() === "" ? null : effective,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; whatsapp?: string | null };
      if (!res.ok) throw new Error(body.error ?? "Failed to save WhatsApp number");
      const saved = body.whatsapp ?? null;
      setDashboardRows((prev) =>
        prev.map((r) => (r.memberId === memberId ? { ...r, whatsapp: saved } : r))
      );
      setMembers((prev) => prev.map((m) => (m._id === memberId ? { ...m, whatsapp: saved } : m)));
      setWhatsappDraftByMember((prev) => {
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
      toast.success("WhatsApp number saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setWhatsappSavingId(null);
    }
  }

  async function handleUnlock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUnlockError(null);
    try {
      const res = await fetch("/api/contributions/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Unauthorized");
      }
      setIsAuthed(true);
      setPassword("");
      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unlock failed";
      setUnlockError(message);
    }
  }

  async function handleSignOut() {
    await fetch("/api/contributions/auth", {
      method: "DELETE",
      credentials: "include",
    });
    setIsAuthed(false);
    setMembers([]);
    setContributions([]);
    setExpenses([]);
    setTotalCollected(0);
    setExpenseTotal(0);
    setNetAfterExpenses(0);
    setYtdTotalCollected(0);
    setYtdExpenseTotal(0);
    setYtdNetAfterExpenses(0);
  }

  async function handleExpenseSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setExpenseSaving(true);
    setError(null);
    setExpenseFormError(null);
    try {
      const parsed = Number(expenseAmount);
      if (!expenseDate || !expenseDescription.trim() || Number.isNaN(parsed) || parsed < 0) {
        const msg = "Choose expense date, description and a valid amount.";
        setExpenseFormError(msg);
        throw new Error(msg);
      }
      if (editingExpenseId) {
        const res = await fetch("/api/contributions/expenses", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: editingExpenseId,
            date: expenseDate,
            amount: parsed,
            description: expenseDescription.trim(),
            notes: expenseNotes,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Update failed");
        }
        toast.success("Expense updated");
      } else {
        const res = await fetch("/api/contributions/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            date: expenseDate,
            amount: parsed,
            description: expenseDescription.trim(),
            notes: expenseNotes.trim() || null,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Save failed");
        }
        toast.success("Expense saved");
      }
      setExpenseDescription("");
      setExpenseAmount("");
      setExpenseNotes("");
      setExpenseDate("");
      setEditingExpenseId(null);
      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save expense";
      setError(message);
      toast.error(message);
    } finally {
      setExpenseSaving(false);
    }
  }

  function beginEditExpense(ex: ExpenseRecord) {
    setEditingExpenseId(ex._id);
    setExpenseDate(ex.date?.slice(0, 10) ?? "");
    setExpenseDescription(ex.description);
    setExpenseAmount(String(ex.amount));
    setExpenseNotes(ex.notes ?? "");
    setError(null);
  }

  function cancelEditExpense() {
    setEditingExpenseId(null);
    setExpenseDescription("");
    setExpenseAmount("");
    setExpenseNotes("");
    setExpenseDate("");
  }

  async function deleteExpense(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/contributions/expenses?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Delete failed");
      }
      if (editingExpenseId === id) {
        cancelEditExpense();
      }
      await loadData();
      toast.success("Expense removed");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete";
      setError(message);
      toast.error(message);
    }
  }

  async function handleSettingsSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsMessage(null);
    try {
      const non = Number(settingsNon);
      const com = Number(settingsCom);
      if (Number.isNaN(non) || Number.isNaN(com) || non < 0 || com < 0) {
        throw new Error("Enter valid non-negative amounts.");
      }
      const res = await fetch("/api/contributions/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nonCommitteeTarget: non, committeeTarget: com }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Save failed");
      }
      setSettingsMessage("Saved. Targets apply from this month forward; past months keep earlier targets.");
      await loadData();
      toast.success("Targets saved");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save";
      setSettingsMessage(message);
      toast.error(message);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setEntryFormError(null);
    try {
      const parsedAmount = Number(amount);
      if (!memberId || !paidDate || Number.isNaN(parsedAmount)) {
        const msg = "Please choose a member, paid date and a valid amount.";
        setEntryFormError(msg);
        throw new Error(msg);
      }
      const monthFromPaidDate = paidDate.slice(0, 7);

      if (editingContributionId) {
        const res = await fetch("/api/contributions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: editingContributionId,
            memberId,
            amount: parsedAmount,
            paidDate,
            notes,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Update failed");
        }
        toast.success("Contribution updated");
      } else {
        const res = await fetch("/api/contributions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            memberId,
            month: monthFromPaidDate,
            amount: parsedAmount,
            paid: true,
            paidDate,
            notes: notes || null,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Save failed");
        }
        toast.success("Contribution saved");
      }

      setAmount("");
      setPaidDate("");
      setNotes("");
      setMemberId("");
      setEditingContributionId(null);
      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function beginEditContribution(item: Contribution) {
    const ref = item.member?._ref;
    if (!ref) return;
    setEditingContributionId(item._id);
    setMemberId(ref);
    setAmount(String(item.amount));
    setPaidDate(item.paidDate?.slice(0, 10) ?? "");
    setNotes(item.notes ?? "");
    setError(null);
  }

  function cancelEditContribution() {
    setEditingContributionId(null);
    setAmount("");
    setPaidDate("");
    setNotes("");
    setMemberId("");
  }

  async function deleteContribution(id: string) {
    if (!window.confirm("Delete this contribution entry?")) return;
    setContributionDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/contributions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Delete failed");
      }
      if (editingContributionId === id) {
        cancelEditContribution();
      }
      await loadData();
      toast.success("Contribution deleted");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete";
      setError(message);
      toast.error(message);
    } finally {
      setContributionDeletingId(null);
    }
  }

  if (!isAuthed) {
    return (
      <section className="max-w-md mx-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Choir Contributions</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Admin access required.
        </p>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          This password is managed in the Sanity document type{" "}
          <span className="font-medium">Contribution Access</span>.
        </p>
        <form className="mt-4 space-y-3" onSubmit={handleUnlock}>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              required
            />
          </label>
          {unlockError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{unlockError}</p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-3 py-2 text-sm font-medium"
          >
            Unlock
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image
              src="/contributions-logo.png"
              alt="Last Harvest Mission logo"
              width={44}
              height={44}
              className="h-11 w-11 rounded-full object-cover"
              unoptimized
            />
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Choir Contributions
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Track monthly contributions by member.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200"
          >
            Sign out
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 p-1">
          {(
            [
              ["overview", "Overview"],
              ["entry", "Add Entry"],
              ["expenses", "Expenses"],
              ["settings", "Settings"],
              ["logs", "Logs"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-300",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Month
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 pr-10 text-sm [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:brightness-[1.8]"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Status
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | DashboardStatus)}
                  className="mt-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="owed">Owed</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="overpaid">Overpaid</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void downloadStatementPng("month")}
                  disabled={loading || statementExporting}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-100 disabled:opacity-60"
                >
                  {statementExporting ? "Preparing…" : "Download month (PNG)"}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadStatementPng("ytd")}
                  disabled={loading || statementExporting}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-100 disabled:opacity-60"
                >
                  {statementExporting ? "Preparing…" : "Download YTD (PNG)"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Expected</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{money(summary.totalExpected)}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Collected</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{money(totalCollected)}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Outstanding</p>
                <p className="text-lg font-semibold text-rose-600 dark:text-rose-400">
                  {money(summary.totalOutstanding)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Fully Paid</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {summary.fullyPaidCount}/{dashboardRows.length}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Total expenses</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{money(expenseTotal)}</p>
              </div>
              <div className="rounded-lg border border-emerald-300/70 bg-emerald-50/60 dark:bg-emerald-900/20 dark:border-emerald-700 p-3 md:col-span-2 lg:col-span-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Net after expenses</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{money(netAfterExpenses)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/40 p-3">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                Year to date ({month.slice(0, 4)} · 1 Jan – {formatYearMonthToDDMMYYYY(month)})
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-3">
                Total contributions and expenses from the start of the calendar year through the selected month.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-950/50 p-3">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">YTD collected</p>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{money(ytdTotalCollected)}</p>
                </div>
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-950/50 p-3">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">YTD expenses</p>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{money(ytdExpenseTotal)}</p>
                </div>
                <div className="rounded-lg border border-emerald-300/70 bg-emerald-50/60 dark:bg-emerald-900/20 dark:border-emerald-700 p-3 col-span-2 md:col-span-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">YTD net after expenses</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{money(ytdNetAfterExpenses)}</p>
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Targets for {formatYearMonthToDDMMYYYY(month)}: Non-committee R{money(settings.nonCommitteeTarget)} |
              Committee R{money(settings.committeeTarget)}
              {settings.effectiveFrom ? (
                <span>
                  {" "}
                  (from {formatIsoDateToDDMMYYYY(settings.effectiveFrom) || settings.effectiveFrom})
                </span>
              ) : (
                <span> (defaults)</span>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Member dashboard</h2>
            {loading ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
            ) : filteredRows.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No members found.</p>
            ) : (
              <>
                <div className="mt-3 space-y-2 sm:hidden">
                  {filteredRows.map((row) => {
                    const waHref = whatsappReminderHref(row);
                    return (
                      <div
                        key={row.memberId}
                        className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-white/80 dark:bg-zinc-950/50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{row.memberName}</p>
                          <span
                            className={[
                              "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                              statusBadgeClass(row.status),
                            ].join(" ")}
                          >
                            {row.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {row.isCommittee ? "Committee" : "Non-committee"}
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-zinc-500 dark:text-zinc-400">Expected</p>
                            <p className="text-zinc-900 dark:text-zinc-100">{money(row.expectedAmount)}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500 dark:text-zinc-400">Paid</p>
                            <p className="text-zinc-900 dark:text-zinc-100">{money(row.paidAmount)}</p>
                          </div>
                          <div>
                            <p className="text-zinc-500 dark:text-zinc-400">Balance</p>
                            <p
                              className={
                                row.balance < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-zinc-900 dark:text-zinc-100"
                              }
                            >
                              {money(row.balance)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mb-1">
                            WhatsApp (saved on blur)
                          </label>
                          <div className="flex flex-col gap-2.5">
                            <input
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              placeholder="e.g. 27821234567"
                              className="w-[15ch] max-w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-1.5 py-1.5 text-xs tabular-nums"
                              value={whatsappDraftByMember[row.memberId] ?? row.whatsapp ?? ""}
                              onChange={(e) =>
                                setWhatsappDraftByMember((prev) => ({
                                  ...prev,
                                  [row.memberId]: e.target.value,
                                }))
                              }
                              onBlur={() => void commitWhatsapp(row.memberId)}
                              disabled={whatsappSavingId === row.memberId}
                            />
                            {waHref ? (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                              >
                                Open WhatsApp reminder
                              </a>
                            ) : row.balance < 0 ? (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Add a valid number for a prefilled balance reminder.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 hidden sm:block overflow-x-auto max-h-[28rem] rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 px-3">Member</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3">Type</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3 text-right">Expected</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3 text-right">Paid</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3 text-right">Balance</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3 w-[1%] whitespace-nowrap">
                          WhatsApp
                        </th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, idx) => {
                        const waHref = whatsappReminderHref(row);
                        return (
                        <tr
                          key={row.memberId}
                          className={[
                            "border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40",
                            idx % 2 === 1 ? "bg-zinc-50/30 dark:bg-zinc-950/30" : "",
                          ].join(" ")}
                        >
                          <td className="py-2 px-3 text-zinc-900 dark:text-zinc-100">{row.memberName}</td>
                          <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                            {row.isCommittee ? "Committee" : "Non-committee"}
                          </td>
                          <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100 text-right">
                            {money(row.expectedAmount)}
                          </td>
                          <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100 text-right">
                            {money(row.paidAmount)}
                          </td>
                          <td
                            className={[
                              "py-2 pr-3 text-right",
                              row.balance < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-zinc-900 dark:text-zinc-100",
                            ].join(" ")}
                          >
                            {money(row.balance)}
                          </td>
                          <td className="py-2 pr-3 align-top">
                            <div className="flex w-[15ch] max-w-full flex-col gap-2.5">
                              <input
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder="2782…"
                                title="Saved when you leave this field"
                                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-1.5 py-1 text-xs tabular-nums"
                                value={whatsappDraftByMember[row.memberId] ?? row.whatsapp ?? ""}
                                onChange={(e) =>
                                  setWhatsappDraftByMember((prev) => ({
                                    ...prev,
                                    [row.memberId]: e.target.value,
                                  }))
                                }
                                onBlur={() => void commitWhatsapp(row.memberId)}
                                disabled={whatsappSavingId === row.memberId}
                              />
                              {waHref ? (
                                <a
                                  href={waHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                                >
                                  Remind
                                </a>
                              ) : row.balance < 0 ? (
                                <span className="block text-[11px] text-zinc-400">—</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              className={[
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                                statusBadgeClass(row.status),
                              ].join(" ")}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {activeTab === "entry" && (
        <>
          <div
            className={[
              "rounded-xl border bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5",
              editingContributionId
                ? "border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20"
                : "border-zinc-200 dark:border-zinc-800",
            ].join(" ")}
          >
            {editingContributionId ? (
              <p className="mb-3 text-sm font-medium text-amber-800 dark:text-amber-300">
                Editing an existing entry — save to update or cancel.
              </p>
            ) : null}
            <form className="grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Member
                <select
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select member</option>
                  {members.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  required
                />
              </label>

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Paid date
                <input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 pr-10 text-sm [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:brightness-[1.8]"
                  required
                />
                <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  Calendar picker; tables and statements show dates as dd/mm/yyyy.
                </span>
              </label>

              <label className="sm:col-span-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Notes
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  placeholder="Optional notes"
                />
              </label>

              {selectedMember?.roles?.length ? (
                <p className="sm:col-span-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Roles: {selectedMember.roles.join(", ")}
                </p>
              ) : null}
              <p className="sm:col-span-2 text-xs text-zinc-500 dark:text-zinc-400">
                Expected target for selected member: {money(selectedExpectedTarget)}
              </p>
              {showTargetWarning ? (
                <p className="sm:col-span-2 text-xs text-amber-600 dark:text-amber-400">
                  Entered amount is below this member&apos;s monthly target.
                </p>
              ) : null}

              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-70"
                >
                  {saving
                    ? "Saving..."
                    : editingContributionId
                      ? "Update contribution"
                      : "Save contribution"}
                </button>
                {editingContributionId ? (
                  <button
                    type="button"
                    onClick={cancelEditContribution}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
            {entryFormError ? <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{entryFormError}</p> : null}
            {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Monthly entries</h2>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatYearMonthToDDMMYYYY(month)}
              </span>
            </div>

            {loading ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
            ) : contributions.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No contributions found.</p>
            ) : (
              <>
                <div className="mt-3 space-y-2 sm:hidden">
                  {contributions.map((item) => (
                    <div
                      key={item._id}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-white/80 dark:bg-zinc-950/50"
                    >
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.memberName ?? "—"}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-zinc-500 dark:text-zinc-400">Amount</p>
                          <p className="text-zinc-900 dark:text-zinc-100">{money(item.amount)}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 dark:text-zinc-400">Paid date</p>
                          <p className="text-zinc-900 dark:text-zinc-100">
                            {formatIsoDateToDDMMYYYY(item.paidDate ?? null) || "—"}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-zinc-500 dark:text-zinc-400">Notes</p>
                          <p className="text-zinc-700 dark:text-zinc-300">{item.notes?.trim() || "—"}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-3">
                        <button
                          type="button"
                          onClick={() => beginEditContribution(item)}
                          disabled={Boolean(contributionDeletingId) || saving}
                          className="text-xs text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteContribution(item._id)}
                          disabled={contributionDeletingId === item._id || saving}
                          className="text-xs text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                        >
                          {contributionDeletingId === item._id ? "…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 hidden sm:block overflow-x-auto max-h-[28rem] rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 px-3">Member</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3 text-right">Amount</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3">Paid date</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3">Notes</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3 w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contributions.map((item, idx) => (
                        <tr
                          key={item._id}
                          className={[
                            "border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40",
                            idx % 2 === 1 ? "bg-zinc-50/30 dark:bg-zinc-950/30" : "",
                          ].join(" ")}
                        >
                          <td className="py-2 px-3 text-zinc-900 dark:text-zinc-100">{item.memberName ?? "—"}</td>
                          <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100 text-right">
                            {money(item.amount)}
                          </td>
                          <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100">
                            {formatIsoDateToDDMMYYYY(item.paidDate ?? null) || "—"}
                          </td>
                          <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{item.notes?.trim() || "—"}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => beginEditContribution(item)}
                              disabled={Boolean(contributionDeletingId) || saving}
                              className="text-xs text-sky-600 dark:text-sky-400 hover:underline mr-2 disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteContribution(item._id)}
                              disabled={contributionDeletingId === item._id || saving}
                              className="text-xs text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                            >
                              {contributionDeletingId === item._id ? "…" : "Delete"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {activeTab === "expenses" && (
        <>
          <div
            className={[
              "rounded-xl border bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5",
              editingExpenseId
                ? "border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20"
                : "border-zinc-200 dark:border-zinc-800",
            ].join(" ")}
          >
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Record expense</h2>
            {editingExpenseId ? (
              <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                Editing an existing expense — save to update or cancel.
              </p>
            ) : null}
            <form className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={handleExpenseSubmit}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:col-span-2">
                Expense date
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 pr-10 text-sm [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:brightness-[1.8]"
                  required
                />
                <span className="mt-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  Calendar picker; tables and statements show dates as dd/mm/yyyy.
                </span>
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:col-span-2">
                Description
                <input
                  type="text"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Amount (R)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:col-span-2">
                Notes
                <textarea
                  rows={2}
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  placeholder="Optional"
                />
              </label>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={expenseSaving}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-70"
                >
                  {expenseSaving
                    ? "Saving..."
                    : editingExpenseId
                      ? "Update expense"
                      : "Save expense"}
                </button>
                {editingExpenseId ? (
                  <button
                    type="button"
                    onClick={cancelEditExpense}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
            {expenseFormError ? <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{expenseFormError}</p> : null}
            {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Expenses this month</h2>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatYearMonthToDDMMYYYY(month)}
              </span>
            </div>
            {loading ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
            ) : expenses.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No expenses recorded.</p>
            ) : (
              <>
                <div className="mt-3 space-y-2 sm:hidden">
                  {expenses.map((ex) => (
                    <div
                      key={ex._id}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-white/80 dark:bg-zinc-950/50"
                    >
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{ex.description}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-zinc-500 dark:text-zinc-400">Date</p>
                          <p className="text-zinc-900 dark:text-zinc-100">
                            {formatIsoDateToDDMMYYYY(ex.date ?? null) || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-500 dark:text-zinc-400">Amount</p>
                          <p className="text-zinc-900 dark:text-zinc-100">{money(ex.amount)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-zinc-500 dark:text-zinc-400">Notes</p>
                          <p className="text-zinc-700 dark:text-zinc-300">{ex.notes?.trim() || "—"}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-3">
                        <button
                          type="button"
                          onClick={() => beginEditExpense(ex)}
                          disabled={expenseSaving}
                          className="text-xs text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteExpense(ex._id)}
                          disabled={expenseSaving}
                          className="text-xs text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 hidden sm:block overflow-x-auto max-h-[28rem] rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 px-3">Date</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3">Description</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3 text-right">Amount</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3">Notes</th>
                        <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3 w-36">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((ex, idx) => (
                        <tr
                          key={ex._id}
                          className={[
                            "border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40",
                            idx % 2 === 1 ? "bg-zinc-50/30 dark:bg-zinc-950/30" : "",
                          ].join(" ")}
                        >
                          <td className="py-2 px-3 text-zinc-900 dark:text-zinc-100">
                            {formatIsoDateToDDMMYYYY(ex.date ?? null) || "—"}
                          </td>
                          <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100">{ex.description}</td>
                          <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100 text-right">{money(ex.amount)}</td>
                          <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{ex.notes?.trim() || "—"}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => beginEditExpense(ex)}
                              disabled={expenseSaving}
                              className="text-xs text-sky-600 dark:text-sky-400 hover:underline mr-2 disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteExpense(ex._id)}
                              disabled={expenseSaving}
                              className="text-xs text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {activeTab === "logs" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Activity log</h2>
            <label className="block w-full min-w-0 text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:w-auto">
              Event type
              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value)}
                className="mt-1 w-full sm:w-auto sm:min-w-[12rem] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                {CONTRIBUTION_LOG_EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Recent actions (newest first). Device IDs are anonymized labels stored in a cookie for this browser.
          </p>
          {logsLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
          ) : logsError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{logsError}</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No log entries yet.</p>
          ) : (
            <>
              <div className="space-y-2 sm:hidden max-h-[32rem] overflow-y-auto pr-1">
                {logs.map((row) => (
                  <div
                    key={row._id}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 bg-white/80 dark:bg-zinc-950/50"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-mono text-zinc-800 dark:text-zinc-200 break-all">{row.eventType}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {formatIsoDateTimeToDisplay(row.timestamp)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-zinc-900 dark:text-zinc-100">{row.summary}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Device: <span className="font-mono">{shortDeviceId(row.deviceId)}</span>
                    </p>
                    {row.details?.trim() ? (
                      <button
                        type="button"
                        onClick={() => setExpandedLogId((id) => (id === row._id ? null : row._id))}
                        className="mt-2 text-xs text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        {expandedLogId === row._id ? "Hide details" : "Show details"}
                      </button>
                    ) : null}
                    {expandedLogId === row._id && row.details?.trim() ? (
                      <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-600 dark:text-zinc-400 font-sans">
                        {row.details}
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800 max-h-[32rem]">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                      <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 px-3 whitespace-nowrap">Time</th>
                      <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3">Type</th>
                      <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3">Summary</th>
                      <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3 whitespace-nowrap">Device</th>
                      <th className="sticky top-0 bg-white dark:bg-zinc-950 py-2 pr-3 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((row, idx) => (
                      <Fragment key={row._id}>
                        <tr
                          className={[
                            "border-b border-zinc-100 dark:border-zinc-900",
                            idx % 2 === 1 ? "bg-zinc-50/30 dark:bg-zinc-950/30" : "",
                          ].join(" ")}
                        >
                          <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap align-top">
                            {formatIsoDateTimeToDisplay(row.timestamp)}
                          </td>
                          <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100 align-top font-mono text-xs">
                            {row.eventType}
                          </td>
                          <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-200 align-top">{row.summary}</td>
                          <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400 align-top font-mono text-xs">
                            {shortDeviceId(row.deviceId)}
                          </td>
                          <td className="py-2 pr-3 align-top">
                            {row.details?.trim() ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedLogId((id) => (id === row._id ? null : row._id))
                                }
                                className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
                              >
                                {expandedLogId === row._id ? "Hide" : "Details"}
                              </button>
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                          </td>
                        </tr>
                        {expandedLogId === row._id && row.details?.trim() ? (
                          <tr key={`${row._id}-details`} className="bg-zinc-50/80 dark:bg-zinc-900/50">
                            <td colSpan={5} className="px-3 pb-3 pt-0 text-xs text-zinc-600 dark:text-zinc-400">
                              <pre className="whitespace-pre-wrap break-words font-sans">{row.details}</pre>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Monthly targets</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Changes apply from the start of the current month onward. Earlier months keep the targets that were in
            effect then.
          </p>
          {settingsLoading ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
          ) : (
            <form className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg" onSubmit={handleSettingsSave}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Non-committee (R / month)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settingsNon}
                  onChange={(e) => setSettingsNon(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Committee (R / month)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settingsCom}
                  onChange={(e) => setSettingsCom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  required
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-70"
                >
                  {settingsSaving ? "Saving..." : "Save targets"}
                </button>
              </div>
            </form>
          )}
          {settingsMessage ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{settingsMessage}</p>
          ) : null}
        </div>
      )}

      {exportMode && reportForExport ? (
        <div className="fixed top-0 left-[-100000px] pointer-events-none z-[-1]">
          <div
            ref={statementRef}
            className="w-full bg-white text-zinc-900 p-8"
            style={{ maxWidth: 900 }}
          >
            <ContributionsStatementExport report={reportForExport} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

