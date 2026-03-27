"use client";

import { useEffect, useMemo, useState } from "react";

type Member = {
  _id: string;
  name: string;
  roles?: string[];
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

function currentMonth() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export default function ContributionsManager({ authorized }: { authorized: boolean }) {
  const [isAuthed, setIsAuthed] = useState(authorized);
  const [sanityToken, setSanityToken] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [month, setMonth] = useState(currentMonth());
  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState(false);
  const [paidDate, setPaidDate] = useState("");
  const [notes, setNotes] = useState("");

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
      };
      setMembers(data.members ?? []);
      setContributions(data.contributions ?? []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAuthed) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, month]);

  const selectedMember = useMemo(
    () => members.find((m) => m._id === memberId) ?? null,
    [memberId, members]
  );

  async function handleUnlock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUnlockError(null);
    try {
      const res = await fetch("/api/contributions/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: sanityToken }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Unauthorized");
      }
      setIsAuthed(true);
      setSanityToken("");
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
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const parsedAmount = Number(amount);
      if (!memberId || Number.isNaN(parsedAmount)) {
        throw new Error("Please choose a member and a valid amount.");
      }

      const res = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          memberId,
          month,
          amount: parsedAmount,
          paid,
          paidDate: paid ? paidDate || null : null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Save failed");
      }

      setAmount("");
      setPaid(false);
      setPaidDate("");
      setNotes("");
      await loadData();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (!isAuthed) {
    return (
      <section className="max-w-md mx-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Choir Contributions</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Admin access required via Sanity user role.
        </p>
        <form className="mt-4 space-y-3" onSubmit={handleUnlock}>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Sanity token
            <input
              type="password"
              value={sanityToken}
              onChange={(e) => setSanityToken(e.target.value)}
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
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Choir Contributions
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Track monthly contributions by member.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <form className="grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              required
            />
          </label>

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
            Paid Date
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              disabled={!paid}
              className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm disabled:opacity-60"
            />
          </label>

          <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Paid
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

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save contribution"}
            </button>
          </div>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/70 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Monthly entries</h2>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{month}</span>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
        ) : contributions.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No contributions found.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-3">Member</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Paid</th>
                  <th className="py-2 pr-3">Paid date</th>
                  <th className="py-2 pr-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((item) => (
                  <tr key={item._id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100">{item.memberName ?? "—"}</td>
                    <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100">{item.amount.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100">{item.paid ? "Yes" : "No"}</td>
                    <td className="py-2 pr-3 text-zinc-900 dark:text-zinc-100">{item.paidDate ?? "—"}</td>
                    <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">{item.notes?.trim() || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

