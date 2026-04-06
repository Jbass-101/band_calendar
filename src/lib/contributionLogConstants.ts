/** Shared event type strings for contribution audit logs (Sanity + API + UI). */

export const CONTRIBUTION_LOG_EVENT_TYPES = [
  "contribution.create",
  "contribution.update",
  "contribution.delete",
  "expense.create",
  "expense.update",
  "expense.delete",
  "settings.update",
  "auth.unlock_success",
  "auth.unlock_failed",
  "auth.sign_out",
  "statement.download_month",
  "statement.download_ytd",
  "musician.whatsapp_update",
] as const;

export type ContributionLogEventType = (typeof CONTRIBUTION_LOG_EVENT_TYPES)[number];
