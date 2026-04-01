import { LockIcon } from "@sanity/icons";
import { defineArrayMember, defineField, defineType } from "sanity";

export const contributionAccess = defineType({
  name: "contributionAccess",
  title: "Contribution Access",
  type: "document",
  icon: LockIcon,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      initialValue: "Contributions Login",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "password",
      title: "Fixed Password",
      type: "string",
      description: "Password used to unlock the /contributions page.",
      validation: (rule) => rule.required().min(4),
    }),
    defineField({
      name: "nonCommitteeTarget",
      title: "Non-Committee Monthly Target",
      type: "number",
      description: "Latest non-committee amount (also used when target history is empty). Default R100.",
      initialValue: 100,
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: "committeeTarget",
      title: "Committee Monthly Target",
      type: "number",
      description: "Latest committee amount (also used when target history is empty). Default R250.",
      initialValue: 250,
      validation: (rule) => rule.required().min(0),
    }),
    defineField({
      name: "targetHistory",
      title: "Target history",
      type: "array",
      description:
        "Effective-dated targets: each row applies from effectiveFrom through until the next row. Used so past months keep old targets.",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "effectiveFrom",
              title: "Effective from",
              type: "date",
              description: "First day of month (YYYY-MM-01).",
              validation: (rule) =>
                rule.required().custom((value) => {
                  if (typeof value !== "string") return true;
                  const day = value.split("-")[2];
                  if (day !== "01") return "Must be the first day of a month (YYYY-MM-01).";
                  return true;
                }),
            }),
            defineField({
              name: "nonCommitteeTarget",
              title: "Non-committee",
              type: "number",
              validation: (rule) => rule.required().min(0),
            }),
            defineField({
              name: "committeeTarget",
              title: "Committee",
              type: "number",
              validation: (rule) => rule.required().min(0),
            }),
          ],
          preview: {
            select: {
              effectiveFrom: "effectiveFrom",
              nonCommitteeTarget: "nonCommitteeTarget",
              committeeTarget: "committeeTarget",
            },
            prepare({ effectiveFrom, nonCommitteeTarget, committeeTarget }) {
              return {
                title: typeof effectiveFrom === "string" ? effectiveFrom : "Row",
                subtitle: `Non ${nonCommitteeTarget ?? "—"} · Committee ${committeeTarget ?? "—"}`,
              };
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "title" },
    prepare({ title }) {
      return {
        title: typeof title === "string" && title.trim() ? title : "Contributions Login",
        subtitle: "Edit this password to change access",
      };
    },
  },
});

