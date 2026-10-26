import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { getActiveServers, resolveServerAndProvider } from "@/services/providers/provider.factory"
import { FleetTroubleshootClient } from "./FleetTroubleshootClient"

export const metadata = {
  title: "Troubleshoot Section | Car Tracker Nigeria",
  description: "Live Car Tracker Nigeria fleet diagnostic telemetry and SIM data bundle management",
}

export default async function FleetTroubleshootPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { walletBalance: true },
  })
  const walletBalance = user?.walletBalance || 0

  const rawServers = await getActiveServers()
  const servers = rawServers.map((s) => ({
    id: s.id,
    serverName: s.serverName,
    serverCode: s.serverCode,
    status: s.status,
    isDefault: s.isDefault,
  }))

  const { provider } = await resolveServerAndProvider()
  let availablePlans: any[] = []
  try {
    const rawPlans = await provider.getDataPlans()
    const { applyCustomPricing } = await import("@/services/pricing.service")
    availablePlans = await applyCustomPricing(rawPlans, provider.identifier)
  } catch (err) {
    console.error("[FleetTroubleshootPage] Failed to fetch data plans:", err)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <FleetTroubleshootClient
        initialWalletBalance={walletBalance}
        servers={servers}
        availablePlans={availablePlans}
      />
    </div>
  )
}
