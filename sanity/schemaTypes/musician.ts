import { defineArrayMember, defineField, defineType } from "sanity";
import { UserIcon } from "@sanity/icons";

const ROLE_OPTIONS = [
  { title: "Lead Vocal", value: "Lead Vocal" },
  { title: "Tenor", value: "Tenor" },
  { title: "Alto", value: "Alto" },
  { title: "Soprano", value: "Soprano" },
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
  ],
});

