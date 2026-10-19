import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { getDataAnalysisMetrics } from "@/actions/analytics.actions"
import { DataAnalysisDashboard } from "@/components/analytics/DataAnalysisDashboard"
import { isAnalyticsServerEnabled } from "@/lib/feature-flags"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Admin Network Data Analysis | Golden VTU",
  description: "Platform-wide network provider ranking and data analysis.",
}

export default async function AdminAnalyticsPage() {
  const isEnabled = await isAnalyticsServerEnabled()
  if (!isEnabled) {
    redirect("/admin/dashboard")
  }

  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })

  if (user?.role !== "ADMIN") {
    redirect("/dashboard")
  }

  const initialData = await getDataAnalysisMetrics({
    timeframe: "all",
    scope: "all",
  })

  return <DataAnalysisDashboard initialData={initialData} />
}
