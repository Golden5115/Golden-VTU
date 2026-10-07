import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CreditCard, Car, Wifi, ShieldAlert, Clock, ArrowRight, Plus } from "lucide-react"
import { verifyPayment } from "@/services/paystack.service"
import { getTrackers } from "@/actions/tracker.actions"
import { Button } from "@/components/ui/button"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  
  const userId = session.user.id
  const resolvedSearchParams = await searchParams

  // Fallback for local testing: If we redirected back with a reference, verify it directly
  if (resolvedSearchParams?.reference) {
    const reference = Array.isArray(resolvedSearchParams.reference)
      ? resolvedSearchParams.reference[0]
      : resolvedSearchParams.reference
    try {
      const paymentData = await verifyPayment(reference)
      if (paymentData.status === "success") {
        const existingTx = await prisma.walletTransaction.findUnique({
          where: { reference: reference },
        })

        if (!existingTx) {
          await prisma.$transaction(async (tx: any) => {
            const amountInNaira = paymentData.amount / 100
            
            await tx.walletTransaction.create({
              data: {
                userId: userId,
                amount: amountInNaira,
                type: "CREDIT",
                status: "SUCCESS",
                reference: reference,
              },
            })

            await tx.user.update({
              where: { id: userId },
              data: { walletBalance: { increment: amountInNaira } },
            })
          })
        }
      }
      redirect("/dashboard")
    } catch (error) {
      console.error("Verification error:", error)
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { walletBalance: true },
  })

  const { trackers, metrics } = await getTrackers()

  const transactions = await prisma.walletTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  // Critical trackers needing immediate attention
  const urgentTrackers = trackers.filter((t) => t.isDataExpired || t.isExpiringSoon)

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            Monitor GPS tracker SIM validity, data expiry, and top-up airtime
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/trackers">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5">
              <Car className="w-4 h-4" />
              Tracker SIM Station
            </Button>
          </Link>
        </div>
      </div>

      {/* Critical Fleet Alert Banner (Troubleshooting highlight) */}
      {metrics.expired > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-rose-900">
                {metrics.expired} Tracker SIM{metrics.expired > 1 ? "s have" : " has"} EXPIRED data!
              </h2>
              <p className="text-xs text-rose-700">
                These GPS devices cannot transmit telemetry packets to your tracking server. Top them up to restore tracking.
              </p>
            </div>
          </div>
          <Link href="/trackers">
            <Button size="sm" variant="destructive" className="shrink-0 text-xs">
              Troubleshoot SIMs Now
            </Button>
          </Link>
        </div>
      )}

      {/* Primary KPI Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Wallet Balance */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600">Wallet Balance</CardTitle>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              ₦{user?.walletBalance.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Available for airtime & data recharge</p>
          </CardContent>
        </Card>

        {/* Card 2: Total Trackers Monitored */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-gray-600">Fleet SIMs</CardTitle>
            <Car className="w-4 h-4 text-slate-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{metrics.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.active} active • {metrics.expiringSoon} expiring
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Data Active Ratio */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-emerald-700">Data Transmitting</CardTitle>
            <Wifi className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{metrics.active}</div>
            <p className="text-xs text-emerald-600/80 mt-1">Online & valid GPRS data</p>
          </CardContent>
        </Card>

        {/* Card 4: Action Required */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-rose-700">Action Required</CardTitle>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-700">
              {metrics.expired + metrics.expiringSoon}
            </div>
            <p className="text-xs text-rose-600/80 mt-1">
              {metrics.expired} expired • {metrics.expiringSoon} expiring soon
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Urgent Trackers & Recent Transactions */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
        {/* Urgent Trackers Card */}
        <Card className="col-span-1 lg:col-span-4 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base text-gray-900">Fleet SIM Health Watchlist</CardTitle>
              <CardDescription>
                Vehicles whose SIM data has expired or is expiring within 3 days
              </CardDescription>
            </div>
            <Link href="/trackers" className="text-xs font-semibold text-blue-600 hover:underline flex items-center">
              View all
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            {urgentTrackers.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-lg">
                <Car className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-medium text-gray-800">All Registered Trackers are Healthy!</p>
                <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1">
                  No vehicle SIMs are currently expired or expiring soon.
                </p>
                <Link href="/trackers">
                  <Button size="sm" variant="outline" className="mt-3 text-xs">
                    View Fleet Registry
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {urgentTrackers.slice(0, 5).map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-3 rounded-lg border bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-900 text-white rounded">
                          {t.plateNumber}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{t.vehicleName}</span>
                      </div>
                      <p className="text-xs text-gray-500 font-mono">
                        SIM: {t.simNumber} • Last plan: {t.lastDataPlan || "None"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0">
                      {t.isDataExpired ? (
                        <span className="text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                          EXPIRED ({Math.abs(t.dataRemainingDays || 0)}d ago)
                        </span>
                      ) : (
                        <span className="text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          Expiring in {t.dataRemainingDays}d
                        </span>
                      )}

                      <Link href={`/trackers`}>
                        <Button size="sm" variant="outline" className="text-xs h-8">
                          Recharge
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions Card */}
        <Card className="col-span-1 lg:col-span-3 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base text-gray-900">Recent Transactions</CardTitle>
              <CardDescription>Wallet funding & VTU recharges</CardDescription>
            </div>
            <Link href="/transactions" className="text-xs font-semibold text-blue-600 hover:underline">
              All
            </Link>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No recent transactions
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                    <div>
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold mr-2 ${
                          tx.type === "CREDIT" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {tx.type}
                      </span>
                      <span className="font-mono text-gray-500 truncate max-w-[100px] inline-block align-middle">
                        {tx.reference.slice(0, 12)}...
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">₦{tx.amount.toFixed(2)}</div>
                      <div className="text-[10px] text-gray-400">{new Date(tx.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
