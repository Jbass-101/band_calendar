import { defineArrayMember, defineField, defineType } from "sanity";
import { UserIcon } from "@sanity/icons";

const ROLE_OPTIONS = [
  { title: "Lead Vocal", value: "Lead Vocal" },
  { title: "Tenor", value: "Tenor" },
  { title: "Alto", value: "Alto" },
  { title: "Soprano", value: "Soprano" },
  { title: "Committee Member", value: "Committee Member" },
  { title: "Lead Keyboard", value: "Lead Keyboard" },
  { title: "Aux Keyboard", value: "Aux Keyboard" },
  { title: "Lead Guitar", value: "Lead Guitar" },
  { title: "Bass Guitar", value: "Bass Guitar" },
  { title: "Drummer", value: "Drummer" },
  { title: "MD", value: "MD" },
];

export const musician = defineType({
  name: "musician",
  title: "Musician",
  type: "document",
  icon: UserIcon,
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "roles",
      title: "Roles",
      type: "array",
      of: [
        defineArrayMember({
          type: "string",
          options: {
            list: ROLE_OPTIONS,
          },
        }),
      ],
      options: {
        layout: "grid",
      },
      validation: (rule) =>
        rule
          .required()
          .min(1)
          .custom((roles) => {
            if (!Array.isArray(roles)) return true;
            const unique = new Set(roles);
            if (unique.size !== roles.length) {
              return "Roles must not contain duplicates.";
            }
            return true;
          }),
    }),
    defineField({
      name: "whatsapp",
      title: "WhatsApp number",
      type: "string",
      description:
        "International format with country code (e.g. 27821234567). Used for reminders from the contributions page.",
      validation: (rule) =>
        rule.custom((value) => {
          if (value == null || value === "") return true;
          const digits = String(value).replace(/\D/g, "");
          if (digits.length < 8 || digits.length > 15) {
            return "Use 8–15 digits including country code.";
          }
          return true;
        }),
    }),
  ],
});

