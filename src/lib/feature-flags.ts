/**
 * Feature flag for the Data Analysis module.
 * - Always ENABLED on local development (npm run dev / NODE_ENV === "development") or on localhost.
 * - HIDDEN on deployed production domains until you are ready to launch it.
 * - Can be explicitly enabled via ENABLE_DATA_ANALYSIS="true" or NEXT_PUBLIC_ENABLE_DATA_ANALYSIS="true".
 */
export function isAnalyticsFeatureEnabled(showAnalyticsProp?: boolean): boolean {
  if (typeof showAnalyticsProp === "boolean") {
    return showAnalyticsProp
  }

  // 1. Explicit environment toggle (for future full production deployment)
  if (
    process.env.ENABLE_DATA_ANALYSIS === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_DATA_ANALYSIS === "true" ||
    process.env.ENABLE_ANALYTICS === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true"
  ) {
    return true
  }

  // 2. Active development environment (always true on localhost `npm run dev`)
  if (process.env.NODE_ENV === "development") {
    return true
  }

  return false
}

export const isAnalyticsServerEnabled = isAnalyticsFeatureEnabled
export const isAnalyticsClientEnabled = isAnalyticsFeatureEnabled
