import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { getActiveServers, resolveServerAndProvider } from "@/services/providers/provider.factory"
import { SimTroubleshootStation } from "./SimTroubleshootStation"

import { NETWORKS } from "@/lib/phone-utils"
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

  const servers = await getActiveServers()
  const { provider } = await resolveServerAndProvider()
  let availablePlans: any[] = []
  try {
    availablePlans = await provider.getDataPlans()
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
    ...recentData.map((d) => ({
      id: d.id,
      type: "DATA" as const,
      label: `Data Bundle (${d.plan})`,
      planName: d.plan,
      phone: d.phone,
      networkId: d.network,
      networkName: NETWORKS[d.network]?.name || d.network,
      amount: d.amount,
      status: d.status,
      isRefunded: d.status === "FAILED",
      reference: d.reference,
      date: d.createdAt.toISOString(),
      rawDate: d.createdAt.getTime(),
    })),
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

