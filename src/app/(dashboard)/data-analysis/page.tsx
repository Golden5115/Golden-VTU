import { redirect } from "next/navigation"
import { isAnalyticsServerEnabled } from "@/lib/feature-flags"

export default async function DataAnalysisAliasPage() {
  const isEnabled = await isAnalyticsServerEnabled()
  if (!isEnabled) {
    redirect("/dashboard")
  }
  redirect("/analytics")
}
