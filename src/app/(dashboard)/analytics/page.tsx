import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getDataAnalysisMetrics } from "@/actions/analytics.actions"
import { DataAnalysisDashboard } from "@/components/analytics/DataAnalysisDashboard"
import { isAnalyticsServerEnabled } from "@/lib/feature-flags"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Data Analysis & Network Rankings | Golden VTU",
  description: "Analyze highest data additions by telecom network provider (MTN, Airtel, Glo, 9Mobile).",
}

export default async function AnalyticsPage() {
  const isEnabled = await isAnalyticsServerEnabled()
  if (!isEnabled) {
    redirect("/dashboard")
  }

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const initialData = await getDataAnalysisMetrics({
    timeframe: "all",
  })

  return <DataAnalysisDashboard initialData={initialData} />
}
