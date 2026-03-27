import { CreditCardIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

type ContextLike = {
  document?: {
    _id?: string;
  };
  getClient: (opts: { apiVersion: string }) => {
    fetch: <T>(query: string, params?: Record<string, unknown>) => Promise<T>;
  };
};

export const contribution = defineType({
  name: "contribution",
  title: "Contribution",
  type: "document",
  icon: CreditCardIcon,
  fields: [
    defineField({
      name: "member",
      title: "Member",
      type: "reference",
      to: [{ type: "musician" }],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "month",
      title: "Month",
      type: "date",
      description: "Use the 1st day of the month (YYYY-MM-01).",
      validation: (rule) =>
        rule
          .required()
          .custom((value) => {
            if (typeof value !== "string") return true;
            const day = value.split("-")[2];
            if (day !== "01") return "Month must use the first day (YYYY-MM-01).";
            return true;
          }),
    }),
    defineField({
      name: "amount",
      title: "Amount",
      type: "number",
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: "paid",
      title: "Paid",
      type: "boolean",
      initialValue: false,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "paidDate",
      title: "Paid Date",
      type: "date",
      hidden: ({ parent }) => {
        const paid = (parent as { paid?: boolean } | undefined)?.paid;
        return !paid;
      },
    }),
    defineField({
      name: "notes",
      title: "Notes",
      type: "text",
      rows: 3,
    }),
  ],
  validation: (rule) =>
    rule.custom(async (doc, context: ContextLike) => {
      const data = (doc ?? {}) as {
        member?: { _ref?: string };
        month?: string;
      };
      const memberId = data.member?._ref;
      const month = data.month;
      if (!memberId || !month) return true;

      const currentId = context.document?._id ?? "";
      const client = context.getClient({ apiVersion: "2026-03-25" });
      const duplicates = await client.fetch<Array<{ _id: string }>>(
        `*[_type == "contribution" && member._ref == $memberId && month == $month && _id != $currentId][0...1]{ _id }`,
        { memberId, month, currentId }
      );

      if (Array.isArray(duplicates) && duplicates.length > 0) {
        return "A contribution for this member and month already exists.";
      }

      return true;
    }),
});

