import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { getActiveServers, resolveServerAndProvider } from "@/services/providers/provider.factory"
import { SimTroubleshootStation } from "./SimTroubleshootStation"

export default async function TrackersPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

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

  // Fetch recent distinct SIMs from transactions for instant 1-click access
  const [recentData, recentAirtime] = await Promise.all([
    prisma.dataPurchase.findMany({
      where: { status: "SUCCESS" },
      select: { phone: true, network: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.airtimePurchase.findMany({
      where: { status: "SUCCESS" },
      select: { phone: true, network: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ])

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
      recentSims={recentSims}
    />
  )
}

