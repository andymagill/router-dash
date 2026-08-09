import { APP_VERSION, GITHUB_REPO } from "@/lib/types"

export interface FeedbackDiagnostics {
  modelIds?: string[]
  page?: string
  userAgent?: string
}

/**
 * Build a prefilled GitHub "new issue" URL. Only safe diagnostics are included:
 * app version, browser user agent, current page, and selected model IDs.
 * Prompt text, model outputs, API keys, and run history are NEVER included.
 */
export function buildFeedbackUrl(diag: FeedbackDiagnostics = {}): string {
  const models =
    diag.modelIds && diag.modelIds.length > 0
      ? diag.modelIds.join(", ")
      : "(none selected)"

  const body = [
    "<!-- Thanks for the feedback! Describe the issue or idea below. -->",
    "",
    "## What happened?",
    "",
    "",
    "## Steps to reproduce",
    "",
    "",
    "---",
    "### Diagnostics (safe to share)",
    `- App version: ${APP_VERSION}`,
    `- Page: ${diag.page ?? "/"}`,
    `- Selected models: ${models}`,
    `- User agent: ${diag.userAgent ?? "unknown"}`,
  ].join("\n")

  const params = new URLSearchParams({
    title: "[Feedback] ",
    body,
    labels: "feedback",
  })

  return `https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`
}
