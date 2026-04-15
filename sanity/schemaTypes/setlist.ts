import { defineArrayMember, defineField, defineType } from "sanity";
import { DocumentTextIcon } from "@sanity/icons";

const SERVICE_TYPE_OPTIONS = [
  { title: "Sunday Morning", value: "sunday_morning" },
  { title: "Sunday Evening", value: "sunday_evening" },
  { title: "Midweek", value: "midweek" },
  { title: "Special Service", value: "special" },
];

export const setlist = defineType({
  name: "setlist",
  title: "Setlist",
  type: "document",
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: "title",
      title: "Setlist Title",
      type: "string",
      description: "Optional display title, e.g. Youth Sunday Setlist.",
    }),
    defineField({
      name: "date",
      title: "Service Date",
      type: "date",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "serviceType",
      title: "Service Type",
      type: "string",
      options: {
        list: SERVICE_TYPE_OPTIONS,
        layout: "radio",
      },
      initialValue: "sunday_morning",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "songs",
      title: "Songs (in order)",
      description: "Drag to reorder. This sequence is the setlist flow.",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "song",
              title: "Song",
              type: "reference",
              to: [{ type: "song" }],
              options: {
                filter: "active != false",
              },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "note",
              title: "Item Note",
              type: "string",
              description: "Optional transition or arrangement note for this slot.",
            }),
          ],
          preview: {
            select: {
              title: "song.name",
              number: "song.number",
              note: "note",
            },
            prepare(selection) {
              const songName = selection.title ?? "Song";
              const number = typeof selection.number === "number" ? `#${selection.number}` : "#?";
              const note = typeof selection.note === "string" && selection.note.trim() ? ` • ${selection.note}` : "";
              return {
                title: `${number} ${songName}${note}`,
              };
            },
          },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "notes",
      title: "Setlist Notes",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "active",
      title: "Active",
      description: "Disable to archive this setlist.",
      type: "boolean",
      initialValue: true,
    }),
  ],
  preview: {
    select: {
      title: "title",
      date: "date",
      serviceType: "serviceType",
    },
    prepare(selection) {
      const dateLabel = typeof selection.date === "string" ? selection.date : "No date";
      const typeLabel =
        typeof selection.serviceType === "string" ? selection.serviceType.replaceAll("_", " ") : "service";
      return {
        title: selection.title ?? `Setlist ${dateLabel}`,
        subtitle: `${dateLabel} • ${typeLabel}`,
      };
    },
  },
});
