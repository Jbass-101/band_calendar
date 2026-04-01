import { BillIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

export const contributionExpense = defineType({
  name: "contributionExpense",
  title: "Contribution Expense",
  type: "document",
  icon: BillIcon,
  fields: [
    defineField({
      name: "date",
      title: "Expense Date",
      type: "date",
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
      name: "description",
      title: "Description",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "notes",
      title: "Notes",
      type: "text",
      rows: 2,
    }),
  ],
  preview: {
    select: { title: "description", amount: "amount", date: "date", month: "month" },
    prepare({ title, amount, date, month }) {
      return {
        title: typeof title === "string" ? title : "Expense",
        subtitle: [
          typeof date === "string" ? date : typeof month === "string" ? month : "",
          typeof amount === "number" ? `R${amount}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      };
    },
  },
});
