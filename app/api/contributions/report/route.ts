import { NextResponse } from "next/server";
import {
  getContribAuthCookieName,
  isContribSessionValidFromCookie,
} from "@/src/lib/sanity/contributionsAuth";
import {
  resolveTargetsForMonth,
  type TargetHistoryRow,
} from "@/src/lib/sanity/contributionTargets";
import { getSanityWriteClient } from "@/src/lib/sanity/sanityWriteClient";

type ContributionRecord = {
  _id: string;
  month: string;
  amount: number;
  paid: boolean;
  paidDate?: string | null;
  notes?: string | null;
  member: { _ref: string } | null;
  memberName: string | null;
};

type MemberOption = {
  _id: string;
  name: string;
  roles?: string[];
};

type ExpenseRecord = {
  _id: string;
  date?: string | null;
  month: string;
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
};

type MemberYtdTotal = {
  memberId: string;
  memberName: string;
  paidTotal: number;
};

async function isAuthorized(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const pairs = cookieHeader.split(";").map((s) => s.trim());
  const cookieName = getContribAuthCookieName();
  const pair = pairs.find((p) => p.startsWith(`${cookieName}=`));
  const cookieValue = pair ? decodeURIComponent(pair.split("=")[1] ?? "") : "";
  return isContribSessionValidFromCookie(cookieValue || undefined);
}

