import { NETWORKS } from "./phone-utils"

export interface TopPlanStat {
  planId: string
  planName: string
  count: number
  amount: number
}

export interface NetworkAnalyticsItem {
  networkId: string
  name: string
  fullName: string
  brandColor: string
  bgLight: string
  borderLight: string
  textColor: string
  badgeBg: string
  gradient: string
  accentColor: string
  rank: number
  totalCount: number
  percentageOfTotalCount: number
  totalAmount: number
  percentageOfTotalAmount: number
  successCount: number
  failedCount: number
  pendingCount: number
  successRate: number
  uniqueSimsCount: number
  averageAmount: number
  topPlans: TopPlanStat[]
}

export interface AnalyticsSummary {
  totalDataCount: number
  totalDataAmount: number
  totalSuccessCount: number
  totalFailedCount: number
  overallSuccessRate: number
  uniquePhonesCount: number
  leaderNetwork: NetworkAnalyticsItem | null
  timeframe: string
  scope: "all" | "user"
  isAdmin: boolean
}

export interface RecentDataTransaction {
  id: string
  networkId: string
  networkName: string
  brandColor: string
  phone: string
  plan: string
  planName: string
  amount: number
  status: string
  reference: string
  provider: string | null
  serverName: string | null
  createdAt: string
  formattedDate: string
}

export interface DailyTrendItem {
  dateStr: string
  dayLabel: string
  mtnCount: number
  airtelCount: number
  gloCount: number
  nineMobileCount: number
  totalCount: number
}

export interface AirtimeComparisonItem {
  networkId: string
  name: string
  airtimeCount: number
  airtimeAmount: number
  dataCount: number
  dataAmount: number
}

export interface AnalyticsDataPayload {
  summary: AnalyticsSummary
  networkRankings: NetworkAnalyticsItem[]
  recentTransactions: RecentDataTransaction[]
  dailyTrends: DailyTrendItem[]
  airtimeComparison: AirtimeComparisonItem[]
}

export const NETWORK_METADATA: Record<
  string,
  {
    id: string
    name: string
    fullName: string
    brandColor: string
    bgLight: string
    borderLight: string
    textColor: string
    badgeBg: string
    gradient: string
    accentColor: string
  }
> = {
  "01": {
    id: "01",
    name: "MTN",
    fullName: "MTN Nigeria",
    brandColor: "#FFC300",
    bgLight: "bg-amber-500/10",
    borderLight: "border-amber-400/40",
    textColor: "text-amber-800 dark:text-amber-300",
    badgeBg: "bg-amber-100 text-amber-900 border-amber-300",
    gradient: "from-amber-400 via-yellow-500 to-amber-600",
    accentColor: "#EAB308",
  },
  "04": {
    id: "04",
    name: "Airtel",
    fullName: "Airtel Nigeria",
    brandColor: "#EF4444",
    bgLight: "bg-red-500/10",
    borderLight: "border-red-400/40",
    textColor: "text-red-800 dark:text-red-300",
    badgeBg: "bg-red-100 text-red-900 border-red-300",
    gradient: "from-red-500 via-rose-600 to-red-700",
    accentColor: "#EF4444",
  },
  "02": {
    id: "02",
    name: "Glo",
    fullName: "Globacom Nigeria",
    brandColor: "#10B981",
    bgLight: "bg-emerald-500/10",
    borderLight: "border-emerald-400/40",
    textColor: "text-emerald-800 dark:text-emerald-300",
    badgeBg: "bg-emerald-100 text-emerald-900 border-emerald-300",
    gradient: "from-emerald-500 via-teal-600 to-green-700",
    accentColor: "#10B981",
  },
  "03": {
    id: "03",
    name: "9Mobile",
    fullName: "9Mobile (Etisalat)",
    brandColor: "#059669",
    bgLight: "bg-teal-500/10",
    borderLight: "border-teal-400/40",
    textColor: "text-teal-800 dark:text-teal-300",
    badgeBg: "bg-teal-100 text-teal-900 border-teal-300",
    gradient: "from-teal-600 via-emerald-700 to-green-900",
    accentColor: "#0D9488",
  },
}

export function normalizeNetworkId(raw: string | null | undefined): string {
  if (!raw) return "01"
  const trimmed = raw.trim().toUpperCase()
  if (trimmed === "01" || trimmed.includes("MTN")) return "01"
  if (trimmed === "02" || trimmed.includes("GLO")) return "02"
  if (trimmed === "03" || trimmed.includes("9MOB") || trimmed.includes("ETIS")) return "03"
  if (trimmed === "04" || trimmed.includes("AIRT")) return "04"
  return trimmed
}

export function formatPlanFriendly(plan: string | null | undefined): string {
  if (!plan) return "Standard Data"
  const trimmed = plan.trim()
  const upper = trimmed.toUpperCase()
  if (upper.includes("GB") || upper.includes("MB") || upper.includes("TB")) {
    return trimmed
  }

  const num = parseFloat(trimmed)
  if (!isNaN(num)) {
    if (num >= 450 && num <= 550) return "500MB Data"
    if (num >= 950 && num <= 1050) return "1GB Data"
    if (num >= 1900 && num <= 2100) return "2GB Data"
    if (num >= 2800 && num <= 3200) return "3GB Data"
    if (num >= 4800 && num <= 5200) return "5GB Data"
    if (num >= 9800 && num <= 10200) return "10GB Data"
    if (num >= 150 && num <= 250) return "200MB Data"
    if (num >= 700 && num <= 850) return "750MB / 1GB Special"
    if (num >= 1400 && num <= 1600) return "1.5GB Data"
  }
  return `Plan ${trimmed}`
}

export function getTimeframeCutoff(timeframe: string): Date | null {
  const now = new Date()
  switch (timeframe) {
    case "today": {
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      return today
    }
    case "week": {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return weekAgo
    }
    case "30days": {
      const thirtyDays = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return thirtyDays
    }
    case "month": {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      return firstOfMonth
    }
    case "all":
    default:
      return null
  }
}
