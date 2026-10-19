"use server"

import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import type { Prisma } from "@prisma/client"
import { NETWORKS, format12HourDateTime } from "@/lib/phone-utils"

import {
  NETWORK_METADATA,
  normalizeNetworkId,
  formatPlanFriendly,
  getTimeframeCutoff,
  type TopPlanStat,
  type NetworkAnalyticsItem,
  type AnalyticsSummary,
  type RecentDataTransaction,
  type DailyTrendItem,
  type AirtimeComparisonItem,
  type AnalyticsDataPayload,
} from "@/lib/analytics-utils"

export async function getDataAnalysisMetrics(options?: {
  timeframe?: string
  scope?: "all" | "user"
  networkId?: string
}): Promise<AnalyticsDataPayload> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  })

  const isAdmin = currentUser?.role === "ADMIN"
  const requestedScope = options?.scope || (isAdmin ? "all" : "user")
  const activeScope: "all" | "user" = isAdmin ? requestedScope : "user"

  const timeframe = options?.timeframe || "all"
  const cutoffDate = getTimeframeCutoff(timeframe)

  // Build Prisma Where Clause for DataPurchase
  const where: Prisma.DataPurchaseWhereInput = {}

  if (activeScope === "user") {
    where.userId = session.user.id
  }

  if (cutoffDate) {
    where.createdAt = { gte: cutoffDate }
  }

  if (options?.networkId && options.networkId !== "all") {
    where.network = options.networkId
  }

  // 1. Fetch all matching Data Purchases
  const [dataPurchases, airtimePurchases] = await Promise.all([
    prisma.dataPurchase.findMany({
      where,
      select: {
        id: true,
        network: true,
        plan: true,
        phone: true,
        amount: true,
        reference: true,
        status: true,
        provider: true,
        serverName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.airtimePurchase.findMany({
      where: activeScope === "user" ? { userId: session.user.id } : {},
      select: {
        network: true,
        amount: true,
        status: true,
      },
    }),
  ])

  // Aggregate stats per network
  const networkBuckets: Record<
    string,
    {
      networkId: string
      totalCount: number
      totalAmount: number
      successCount: number
      failedCount: number
      pendingCount: number
      uniquePhones: Set<string>
      plansMap: Record<string, { count: number; amount: number }>
    }
  > = {
    "01": {
      networkId: "01",
      totalCount: 0,
      totalAmount: 0,
      successCount: 0,
      failedCount: 0,
      pendingCount: 0,
      uniquePhones: new Set(),
      plansMap: {},
    },
    "04": {
      networkId: "04",
      totalCount: 0,
      totalAmount: 0,
      successCount: 0,
      failedCount: 0,
      pendingCount: 0,
      uniquePhones: new Set(),
      plansMap: {},
    },
    "02": {
      networkId: "02",
      totalCount: 0,
      totalAmount: 0,
      successCount: 0,
      failedCount: 0,
      pendingCount: 0,
      uniquePhones: new Set(),
      plansMap: {},
    },
    "03": {
      networkId: "03",
      totalCount: 0,
      totalAmount: 0,
      successCount: 0,
      failedCount: 0,
      pendingCount: 0,
      uniquePhones: new Set(),
      plansMap: {},
    },
  }

  const globalUniquePhones = new Set<string>()
  let totalDataCount = 0
  let totalDataAmount = 0
  let totalSuccessCount = 0
  let totalFailedCount = 0

  for (const item of dataPurchases) {
    const netId = normalizeNetworkId(item.network)
    if (!networkBuckets[netId]) {
      networkBuckets[netId] = {
        networkId: netId,
        totalCount: 0,
        totalAmount: 0,
        successCount: 0,
        failedCount: 0,
        pendingCount: 0,
        uniquePhones: new Set(),
        plansMap: {},
      }
    }

    const bucket = networkBuckets[netId]
    bucket.totalCount += 1
    bucket.totalAmount += item.amount || 0

    totalDataCount += 1
    totalDataAmount += item.amount || 0

    if (item.status === "SUCCESS") {
      bucket.successCount += 1
      totalSuccessCount += 1
    } else if (item.status === "FAILED") {
      bucket.failedCount += 1
      totalFailedCount += 1
    } else {
      bucket.pendingCount += 1
    }

    if (item.phone) {
      bucket.uniquePhones.add(item.phone)
      globalUniquePhones.add(item.phone)
    }

    const planKey = item.plan || "unknown"
    if (!bucket.plansMap[planKey]) {
      bucket.plansMap[planKey] = { count: 0, amount: 0 }
    }
    bucket.plansMap[planKey].count += 1
    bucket.plansMap[planKey].amount += item.amount || 0
  }

  // Convert network buckets to ranked array sorted by totalCount DESCENDING
  const rawRankings = Object.values(networkBuckets).map((bucket) => {
    const meta =
      NETWORK_METADATA[bucket.networkId] || {
        id: bucket.networkId,
        name: NETWORKS[bucket.networkId]?.name || `Network ${bucket.networkId}`,
        fullName: NETWORKS[bucket.networkId]?.name || `Network ${bucket.networkId}`,
        brandColor: NETWORKS[bucket.networkId]?.color || "#64748B",
        bgLight: "bg-slate-100",
        borderLight: "border-slate-300",
        textColor: "text-slate-800",
        badgeBg: "bg-slate-100 text-slate-800 border-slate-300",
        gradient: "from-slate-500 to-slate-700",
        accentColor: "#64748B",
      }

    const percentageOfTotalCount =
      totalDataCount > 0 ? (bucket.totalCount / totalDataCount) * 100 : 0
    const percentageOfTotalAmount =
      totalDataAmount > 0 ? (bucket.totalAmount / totalDataAmount) * 100 : 0
    const successRate =
      bucket.totalCount > 0 ? (bucket.successCount / bucket.totalCount) * 100 : 0
    const averageAmount =
      bucket.totalCount > 0 ? bucket.totalAmount / bucket.totalCount : 0

    // Top plans sorted by count
    const topPlans: TopPlanStat[] = Object.entries(bucket.plansMap)
      .map(([planId, stat]) => ({
        planId,
        planName: formatPlanFriendly(planId),
        count: stat.count,
        amount: stat.amount,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)

    return {
      networkId: bucket.networkId,
      name: meta.name,
      fullName: meta.fullName,
      brandColor: meta.brandColor,
      bgLight: meta.bgLight,
      borderLight: meta.borderLight,
      textColor: meta.textColor,
      badgeBg: meta.badgeBg,
      gradient: meta.gradient,
      accentColor: meta.accentColor,
      rank: 0,
      totalCount: bucket.totalCount,
      percentageOfTotalCount: Number(percentageOfTotalCount.toFixed(1)),
      totalAmount: Number(bucket.totalAmount.toFixed(2)),
      percentageOfTotalAmount: Number(percentageOfTotalAmount.toFixed(1)),
      successCount: bucket.successCount,
      failedCount: bucket.failedCount,
      pendingCount: bucket.pendingCount,
      successRate: Number(successRate.toFixed(1)),
      uniqueSimsCount: bucket.uniquePhones.size,
      averageAmount: Number(averageAmount.toFixed(2)),
      topPlans,
    }
  })

  // Sort strictly by highest number of data transactions added
  rawRankings.sort((a, b) => {
    if (b.totalCount !== a.totalCount) {
      return b.totalCount - a.totalCount
    }
    return b.totalAmount - a.totalAmount
  })

  // Assign ranks: 1, 2, 3, 4
  const networkRankings: NetworkAnalyticsItem[] = rawRankings.map((item, index) => ({
    ...item,
    rank: index + 1,
  }))

  const leaderNetwork = networkRankings.length > 0 && networkRankings[0].totalCount > 0
    ? networkRankings[0]
    : null

  const overallSuccessRate =
    totalDataCount > 0 ? Number(((totalSuccessCount / totalDataCount) * 100).toFixed(1)) : 0

  const summary: AnalyticsSummary = {
    totalDataCount,
    totalDataAmount: Number(totalDataAmount.toFixed(2)),
    totalSuccessCount,
    totalFailedCount,
    overallSuccessRate,
    uniquePhonesCount: globalUniquePhones.size,
    leaderNetwork,
    timeframe,
    scope: activeScope,
    isAdmin,
  }

  // Format latest 25 transactions for explorer view
  const recentTransactions: RecentDataTransaction[] = dataPurchases.slice(0, 25).map((tx) => {
    const netId = normalizeNetworkId(tx.network)
    const meta = NETWORK_METADATA[netId]
    const dt = format12HourDateTime(tx.createdAt)

    return {
      id: tx.id,
      networkId: netId,
      networkName: meta?.name || NETWORKS[netId]?.name || tx.network,
      brandColor: meta?.brandColor || NETWORKS[netId]?.color || "#6B7280",
      phone: tx.phone,
      plan: tx.plan,
      planName: formatPlanFriendly(tx.plan),
      amount: tx.amount,
      status: tx.status,
      reference: tx.reference,
      provider: tx.provider,
      serverName: tx.serverName,
      createdAt: tx.createdAt.toISOString(),
      formattedDate: dt.full,
    }
  })

  // Calculate 10-day daily trends for visual activity chart
  const dailyTrendsMap = new Map<
    string,
    { mtn: number; airtel: number; glo: number; nineMobile: number; total: number; label: string }
  >()

  const now = new Date()
  for (let i = 9; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateKey = d.toISOString().split("T")[0]
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" })
    dailyTrendsMap.set(dateKey, { mtn: 0, airtel: 0, glo: 0, nineMobile: 0, total: 0, label: dayLabel })
  }

  for (const item of dataPurchases) {
    const dateKey = item.createdAt.toISOString().split("T")[0]
    const entry = dailyTrendsMap.get(dateKey)
    if (entry) {
      const netId = normalizeNetworkId(item.network)
      if (netId === "01") entry.mtn += 1
      else if (netId === "04") entry.airtel += 1
      else if (netId === "02") entry.glo += 1
      else if (netId === "03") entry.nineMobile += 1
      entry.total += 1
    }
  }

  const dailyTrends: DailyTrendItem[] = Array.from(dailyTrendsMap.entries()).map(
    ([dateStr, data]) => ({
      dateStr,
      dayLabel: data.label,
      mtnCount: data.mtn,
      airtelCount: data.airtel,
      gloCount: data.glo,
      nineMobileCount: data.nineMobile,
      totalCount: data.total,
    })
  )

  // Compare Airtime vs Data by network
  const airtimeByNet: Record<string, { count: number; amount: number }> = {
    "01": { count: 0, amount: 0 },
    "04": { count: 0, amount: 0 },
    "02": { count: 0, amount: 0 },
    "03": { count: 0, amount: 0 },
  }

  for (const at of airtimePurchases) {
    const netId = normalizeNetworkId(at.network)
    if (!airtimeByNet[netId]) airtimeByNet[netId] = { count: 0, amount: 0 }
    airtimeByNet[netId].count += 1
    airtimeByNet[netId].amount += at.amount || 0
  }

  const airtimeComparison: AirtimeComparisonItem[] = ["01", "04", "02", "03"].map((id) => {
    const meta = NETWORK_METADATA[id]
    const dataBucket = networkBuckets[id]
    const atBucket = airtimeByNet[id] || { count: 0, amount: 0 }
    return {
      networkId: id,
      name: meta?.name || id,
      airtimeCount: atBucket.count,
      airtimeAmount: Number(atBucket.amount.toFixed(2)),
      dataCount: dataBucket?.totalCount || 0,
      dataAmount: Number((dataBucket?.totalAmount || 0).toFixed(2)),
    }
  })

  return {
    summary,
    networkRankings,
    recentTransactions,
    dailyTrends,
    airtimeComparison,
  }
}
