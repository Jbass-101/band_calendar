import { NextResponse } from "next/server";
import {
  getContribAuthCookieName,
  isContribSessionValidFromCookie,
} from "@/src/lib/sanity/contributionsAuth";
import {
  resolveTargetsForMonth,
  type TargetHistoryRow,
} from "@/src/lib/sanity/contributionTargets";
import {
  applyDeviceCookieToResponse,
  extractRequestMeta,
  getDeviceIdForRequest,
  writeContributionLogSafe,
} from "@/src/lib/sanity/contributionLogs";
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

type ContributionSettings = {
  nonCommitteeTarget: number;
  committeeTarget: number;
  effectiveFrom: string | null;
};

type ExpenseRecord = {
  _id: string;
  date?: string | null;
  month: string;
  amount: number;
  description: string;
  notes?: string | null;
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
  // Accept YYYY-MM and convert to YYYY-MM-01.
  if (/^\d{4}-\d{2}$/.test(input)) return `${input}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m] = input.split("-");
    return `${y}-${m}-01`;
  }
  throw new Error("Invalid month format. Use YYYY-MM.");
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
    const year = month.slice(0, 4);
    const fromYtd = `${year}-01-01`;

    const client = getSanityWriteClient();
    const [contributions, members, accessRaw, expenses, ytdContributionAmounts, ytdExpenseAmounts] =
      await Promise.all([
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
        client.fetch<Array<{ amount?: number }>>(
          `*[_type == "contribution" && month >= $fromYtd && month <= $toYtd]{ amount }`,
          { fromYtd, toYtd: month }
        ),
        client.fetch<Array<{ amount?: number }>>(
          `*[_type == "contributionExpense" && month >= $fromYtd && month <= $toYtd]{ amount }`,
          { fromYtd, toYtd: month }
        ),
      ]);

    const flatNon = typeof accessRaw?.nonCommitteeTarget === "number" ? accessRaw.nonCommitteeTarget : 0;
    const flatCom = typeof accessRaw?.committeeTarget === "number" ? accessRaw.committeeTarget : 0;
    const resolved = resolveTargetsForMonth(month, accessRaw?.targetHistory ?? null, flatNon, flatCom);
    const settings: ContributionSettings = {
      nonCommitteeTarget: resolved.nonCommitteeTarget,
      committeeTarget: resolved.committeeTarget,
      effectiveFrom: resolved.effectiveFrom,
    };

    const totalCollected = contributions.reduce((sum, c) => sum + (typeof c.amount === "number" ? c.amount : 0), 0);
    const expenseTotal = expenses.reduce((sum, e) => sum + (typeof e.amount === "number" ? e.amount : 0), 0);
    const netAfterExpenses = totalCollected - expenseTotal;

    const ytdTotalCollected = ytdContributionAmounts.reduce(
      (sum, row) => sum + (typeof row.amount === "number" ? row.amount : 0),
      0
    );
    const ytdExpenseTotal = ytdExpenseAmounts.reduce(
      (sum, row) => sum + (typeof row.amount === "number" ? row.amount : 0),
      0
    );
    const ytdNetAfterExpenses = ytdTotalCollected - ytdExpenseTotal;

    const paidByMember = new Map<string, number>();
    for (const item of contributions) {
      const ref = item.member?._ref;
      if (!ref) continue;
      const current = paidByMember.get(ref) ?? 0;
      paidByMember.set(ref, current + (typeof item.amount === "number" ? item.amount : 0));
    }

    const dashboardRows = members.map((member) => {
      const roles = Array.isArray(member.roles) ? member.roles : [];
      const isCommittee = roles.includes("Committee Member");
      const expectedAmount = isCommittee ? settings.committeeTarget : settings.nonCommitteeTarget;
      const paidAmount = paidByMember.get(member._id) ?? 0;
      const balance = paidAmount - expectedAmount;

      let status: "paid" | "partial" | "owed" | "overpaid" = "paid";
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

    return NextResponse.json(
      {
        month,
        contributions,
        members,
        settings,
        dashboardRows,
        expenses,
        totalCollected,
        expenseTotal,
        netAfterExpenses,
        ytdFromMonth: fromYtd,
        ytdToMonth: month,
        ytdTotalCollected,
        ytdExpenseTotal,
        ytdNetAfterExpenses,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      memberId?: string;
      month?: string;
      amount?: number;
      paid?: boolean;
      paidDate?: string | null;
      notes?: string | null;
    };

    if (!body.memberId || typeof body.amount !== "number") {
      return NextResponse.json(
        { error: "Missing required fields: memberId, amount" },
        { status: 400 }
      );
    }

    const monthInput = body.month ?? (typeof body.paidDate === "string" ? body.paidDate.slice(0, 7) : undefined);
    if (!monthInput) {
      return NextResponse.json({ error: "Missing month or paidDate" }, { status: 400 });
    }
    const month = normalizeMonth(monthInput);
    const amount = Number(body.amount);
    const paid = typeof body.paid === "boolean" ? body.paid : true;
    const paidDate = body.paidDate ?? null;
    const notes = typeof body.notes === "string" ? body.notes : null;

    const client = getSanityWriteClient();
    const { deviceId, needsNewCookie } = getDeviceIdForRequest(req);
    const meta = extractRequestMeta(req);
    const existing = await client.fetch<Array<{ _id: string }>>(
      `*[_type == "contribution" && member._ref == $memberId && month == $month][0...1]{ _id }`,
      { memberId: body.memberId, month }
    );

    const patch = {
      member: { _type: "reference", _ref: body.memberId },
      month,
      amount,
      paid,
      paidDate,
      notes,
    };

    let contributionId: string;
    const isUpdate = existing.length > 0;
    if (isUpdate) {
      contributionId = existing[0]._id;
      await client.patch(contributionId).set(patch).commit();
    } else {
      const created = await client.create({
        _type: "contribution",
        ...patch,
      });
      contributionId = created._id;
    }

    const memberName = await client.fetch<string | null>(
      `*[_type == "musician" && _id == $id][0].name`,
      { id: body.memberId }
    );
    await writeContributionLogSafe(client, {
      eventType: isUpdate ? "contribution.update" : "contribution.create",
      action: isUpdate ? "update" : "create",
      entityType: "contribution",
      entityId: contributionId,
      month,
      summary: `${isUpdate ? "Updated" : "Created"} contribution R${amount.toFixed(2)} for ${memberName ?? body.memberId} (${month.slice(0, 7)})`,
      deviceId,
      ...meta,
    });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    if (needsNewCookie) applyDeviceCookieToResponse(res, deviceId);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      id?: string;
      memberId?: string;
      amount?: number;
      paidDate?: string | null;
      notes?: string | null;
    };

    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const client = getSanityWriteClient();
    const existing = await client.fetch<{
      _id: string;
      member?: { _ref?: string } | null;
      month?: string;
      amount?: number;
      paidDate?: string | null;
      notes?: string | null;
    } | null>(
      `*[_type == "contribution" && _id == $id][0]{ _id, member, month, amount, paidDate, notes }`,
      { id }
    );

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const memberId = body.memberId ?? existing.member?._ref;
    if (!memberId) {
      return NextResponse.json({ error: "Missing member" }, { status: 400 });
    }

    const amount =
      typeof body.amount === "number" && !Number.isNaN(body.amount)
        ? body.amount
        : typeof existing.amount === "number"
          ? existing.amount
          : NaN;
    if (Number.isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const paidDate =
      typeof body.paidDate === "string" && body.paidDate.trim().length > 0
        ? body.paidDate.trim()
        : existing.paidDate ?? null;
    if (!paidDate) {
      return NextResponse.json({ error: "Paid date is required" }, { status: 400 });
    }

    const month = normalizeMonth(paidDate.slice(0, 7));
    const notes =
      typeof body.notes === "string" ? body.notes.trim() || null : (existing.notes ?? null);

    const conflict = await client.fetch<Array<{ _id: string }>>(
      `*[_type == "contribution" && member._ref == $memberId && month == $month && _id != $id][0...1]{ _id }`,
      { memberId, month, id }
    );

    if (conflict.length > 0) {
      return NextResponse.json(
        { error: "Another entry already exists for this member in the target month." },
        { status: 409 }
      );
    }

    await client
      .patch(id)
      .set({
        member: { _type: "reference", _ref: memberId },
        month,
        amount,
        paid: true,
        paidDate,
        notes,
      })
      .commit();

    const { deviceId, needsNewCookie } = getDeviceIdForRequest(req);
    const meta = extractRequestMeta(req);
    const memberName = await client.fetch<string | null>(
      `*[_type == "musician" && _id == $mid][0].name`,
      { mid: memberId }
    );
    await writeContributionLogSafe(client, {
      eventType: "contribution.update",
      action: "update",
      entityType: "contribution",
      entityId: id,
      month,
      summary: `Updated contribution R${amount.toFixed(2)} for ${memberName ?? memberId} (${month.slice(0, 7)})`,
      deviceId,
      ...meta,
    });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    if (needsNewCookie) applyDeviceCookieToResponse(res, deviceId);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing id query param" }, { status: 400 });
    }

    const client = getSanityWriteClient();
    const existing = await client.fetch<{
      _id: string;
      month?: string;
      amount?: number;
      member?: { _ref?: string } | null;
    } | null>(
      `*[_type == "contribution" && _id == $id][0]{ _id, month, amount, member }`,
      { id }
    );
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const memberRef = existing.member?._ref;
    const memberName =
      memberRef &&
      (await client.fetch<string | null>(`*[_type == "musician" && _id == $mid][0].name`, { mid: memberRef }));
    const amt = typeof existing.amount === "number" ? existing.amount : 0;

    await client.delete(id);

    const { deviceId, needsNewCookie } = getDeviceIdForRequest(req);
    const meta = extractRequestMeta(req);
    await writeContributionLogSafe(client, {
      eventType: "contribution.delete",
      action: "delete",
      entityType: "contribution",
      entityId: id,
      month: existing.month,
      summary: `Deleted contribution R${amt.toFixed(2)} for ${memberName ?? memberRef ?? "member"} (${(existing.month ?? "").slice(0, 7) || "?"})`,
      deviceId,
      ...meta,
    });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    if (needsNewCookie) applyDeviceCookieToResponse(res, deviceId);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

