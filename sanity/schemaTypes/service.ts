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
      name: "leadVocal",
      title: "Lead Vocal",
      type: "reference",
      to: [{ type: "musician" }],
      options: {
        filter: ROLE_FILTERS["Lead Vocal"],
      },
      validation: (rule) =>
        rule.custom(async (value: unknown, context: ValidationContextLike) => {
          const refId = getRefId(value);
          if (!refId) return true;

          const client = context.getClient({ apiVersion: "2026-03-25" });
          const musician = await client.fetch<{ roles?: string[] }>(
            `*[_id == $id][0]{ roles }`,
            { id: refId }
          );

          const musicianRoles = Array.isArray(musician?.roles)
            ? musician.roles
            : [];

          if (!musicianRoles.includes("Lead Vocal")) {
            return `Selected musician must include "Lead Vocal" in their roles[].`;
          }
          return true;
        }),
    }),
    defineField({
      name: "leadKeyboard",
      title: "Lead Keyboard",
      type: "reference",
      to: [{ type: "musician" }],
      options: {
        filter: ROLE_FILTERS["Lead Keyboard"],
      },
      validation: (rule) =>
        rule.custom(async (value: unknown, context: ValidationContextLike) => {
          const refId = getRefId(value);
          if (!refId) return true;

          const client = context.getClient({ apiVersion: "2026-03-25" });
          const musician = await client.fetch<{ roles?: string[] }>(
            `*[_id == $id][0]{ roles }`,
            { id: refId }
          );

          const musicianRoles = Array.isArray(musician?.roles)
            ? musician.roles
            : [];

          if (!musicianRoles.includes("Lead Keyboard")) {
            return `Selected musician must include "Lead Keyboard" in their roles[].`;
          }
          return true;
        }),
    }),
    defineField({
      name: "auxKeyboard",
      title: "Aux Keyboard",
      type: "reference",
      to: [{ type: "musician" }],
      options: {
        filter: ROLE_FILTERS["Aux Keyboard"],
      },
      validation: (rule) =>
        rule.custom(async (value: unknown, context: ValidationContextLike) => {
          const refId = getRefId(value);
          if (!refId) return true;

          const client = context.getClient({ apiVersion: "2026-03-25" });
          const musician = await client.fetch<{ roles?: string[] }>(
            `*[_id == $id][0]{ roles }`,
            { id: refId }
          );

          const musicianRoles = Array.isArray(musician?.roles)
            ? musician.roles
            : [];

          if (!musicianRoles.includes("Aux Keyboard")) {
            return `Selected musician must include "Aux Keyboard" in their roles[].`;
          }
          return true;
        }),
    }),
    defineField({
      name: "leadGuitar",
      title: "Lead Guitar",
      type: "reference",
      to: [{ type: "musician" }],
      options: {
        filter: ROLE_FILTERS["Lead Guitar"],
      },
      validation: (rule) =>
        rule.custom(async (value: unknown, context: ValidationContextLike) => {
          const refId = getRefId(value);
          if (!refId) return true;

          const client = context.getClient({ apiVersion: "2026-03-25" });
          const musician = await client.fetch<{ roles?: string[] }>(
            `*[_id == $id][0]{ roles }`,
            { id: refId }
          );

          const musicianRoles = Array.isArray(musician?.roles)
            ? musician.roles
            : [];

          if (!musicianRoles.includes("Lead Guitar")) {
            return `Selected musician must include "Lead Guitar" in their roles[].`;
          }
          return true;
        }),
    }),
    defineField({
      name: "bassGuitar",
      title: "Bass Guitar",
      type: "reference",
      to: [{ type: "musician" }],
      options: {
        filter: ROLE_FILTERS["Bass Guitar"],
      },
      validation: (rule) =>
        rule.custom(async (value: unknown, context: ValidationContextLike) => {
          const refId = getRefId(value);
          if (!refId) return true;

          const client = context.getClient({ apiVersion: "2026-03-25" });
          const musician = await client.fetch<{ roles?: string[] }>(
            `*[_id == $id][0]{ roles }`,
            { id: refId }
          );

          const musicianRoles = Array.isArray(musician?.roles)
            ? musician.roles
            : [];

          if (!musicianRoles.includes("Bass Guitar")) {
            return `Selected musician must include "Bass Guitar" in their roles[].`;
          }
          return true;
        }),
    }),
    defineField({
      name: "drummer",
      title: "Drummer",
      type: "reference",
      to: [{ type: "musician" }],
      options: {
        filter: ROLE_FILTERS["Drummer"],
      },
      validation: (rule) =>
        rule.custom(async (value: unknown, context: ValidationContextLike) => {
          const refId = getRefId(value);
          if (!refId) return true;

          const client = context.getClient({ apiVersion: "2026-03-25" });
          const musician = await client.fetch<{ roles?: string[] }>(
            `*[_id == $id][0]{ roles }`,
            { id: refId }
          );

          const musicianRoles = Array.isArray(musician?.roles)
            ? musician.roles
            : [];

          if (!musicianRoles.includes("Drummer")) {
            return `Selected musician must include "Drummer" in their roles[].`;
          }
          return true;
        }),
    }),
    defineField({
      name: "md",
      title: "MD",
      type: "reference",
      to: [{ type: "musician" }],
      options: {
        filter: ROLE_FILTERS["MD"],
      },
      validation: (rule) =>
        rule.custom(async (value: unknown, context: ValidationContextLike) => {
          const refId = getRefId(value);
          if (!refId) return true;

          const client = context.getClient({ apiVersion: "2026-03-25" });
          const musician = await client.fetch<{ roles?: string[] }>(
            `*[_id == $id][0]{ roles }`,
            { id: refId }
          );

          const musicianRoles = Array.isArray(musician?.roles)
            ? musician.roles
            : [];

          if (!musicianRoles.includes("MD")) {
            return `Selected musician must include "MD" in their roles[].`;
          }
          return true;
        }),
    }),
  ],
});

