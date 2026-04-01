import { DocumentTextIcon } from "@sanity/icons";
import { defineField, defineType } from "sanity";

export const contributionLog = defineType({
  name: "contributionLog",
  title: "Contribution log",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: "timestamp",
      title: "Timestamp",
      type: "datetime",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "eventType",
      title: "Event type",
      type: "string",
      validation: (rule) => rule.required(),
      options: {
        list: [
          { title: "Contribution created", value: "contribution.create" },
          { title: "Contribution updated", value: "contribution.update" },
          { title: "Contribution deleted", value: "contribution.delete" },
          { title: "Expense created", value: "expense.create" },
          { title: "Expense updated", value: "expense.update" },
          { title: "Expense deleted", value: "expense.delete" },
          { title: "Settings updated", value: "settings.update" },
          { title: "Unlock success", value: "auth.unlock_success" },
          { title: "Unlock failed", value: "auth.unlock_failed" },
          { title: "Sign out", value: "auth.sign_out" },
          { title: "Statement month PNG", value: "statement.download_month" },
          { title: "Statement YTD PNG", value: "statement.download_ytd" },
        ],
        layout: "dropdown",
      },
    }),
    defineField({
      name: "action",
      title: "Action",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "entityType",
      title: "Entity",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "entityId",
      title: "Entity ID",
      type: "string",
    }),
    defineField({
      name: "month",
      title: "Month",
      type: "date",
      description: "Optional month anchor (YYYY-MM-01).",
    }),
    defineField({
      name: "summary",
      title: "Summary",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "details",
      title: "Details",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "deviceId",
      title: "Device ID",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "ip",
      title: "IP",
      type: "string",
    }),
    defineField({
      name: "userAgent",
      title: "User agent",
      type: "text",
      rows: 2,
    }),
  ],
  preview: {
    select: { title: "summary", subtitle: "eventType", timestamp: "timestamp" },
    prepare({ title, subtitle, timestamp }) {
      return {
        title: typeof title === "string" ? title : "Log",
        subtitle: [typeof timestamp === "string" ? timestamp : "", typeof subtitle === "string" ? subtitle : ""]
          .filter(Boolean)
          .join(" · "),
      };
    },
  },
  orderings: [
    {
      title: "Newest first",
      name: "timestampDesc",
      by: [{ field: "timestamp", direction: "desc" }],
    },
  ],
});
