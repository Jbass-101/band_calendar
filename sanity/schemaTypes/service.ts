import { defineField, defineType } from "sanity";
import { CalendarIcon } from "@sanity/icons";

const ROLE_OPTIONS = [
  { title: "Lead Vocal", value: "Lead Vocal" },
  { title: "Lead Keyboard", value: "Lead Keyboard" },
  { title: "Aux Keyboard", value: "Aux Keyboard" },
  { title: "Lead Guitar", value: "Lead Guitar" },
  { title: "Bass Guitar", value: "Bass Guitar" },
  { title: "Drummer", value: "Drummer" },
  { title: "MD", value: "MD" },
];

const ROLE_FILTERS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [
    r.value,
    `"${r.value}" in roles`,
  ])
);

function getRefId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const ref = obj._ref;
  return typeof ref === "string" ? ref : null;
}

type SanityClientLike = {
  fetch: <T>(query: string, params: Record<string, unknown>) => Promise<T>;
};

type ValidationContextLike = {
  getClient: (opts: { apiVersion: string }) => SanityClientLike;
};

function createRoleField(roleName: string, fieldName: string) {
  return defineField({
    name: fieldName,
    title: roleName,
    type: "array",
    of: [
      {
        type: "reference",
        to: [{ type: "musician" }],
        options: {
          filter: ROLE_FILTERS[roleName],
        },
      },
    ],
    validation: (rule) =>
      rule.custom(async (value: unknown, context: ValidationContextLike) => {
        if (value === undefined || value === null) return true;
        if (!Array.isArray(value)) return true;

        const refs = value
          .map((item) => getRefId(item))
          .filter((id): id is string => Boolean(id));

        // Prevent selecting the same musician more than once for one role.
        const uniqueRefs = new Set(refs);
        if (uniqueRefs.size !== refs.length) {
          return `Duplicate musicians are not allowed for "${roleName}".`;
        }

        if (refs.length === 0) return true;

        const client = context.getClient({ apiVersion: "2026-03-25" });
        const musicians = await client.fetch<Array<{ _id: string; roles?: string[] }>>(
          `*[_id in $ids]{ _id, roles }`,
          { ids: refs }
        );

        const rolesById = new Map(
          musicians.map((m) => [m._id, Array.isArray(m.roles) ? m.roles : []] as const)
        );

        for (const refId of refs) {
          const musicianRoles = rolesById.get(refId) ?? [];
          if (!musicianRoles.includes(roleName)) {
            return `Each selected musician must include "${roleName}" in their roles[].`;
          }
        }

        return true;
      }),
  });
}

export const service = defineType({
  name: "service",
  title: "Service",
  type: "document",
  icon: CalendarIcon,
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "date",
      title: "Service Date",
      type: "date",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "notes",
      title: "Custom Notes",
      description: "Optional bullet-point notes shown below the service title.",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "variant",
      title: "Card Color",
      description: "Optional highlight color for this service card.",
      type: "string",
      initialValue: "default",
      options: {
        list: [
          { title: "Default", value: "default" },
          { title: "Blue", value: "blue" },
          { title: "Green", value: "green" },
        ],
        layout: "radio",
      },
    }),
    defineField({
      name: "showBandDetails",
      title: "Show instrumentalists and uniform",
      description: "Disable this for services that should only show title/notes.",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "uniform",
      title: "Uniform",
      type: "string",
      description: "Service dress code (defaults to Smart Casual).",
      initialValue: "Smart Casual",
    }),
    defineField({
      name: "uniformWomen",
      title: "Women Uniform",
      type: "string",
      description: "Service dress code for women. Falls back to Uniform if empty.",
      initialValue: "Smart Casual",
    }),
    defineField({
      name: "uniformMen",
      title: "Men Uniform",
      type: "string",
      description: "Service dress code for men. Falls back to Uniform if empty.",
      initialValue: "Smart Casual",
    }),
    createRoleField("Lead Vocal", "leadVocal"),
    createRoleField("Lead Keyboard", "leadKeyboard"),
    createRoleField("Aux Keyboard", "auxKeyboard"),
    createRoleField("Lead Guitar", "leadGuitar"),
    createRoleField("Bass Guitar", "bassGuitar"),
    createRoleField("Drummer", "drummer"),
    createRoleField("MD", "md"),
  ],
});

