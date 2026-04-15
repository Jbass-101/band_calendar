import { defineField, defineType } from "sanity";
import { TagIcon } from "@sanity/icons";

export const songTheme = defineType({
  name: "songTheme",
  title: "Song Theme",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({
      name: "title",
      title: "Theme Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "active",
      title: "Active",
      description: "Disable to hide this theme from song pickers.",
      type: "boolean",
      initialValue: true,
    }),
  ],
  preview: {
    select: { title: "title", active: "active" },
    prepare(selection) {
      return {
        title: selection.title ?? "Untitled theme",
        subtitle: selection.active === false ? "Inactive" : "Active",
      };
    },
  },
});
