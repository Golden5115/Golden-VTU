import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { getActiveServers, resolveServerAndProvider } from "@/services/providers/provider.factory"
import { SimTroubleshootStation } from "./SimTroubleshootStation"

import { NETWORKS, formatPlanDisplayName } from "@/lib/phone-utils"
import { reconcilePendingTransactions } from "@/services/vtu.service"

export default async function TrackersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Auto-reconcile pending transactions with carrier
  await reconcilePendingTransactions(session.user.id)

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
    sortOrder: s.sortOrder,
  }))
  const { provider } = await resolveServerAndProvider()
  let availablePlans: any[] = []
  try {
    const rawPlans = await provider.getDataPlans()
    const { applyCustomPricing } = await import("@/services/pricing.service")
    availablePlans = await applyCustomPricing(rawPlans, provider.identifier)
  } catch (err) {
    console.error("[TrackersPage] Failed to fetch data plans for quick top-up:", err)
  }

  // Fetch recent 15 transactions for the user
  const [recentData, recentAirtime] = await Promise.all([
    prisma.dataPurchase.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.airtimePurchase.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  const recentTransactions = [
    ...recentData.map((d) => {
      const formattedPlan = formatPlanDisplayName(d.plan, d.network)
      return {
        id: d.id,
        type: "DATA" as const,
        label: `Data Bundle (${formattedPlan})`,
        planName: formattedPlan,
        phone: d.phone,
        networkId: d.network,
        networkName: NETWORKS[d.network]?.name || d.network,
        amount: d.amount,
        status: d.status,
        isRefunded: d.status === "FAILED",
        reference: d.reference,
        date: d.createdAt.toISOString(),
        rawDate: d.createdAt.getTime(),
        serverName: d.serverName || (d.serverId ? "Server" : "Server 1"),
        provider: d.provider || "CLUBKONNECT",
      }
    }),
    ...recentAirtime.map((a) => ({
      id: a.id,
      type: "AIRTIME" as const,
      label: "Airtime Top-up",
      planName: `₦${a.amount} Airtime`,
      phone: a.phone,
      networkId: a.network,
      networkName: NETWORKS[a.network]?.name || a.network,
      amount: a.amount,
      status: a.status,
      isRefunded: a.status === "FAILED",
      reference: a.reference,
      date: a.createdAt.toISOString(),
      rawDate: a.createdAt.getTime(),
      serverName: a.serverName || (a.serverId ? "Server" : "Server 1"),
      provider: a.provider || "CLUBKONNECT",
    })),
  ]
    .sort((a, b) => b.rawDate - a.rawDate)
    .slice(0, 15)
    .map(({ rawDate, ...rest }) => rest)

  // Aggregate distinct phone numbers
  const simMap = new Map<string, { phone: string; network: string; lastDate: Date }>()
  for (const item of [...recentData, ...recentAirtime]) {
    const existing = simMap.get(item.phone)
    if (!existing || item.createdAt > existing.lastDate) {
      simMap.set(item.phone, {
        phone: item.phone,
        network: item.network || "01",
        lastDate: item.createdAt,
      })
    }
  }

  const recentSims = Array.from(simMap.values())
    .sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime())
    .slice(0, 15)
    .map((s) => ({
      phone: s.phone,
      network: s.network,
      lastDate: s.lastDate.toISOString(),
    }))

  return (
    <SimTroubleshootStation
      walletBalance={walletBalance}
      servers={servers}
      availablePlans={availablePlans}
      recentTransactions={recentTransactions}
      recentSims={recentSims}
    />
  )
}

