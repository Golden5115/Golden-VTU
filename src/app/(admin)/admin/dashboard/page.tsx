import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, CreditCard, Activity, Wallet, BarChart3, Trophy, ArrowRight, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { resolveServerAndProvider } from "@/services/providers/provider.factory"
import { NETWORKS } from "@/lib/phone-utils"
import { isAnalyticsServerEnabled } from "@/lib/feature-flags"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const showAnalytics = await isAnalyticsServerEnabled()

  // Fetch High-level Metrics
  const totalUsers = await prisma.user.count()
  
  const totalWalletBalances = await prisma.user.aggregate({
    _sum: { walletBalance: true }
  })

  const totalAirtimeSales = await prisma.airtimePurchase.aggregate({
    where: { status: "SUCCESS" },
    _sum: { amount: true }
  })

  const totalDataSales = await prisma.dataPurchase.aggregate({
    where: { status: "SUCCESS" },
    _sum: { amount: true }
  })

  const totalVolume = (totalAirtimeSales._sum.amount || 0) + (totalDataSales._sum.amount || 0)

  // Dynamic Provider Balance
  let activeServerTitle = "Active Server Balance"
  let serverBalance = "N/A"
  try {
    const { server, provider } = await resolveServerAndProvider()
    activeServerTitle = `${server.serverName} Balance`
    const balanceData = await provider.getWalletBalance()
    serverBalance = `₦${balanceData.balance.toLocaleString()}`
  } catch (e) {
    console.error("Failed to fetch active server balance:", e)
  }

  // Recent Users
  const recentUsers = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, createdAt: true }
  })

  // Network Provider Data Ranking Aggregation
  const networkDataPurchases = showAnalytics
    ? await prisma.dataPurchase.groupBy({
        by: ["network"],
        _count: { id: true },
        _sum: { amount: true },
      })
    : []

  const networkRankings = networkDataPurchases
    .map((item) => {
      const netInfo = NETWORKS[item.network] || { name: item.network, color: "#64748B" }
      return {
        id: item.network,
        name: netInfo.name,
        color: netInfo.color,
        count: item._count.id,
        amount: item._sum.amount || 0,
      }
    })
    .sort((a, b) => b.count - a.count)

  const totalDataCount = networkRankings.reduce((sum, n) => sum + n.count, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Platform metrics, server health, and subscriber telemetry
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/pricing">
            <Button variant="outline" className="text-xs font-bold gap-1.5 border-amber-300 hover:bg-amber-50 text-amber-900 shadow-xs">
              <Coins className="w-4 h-4 text-amber-500" />
              Data Pricing
            </Button>
          </Link>
          {showAnalytics && (
            <Link href="/admin/analytics">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 shadow-xs">
                <BarChart3 className="w-4 h-4" />
                Full Data Analysis Module
              </Button>
            </Link>
          )}
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">System Wallet Balances</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{(totalWalletBalances._sum.walletBalance || 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total money currently in user wallets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Sales Volume</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{totalVolume.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Successful Airtime & Data sales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium truncate" title={activeServerTitle}>{activeServerTitle}</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serverBalance}</div>
            <p className="text-xs text-muted-foreground">Active provider wallet balance</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className={showAnalytics ? "col-span-4" : "col-span-7"}>
          <CardHeader>
            <CardTitle>Recent Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {recentUsers.map((user: any) => (
                <div key={user.id} className="flex items-center">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="ml-auto font-medium text-sm text-muted-foreground">
                    {user.createdAt.toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Network Provider Data Ranking Leaderboard Card */}
        {showAnalytics && (
          <Card className="col-span-3">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Network Data Leaderboard
                </CardTitle>
                <CardDescription className="text-xs">
                  Highest data additions by telecom carrier
                </CardDescription>
              </div>
              <Link href="/admin/analytics" className="text-xs font-semibold text-blue-600 hover:underline flex items-center">
                Details
                <ArrowRight className="w-3 h-3 ml-0.5" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {networkRankings.map((net, idx) => {
                const percent = totalDataCount > 0 ? ((net.count / totalDataCount) * 100).toFixed(1) : 0
                return (
                  <div key={net.id} className="p-2.5 rounded-lg border bg-slate-50/70 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] text-white shadow-xs"
                          style={{ backgroundColor: net.color, color: net.id === "01" ? "#000" : "#FFF" }}
                        >
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-slate-800">{net.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-slate-900">{net.count} purchases</span>
                        <span className="text-[10px] text-muted-foreground ml-1">({percent}%)</span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${percent}%`, backgroundColor: net.color }}
                      />
                    </div>
                  </div>
                )
              })}

              <div className="pt-2">
                <Link href="/admin/analytics">
                  <Button variant="outline" size="sm" className="w-full text-xs font-bold border-slate-300">
                    Open Interactive Analytics Module
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
