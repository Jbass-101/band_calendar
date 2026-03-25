import { defineField, defineType } from "sanity";
import { CalendarIcon } from "@sanity/icons";

export const rehearsal = defineType({
  name: "rehearsal",
  title: "Rehearsal",
  type: "document",
  icon: CalendarIcon,
  fields: [
    defineField({
      name: "date",
      title: "Rehearsal Date",
      type: "date",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "name",
      title: "Name (personal note)",
      type: "string",
      description: "Optional label for your own reference.",
    }),
    defineField({
      name: "repeatEveryDays",
      title: "Repeat every (days)",
      type: "number",
      description: "Leave empty to create a one-time rehearsal. If set, occurrences repeat every N days.",
      validation: (rule) =>
        rule.custom((value) => {
          if (value === undefined || value === null) return true;
          if (typeof value !== "number" || Number.isNaN(value)) return true;

          if (!Number.isInteger(value) || value < 1) {
            return "repeatEveryDays must be an integer >= 1";
          }
          return true;
        }),
    }),
    defineField({
      name: "untilDate",
      title: "Repeat until",
      type: "date",
      hidden: ({ parent }) => {
        const repeat = (parent as Record<string, unknown> | undefined)?.repeatEveryDays;
        return repeat === undefined || repeat === null || repeat === "";
      },
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context?.parent as Record<string, unknown> | undefined;
          const repeat = parent?.repeatEveryDays;

          const repeatSet =
            repeat !== undefined && repeat !== null && repeat !== "" && typeof repeat === "number";

          if (!repeatSet) return true;
          if (!value) return "untilDate is required when repeatEveryDays is set";
          return true;
        }),
    }),
  ],
});