function normalizeMonth(input: string): string {
  if (/^\d{4}-\d{2}$/.test(input)) return `${input}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m] = input.split("-");
    return `${y}-${m}-01`;
  }
  throw new Error("Invalid month format. Use YYYY-MM.");
}

function buildDashboardRows(
  members: MemberOption[],
  contributions: ContributionRecord[],
  settings: {
    nonCommitteeTarget: number;
    committeeTarget: number;
  }
): DashboardRow[] {
  const paidByMember = new Map<string, number>();
  for (const item of contributions) {
    const ref = item.member?._ref;
    if (!ref) continue;
    const current = paidByMember.get(ref) ?? 0;
    paidByMember.set(ref, current + (typeof item.amount === "number" ? item.amount : 0));
  }

  return members.map((member) => {
    const roles = Array.isArray(member.roles) ? member.roles : [];
    const isCommittee = roles.includes("Committee Member");
    const expectedAmount = isCommittee ? settings.committeeTarget : settings.nonCommitteeTarget;
    const paidAmount = paidByMember.get(member._id) ?? 0;
    const balance = paidAmount - expectedAmount;

    let status: DashboardStatus = "paid";
    if (paidAmount === 0 && expectedAmount > 0) status = "owed";
    else if (paidAmount > expectedAmount) status = "overpaid";
    else if (paidAmount < expectedAmount) status = "partial";

    return {
      memberId: member._id,
      memberName: member.name,
      roles,
      isCommittee,
      expectedAmount,
      paidAmount,
      balance,
      status,
    };
  });
}

export async function GET(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const monthRaw = url.searchParams.get("month");
    if (!monthRaw) {
      return NextResponse.json({ error: "Missing month query param" }, { status: 400 });
    }
    const month = normalizeMonth(monthRaw);
    const scopeRaw = url.searchParams.get("scope") ?? "month";
    if (scopeRaw !== "month" && scopeRaw !== "ytd") {
      return NextResponse.json({ error: "Invalid scope. Use month or ytd." }, { status: 400 });
    }

    const client = getSanityWriteClient();
    const [members, accessRaw] = await Promise.all([
      client.fetch<MemberOption[]>(
        `*[_type == "musician"] | order(name asc) {
          _id,
          name,
          roles
        }`
      ),
      client.fetch<{
        nonCommitteeTarget?: number;
        committeeTarget?: number;
        targetHistory?: TargetHistoryRow[] | null;
      } | null>(
        `*[_type == "contributionAccess"][0]{
          nonCommitteeTarget,
          committeeTarget,
          targetHistory
        }`
      ),
    ]);

    const flatNon = typeof accessRaw?.nonCommitteeTarget === "number" ? accessRaw.nonCommitteeTarget : 0;
    const flatCom = typeof accessRaw?.committeeTarget === "number" ? accessRaw.committeeTarget : 0;

    const generatedAt = new Date().toISOString();

    if (scopeRaw === "month") {
      const [contributions, expenses] = await Promise.all([
        client.fetch<ContributionRecord[]>(
          `*[_type == "contribution" && month == $month] | order(member->name asc) {
            _id,
            month,
            amount,
            paid,
            paidDate,
            notes,
            member,
            "memberName": member->name
          }`,
          { month }
        ),
        client.fetch<ExpenseRecord[]>(
          `*[_type == "contributionExpense" && month == $month] | order(_createdAt desc) {
            _id,
            date,
            month,
            amount,
            description,
            notes
          }`,
          { month }
        ),
      ]);

      const resolved = resolveTargetsForMonth(month, accessRaw?.targetHistory ?? null, flatNon, flatCom);
      const settings = {
        nonCommitteeTarget: resolved.nonCommitteeTarget,
        committeeTarget: resolved.committeeTarget,
        effectiveFrom: resolved.effectiveFrom,
      };

      const totalCollected = contributions.reduce(
        (sum, c) => sum + (typeof c.amount === "number" ? c.amount : 0),
        0
      );
      const expenseTotal = expenses.reduce((sum, e) => sum + (typeof e.amount === "number" ? e.amount : 0), 0);
      const netAfterExpenses = totalCollected - expenseTotal;
      const dashboardRows = buildDashboardRows(members, contributions, settings);

      const y = month.slice(0, 4);
      const mo = month.slice(5, 7);
      const periodLabel = `${mo}/${y}`;

      return NextResponse.json(
        {
          scope: "month" as const,
          month,
          periodLabel,
          generatedAt,
          settings,
          summary: {
            totalCollected,
            expenseTotal,
            netAfterExpenses,
          },
          dashboardRows,
          contributions,
          expenses,
        },
        { status: 200 }
      );
    }

    const year = month.slice(0, 4);
    const fromMonth = `${year}-01-01`;
    const toMonth = month;

    const [contributions, expenses] = await Promise.all([
      client.fetch<ContributionRecord[]>(
        `*[_type == "contribution" && month >= $from && month <= $to] | order(month asc, member->name asc) {
          _id,
          month,
          amount,
          paid,
          paidDate,
          notes,
          member,
          "memberName": member->name
        }`,
        { from: fromMonth, to: toMonth }
      ),
      client.fetch<ExpenseRecord[]>(
        `*[_type == "contributionExpense" && month >= $from && month <= $to] | order(month asc, _createdAt desc) {
          _id,
          date,
          month,
          amount,
          description,
          notes
        }`,
        { from: fromMonth, to: toMonth }
      ),
    ]);

    const totalCollected = contributions.reduce(
      (sum, c) => sum + (typeof c.amount === "number" ? c.amount : 0),
      0
    );
    const expenseTotal = expenses.reduce((sum, e) => sum + (typeof e.amount === "number" ? e.amount : 0), 0);
    const netAfterExpenses = totalCollected - expenseTotal;

    const paidByMember = new Map<string, number>();
    for (const item of contributions) {
      const ref = item.member?._ref;
      if (!ref) continue;
      const current = paidByMember.get(ref) ?? 0;
      paidByMember.set(ref, current + (typeof item.amount === "number" ? item.amount : 0));
    }

    const memberYtdTotals: MemberYtdTotal[] = members.map((m) => ({
      memberId: m._id,
      memberName: m.name,
      paidTotal: paidByMember.get(m._id) ?? 0,
    }));

    const toMo = toMonth.slice(5, 7);
    const periodLabel = `1 Jan ${year} – ${toMo}/${year}`;

    return NextResponse.json(
      {
        scope: "ytd" as const,
        month,
        fromMonth,
        toMonth,
        periodLabel,
        generatedAt,
        summary: {
          totalCollected,
          expenseTotal,
          netAfterExpenses,
        },
        memberYtdTotals,
        contributions,
        expenses,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
