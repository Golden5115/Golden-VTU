"use client"

import { useState, useTransition, useMemo } from "react"
import Link from "next/link"
import {
  Trophy,
  Award,
  TrendingUp,
  BarChart3,
  Wifi,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Zap,
  Layers,
  Sparkles,
  Smartphone,
  Activity,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AnalyticsDataPayload } from "@/lib/analytics-utils"
import { getDataAnalysisMetrics } from "@/actions/analytics.actions"

interface DataAnalysisDashboardProps {
  initialData: AnalyticsDataPayload
}

const TIMEFRAME_OPTIONS = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today (24h)" },
  { id: "week", label: "Last 7 Days" },
  { id: "month", label: "This Month" },
  { id: "30days", label: "Last 30 Days" },
]

export function DataAnalysisDashboard({ initialData }: DataAnalysisDashboardProps) {
  const [data, setData] = useState<AnalyticsDataPayload>(initialData)
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(initialData.summary.timeframe || "all")
  const [selectedScope, setSelectedScope] = useState<"all" | "user">(initialData.summary.scope || "all")
  const [selectedNetworkFilter, setSelectedNetworkFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isPending, startTransition] = useTransition()

  // Handle timeframe or scope changes by refetching via Server Action
  const handleFilterChange = (newTimeframe: string, newScope?: "all" | "user") => {
    const targetTimeframe = newTimeframe
    const targetScope = newScope || selectedScope
    setSelectedTimeframe(targetTimeframe)
    if (newScope) setSelectedScope(targetScope)

    startTransition(async () => {
      try {
        const updated = await getDataAnalysisMetrics({
          timeframe: targetTimeframe,
          scope: targetScope,
        })
        setData(updated)
      } catch (err) {
        console.error("Failed to update analytics data:", err)
      }
    })
  }

  const { summary, networkRankings, recentTransactions, dailyTrends, airtimeComparison } = data

  // Filter recent transactions based on search query, network filter, and status filter
  const filteredTransactions = useMemo(() => {
    return recentTransactions.filter((tx) => {
      const matchesSearch =
        searchQuery === "" ||
        tx.phone.includes(searchQuery) ||
        tx.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.planName.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesNetwork =
        selectedNetworkFilter === "all" || tx.networkId === selectedNetworkFilter

      const matchesStatus =
        statusFilter === "all" || tx.status.toUpperCase() === statusFilter.toUpperCase()

      return matchesSearch && matchesNetwork && matchesStatus
    })
  }, [recentTransactions, searchQuery, selectedNetworkFilter, statusFilter])

  // Export filtered transactions to CSV
  const handleExportCsv = () => {
    const headers = ["Reference", "Network", "Phone", "Plan", "Amount (NGN)", "Status", "Date"]
    const rows = filteredTransactions.map((tx) => [
      tx.reference,
      tx.networkName,
      tx.phone,
      `"${tx.planName}"`,
      tx.amount.toFixed(2),
      tx.status,
      `"${tx.formattedDate}"`,
    ])

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `golden_vtu_data_analysis_${selectedTimeframe}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Print Summary
  const handlePrint = () => {
    window.print()
  }

  const leader = summary.leaderNetwork

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 print:space-y-4">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-xs">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
                  Data Analysis Module
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <Sparkles className="w-3 h-3 text-blue-600" />
                  Live Intelligence
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                Comprehensive ranking and distribution analysis of network providers where data has been added
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {summary.isAdmin && (
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleFilterChange(selectedTimeframe, "all")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedScope === "all"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Platform Users
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange(selectedTimeframe, "user")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedScope === "user"
                    ? "bg-white text-blue-700 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                My Account
              </button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="text-xs h-9 gap-1.5 border-slate-200 hover:bg-slate-50"
            title="Download CSV export"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs h-9 gap-1.5 border-slate-200 hover:bg-slate-50 print:hidden"
            title="Print report"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Print
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFilterChange(selectedTimeframe)}
            disabled={isPending}
            className="text-xs h-9 px-2.5 text-slate-500 hover:text-slate-800"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin text-blue-600" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Timeframe Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pl-1 shrink-0">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          Time Period:
        </span>
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 shrink-0">
          {TIMEFRAME_OPTIONS.map((tf) => {
            const isActive = selectedTimeframe === tf.id
            return (
              <button
                key={tf.id}
                type="button"
                onClick={() => handleFilterChange(tf.id)}
                disabled={isPending}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isActive
                    ? "bg-white text-blue-700 shadow-xs font-bold border border-blue-100"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                {tf.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* TOP CHAMPION HERO BANNER: The Leading Network Provider */}
      {leader ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-6 md:p-8 shadow-xl border border-slate-800">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-wider">
                <Trophy className="w-4 h-4 text-amber-400" />
                #1 Highest Data Network Provider
              </div>

              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center font-black text-xl md:text-2xl shadow-lg border-2 border-white/20"
                  style={{ backgroundColor: leader.brandColor, color: leader.networkId === "01" ? "#000" : "#FFF" }}
                >
                  {leader.name}
                </div>
                <div>
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                    {leader.fullName}
                  </h2>
                  <p className="text-slate-300 text-xs md:text-sm mt-0.5">
                    Leads with the largest volume of data added across all subscribers
                  </p>
                </div>
              </div>

              {/* Champion Highlights */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/10">
                  <p className="text-[11px] text-slate-300 font-medium">Total Data Added</p>
                  <p className="text-xl font-black text-amber-300">
                    {leader.totalCount.toLocaleString()}{" "}
                    <span className="text-xs font-medium text-white">purchases</span>
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/10">
                  <p className="text-[11px] text-slate-300 font-medium">Share of Total Data</p>
                  <p className="text-xl font-black text-white">
                    {leader.percentageOfTotalCount}%
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/10">
                  <p className="text-[11px] text-slate-300 font-medium">Total Spending</p>
                  <p className="text-xl font-black text-emerald-400">
                    ₦{leader.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-white/10">
                  <p className="text-[11px] text-slate-300 font-medium">Success Rate</p>
                  <p className="text-xl font-black text-blue-300">
                    {leader.successRate}%
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
              <Link href={`/data`}>
                <Button className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-md flex items-center justify-center gap-2 h-11 px-5">
                  <Zap className="w-4 h-4 fill-current" />
                  Top Up {leader.name} Data Now
                </Button>
              </Link>
              <Link href="/transactions">
                <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 text-xs h-9">
                  View {leader.name} Transactions
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <Card className="p-8 text-center bg-slate-50 border-dashed">
          <Wifi className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-700">No Data Transactions in Selected Timeframe</h3>
          <p className="text-xs text-slate-500 mt-1">
            Try switching to &quot;All Time&quot; or topping up data on MTN, Airtel, or Glo.
          </p>
          <Link href="/data">
            <Button size="sm" className="mt-3 text-xs bg-blue-600">
              Purchase Data
            </Button>
          </Link>
        </Card>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Card 1: Total Data Added */}
        <Card className="border-slate-200/80 shadow-xs hover:border-blue-200 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500">Total Data Added</CardTitle>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Wifi className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">
              {summary.totalDataCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span className="font-bold text-emerald-600">{summary.totalSuccessCount}</span> successful additions
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Volume (₦) */}
        <Card className="border-slate-200/80 shadow-xs hover:border-blue-200 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500">Total Data Spend</CardTitle>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600">
              ₦{summary.totalDataAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Across all data plans & networks
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Unique Phone Numbers */}
        <Card className="border-slate-200/80 shadow-xs hover:border-blue-200 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500">Unique SIMs / Lines</CardTitle>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Smartphone className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">
              {summary.uniquePhonesCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Distinct mobile numbers topped up
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Overall Success Rate */}
        <Card className="border-slate-200/80 shadow-xs hover:border-blue-200 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500">Delivery Reliability</CardTitle>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">
              {summary.overallSuccessRate}%
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {summary.totalFailedCount} failed / refunded orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PROPORTIONAL MARKET SHARE VISUAL BAR */}
      <Card className="border-slate-200/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Network Provider Data Share Breakdown
              </CardTitle>
              <CardDescription className="text-xs">
                Visual proportional split of data additions across MTN, Airtel, Glo, and 9Mobile
              </CardDescription>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Total: {summary.totalDataCount} Additions
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stacked Proportional Bar */}
          <div className="h-6 w-full rounded-xl overflow-hidden flex bg-slate-100 shadow-inner border border-slate-200">
            {networkRankings.map((net) => {
              if (net.totalCount === 0) return null
              return (
                <div
                  key={net.networkId}
                  style={{
                    width: `${net.percentageOfTotalCount}%`,
                    backgroundColor: net.brandColor,
                  }}
                  className="h-full relative group transition-all duration-500 hover:opacity-90 flex items-center justify-center"
                  title={`${net.name}: ${net.totalCount} additions (${net.percentageOfTotalCount}%)`}
                >
                  {net.percentageOfTotalCount > 6 && (
                    <span
                      className="text-[11px] font-black drop-shadow-xs px-1 truncate"
                      style={{ color: net.networkId === "01" ? "#000" : "#FFF" }}
                    >
                      {net.name} {net.percentageOfTotalCount}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {networkRankings.map((net) => (
              <div
                key={net.networkId}
                className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50/70 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: net.brandColor }}
                  />
                  <span className="font-bold text-slate-800">{net.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-black text-slate-900">{net.totalCount}</span>
                  <span className="text-[10px] text-slate-500 ml-1">({net.percentageOfTotalCount}%)</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CORE FEATURE: NETWORK PROVIDER RANKINGS LEADERBOARD */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Network Provider Ranking (Highest to Lowest)
            </h2>
            <p className="text-xs text-slate-500">
              Ranked list of network providers by the highest number of data transactions added
            </p>
          </div>
          <Link href="/data">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1">
              Add Data
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        {/* Ranked Network Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {networkRankings.map((item) => {
            const isWinner = item.rank === 1 && item.totalCount > 0
            const rankBadgeColor =
              item.rank === 1
                ? "bg-amber-100 text-amber-800 border-amber-300"
                : item.rank === 2
                ? "bg-slate-200 text-slate-800 border-slate-300"
                : item.rank === 3
                ? "bg-amber-800/10 text-amber-900 border-amber-700/30"
                : "bg-slate-100 text-slate-600 border-slate-200"

            const rankMedal =
              item.rank === 1 ? "🥇 #1 Top Provider" : item.rank === 2 ? "🥈 #2 Provider" : item.rank === 3 ? "🥉 #3 Provider" : `#4 Provider`

            return (
              <Card
                key={item.networkId}
                className={`overflow-hidden transition-all duration-200 hover:shadow-md ${
                  isWinner
                    ? "border-amber-300 ring-2 ring-amber-400/20 bg-gradient-to-br from-amber-50/30 via-white to-white"
                    : "border-slate-200/80 bg-white"
                }`}
              >
                <div className="p-5 space-y-4">
                  {/* Card Header: Network Branding & Rank Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-sm border"
                        style={{
                          backgroundColor: item.brandColor,
                          color: item.networkId === "01" ? "#000" : "#FFF",
                        }}
                      >
                        {item.name}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-900 text-lg">{item.fullName}</h3>
                        </div>
                        <p className="text-xs text-slate-500 font-mono">
                          Network ID: {item.networkId} • {item.uniqueSimsCount} unique numbers
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full border shadow-2xs ${rankBadgeColor}`}
                    >
                      {rankMedal}
                    </span>
                  </div>

                  {/* Main Metric: Total Data Purchases Added */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Data Transactions Added
                      </p>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-2xl font-black text-slate-900">
                          {item.totalCount.toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-blue-600">
                          ({item.percentageOfTotalCount}% of total)
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Total Volume (₦)
                      </p>
                      <p className="text-lg font-black text-emerald-600 mt-0.5">
                        ₦{item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar of Total Data */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500 font-medium">
                      <span>Share of All Added Data</span>
                      <span className="font-bold text-slate-700">{item.percentageOfTotalCount}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${item.percentageOfTotalCount}%`,
                          backgroundColor: item.brandColor,
                        }}
                      />
                    </div>
                  </div>

                  {/* Secondary Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-100">
                      <p className="text-[10px] text-emerald-800 font-semibold">Success</p>
                      <p className="text-sm font-black text-emerald-700 mt-0.5">{item.successCount}</p>
                      <p className="text-[9px] text-emerald-600 font-medium">{item.successRate}% rate</p>
                    </div>

                    <div className="p-2 rounded-lg bg-rose-50/60 border border-rose-100">
                      <p className="text-[10px] text-rose-800 font-semibold">Failed</p>
                      <p className="text-sm font-black text-rose-700 mt-0.5">{item.failedCount}</p>
                      <p className="text-[9px] text-rose-600 font-medium">Auto-refunded</p>
                    </div>

                    <div className="p-2 rounded-lg bg-blue-50/60 border border-blue-100">
                      <p className="text-[10px] text-blue-800 font-semibold">Avg Order</p>
                      <p className="text-sm font-black text-blue-700 mt-0.5">₦{item.averageAmount.toFixed(0)}</p>
                      <p className="text-[9px] text-blue-600 font-medium">per transaction</p>
                    </div>
                  </div>

                  {/* Top Plans for this Network */}
                  {item.topPlans.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center justify-between">
                        <span>Most Popular Data Plans</span>
                        <span className="text-[10px] text-slate-400 font-normal">Count</span>
                      </p>
                      <div className="space-y-1">
                        {item.topPlans.map((plan) => (
                          <div
                            key={plan.planId}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded-md bg-slate-50 hover:bg-slate-100/80 transition-colors"
                          >
                            <span className="font-semibold text-slate-800 truncate">{plan.planName}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-xs font-bold text-slate-700">
                                {plan.count} orders
                              </span>
                              <span className="text-[10px] text-slate-500">
                                (₦{plan.amount.toLocaleString()})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTA Footer */}
                  <div className="pt-2 flex items-center justify-between gap-2">
                    <Link
                      href={`/transactions?network=${item.networkId}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                    >
                      History logs
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>

                    <Link href={`/data`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 font-bold border-slate-300 hover:bg-slate-100"
                      >
                        Top Up {item.name} Data
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* AIRTIME VS DATA COMPARISON TABLE */}
      <Card className="border-slate-200/80 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Carrier Product Comparison: Data vs Airtime Volume
          </CardTitle>
          <CardDescription className="text-xs">
            Compare transaction frequency and monetary volume between Data Bundles and Airtime across networks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Network Provider</th>
                  <th className="py-2.5 px-3">Data Count</th>
                  <th className="py-2.5 px-3">Data Volume (₦)</th>
                  <th className="py-2.5 px-3">Airtime Count</th>
                  <th className="py-2.5 px-3">Airtime Volume (₦)</th>
                  <th className="py-2.5 px-3">Total Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {airtimeComparison.map((row) => {
                  const meta = networkRankings.find((r) => r.networkId === row.networkId)
                  const totalCount = row.dataCount + row.airtimeCount
                  const totalAmount = row.dataAmount + row.airtimeAmount
                  return (
                    <tr key={row.networkId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: meta?.brandColor || "#64748B" }}
                        />
                        {row.name}
                      </td>
                      <td className="py-3 px-3 font-black text-blue-700">
                        {row.dataCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                        ₦{row.dataAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-700">
                        {row.airtimeCount.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                        ₦{row.airtimeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-slate-900">{totalCount} orders</span>
                        <span className="text-[10px] text-slate-500 block">
                          ₦{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 10-DAY DATA ACTIVITY & NETWORK DISTRIBUTION TIMELINE */}
      <Card className="border-slate-200/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                10-Day Data Addition Velocity & Daily Distribution
              </CardTitle>
              <CardDescription className="text-xs">
                Daily volume of data top-up transactions categorized by network carrier
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#FFC300]" /> MTN
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#EF4444]" /> Airtel
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#10B981]" /> Glo
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 items-end pt-4 pb-2">
            {(() => {
              const maxDaily = Math.max(...dailyTrends.map((d) => d.totalCount), 1)
              return dailyTrends.map((day) => {
                const heightPct = Math.max((day.totalCount / maxDaily) * 100, 8)
                const mtnPct = day.totalCount > 0 ? (day.mtnCount / day.totalCount) * 100 : 0
                const airtelPct = day.totalCount > 0 ? (day.airtelCount / day.totalCount) * 100 : 0
                const gloPct = day.totalCount > 0 ? (day.gloCount / day.totalCount) * 100 : 0

                return (
                  <div key={day.dateStr} className="flex flex-col items-center gap-1.5 group">
                    <span className="text-[10px] font-bold text-slate-600 opacity-80 group-hover:opacity-100">
                      {day.totalCount}
                    </span>
                    <div className="w-full bg-slate-100 rounded-t-md h-28 flex flex-col justify-end p-0.5 overflow-hidden">
                      <div
                        className="w-full rounded-xs flex flex-col overflow-hidden transition-all duration-500 shadow-2xs"
                        style={{ height: `${heightPct}%` }}
                        title={`${day.dayLabel}: ${day.totalCount} orders (MTN: ${day.mtnCount}, Airtel: ${day.airtelCount}, Glo: ${day.gloCount})`}
                      >
                        {gloPct > 0 && (
                          <div style={{ height: `${gloPct}%`, backgroundColor: "#10B981" }} />
                        )}
                        {airtelPct > 0 && (
                          <div style={{ height: `${airtelPct}%`, backgroundColor: "#EF4444" }} />
                        )}
                        {mtnPct > 0 && (
                          <div style={{ height: `${mtnPct}%`, backgroundColor: "#FFC300" }} />
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 truncate text-center max-w-full">
                      {day.dayLabel.split(",")[0] || day.dayLabel}
                    </span>
                  </div>
                )
              })
            })()}
          </div>
        </CardContent>
      </Card>

      {/* RECENT DATA ADDITIONS ACTIVITY EXPLORER */}
      <Card className="border-slate-200/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wifi className="w-4 h-4 text-blue-600" />
                Data Additions Activity Stream
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time log of data bundles added with network breakdown, recipient phone, and status
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search phone or plan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-8 w-full bg-slate-50"
                />
              </div>

              {/* Network Filter */}
              <select
                aria-label="Filter transactions by network provider"
                value={selectedNetworkFilter}
                onChange={(e) => setSelectedNetworkFilter(e.target.value)}
                className="text-xs h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Networks</option>
                <option value="01">MTN Only</option>
                <option value="04">Airtel Only</option>
                <option value="02">Glo Only</option>
                <option value="03">9Mobile Only</option>
              </select>

              {/* Status Filter */}
              <select
                aria-label="Filter transactions by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="SUCCESS">Successful Only</option>
                <option value="FAILED">Failed / Refunded</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-lg bg-slate-50/50">
              <Wifi className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No matching data transactions found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting your search query or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Network</th>
                    <th className="py-2.5 px-3">Recipient Phone</th>
                    <th className="py-2.5 px-3">Data Plan</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3 text-right">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Network Badge */}
                      <td className="py-2.5 px-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold shadow-2xs"
                          style={{
                            backgroundColor:
                              tx.networkId === "01"
                                ? "#FEF08A"
                                : tx.networkId === "04"
                                ? "#FEE2E2"
                                : tx.networkId === "02"
                                ? "#D1FAE5"
                                : "#CCFBF1",
                            color:
                              tx.networkId === "01"
                                ? "#713F12"
                                : tx.networkId === "04"
                                ? "#991B1B"
                                : tx.networkId === "02"
                                ? "#065F46"
                                : "#115E59",
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: tx.brandColor }}
                          />
                          {tx.networkName}
                        </span>
                      </td>

                      {/* Recipient Phone */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {tx.phone}
                      </td>

                      {/* Data Plan */}
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {tx.planName}
                      </td>

                      {/* Amount */}
                      <td className="py-2.5 px-3 font-black text-slate-900">
                        ₦{tx.amount.toFixed(2)}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        {tx.status === "SUCCESS" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            SUCCESS
                          </span>
                        ) : tx.status === "FAILED" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            FAILED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            PENDING
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 text-slate-500 font-medium">
                        {tx.formattedDate}
                      </td>

                      {/* Reference */}
                      <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-400">
                        {tx.reference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
