import { defineField, defineType } from "sanity";
import { TagIcon } from "@sanity/icons";

export const songTag = defineType({
  name: "songTag",
  title: "Song Tag",
  type: "document",
  icon: TagIcon,
  fields: [
    defineField({
      name: "title",
      title: "Tag Name",
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
      description: "Disable to hide this tag from song pickers.",
      type: "boolean",
      initialValue: true,
    }),
  ],
  preview: {
    select: { title: "title", active: "active" },
    prepare(selection) {
      return {
        title: selection.title ?? "Untitled tag",
        subtitle: selection.active === false ? "Inactive" : "Active",
      };
    },
  },
});
