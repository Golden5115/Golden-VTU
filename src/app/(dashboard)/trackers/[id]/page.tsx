import { auth } from "@/auth"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
  Car,
  Wifi,
  Smartphone,
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Calendar,
  Layers,
  History,
} from "lucide-react"
import { getTrackerById } from "@/actions/tracker.actions"
import { getActiveServers, resolveServerAndProvider } from "@/services/providers/provider.factory"
import prisma from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TrackerRechargeCards } from "./TrackerRechargeCards"

const NETWORK_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  "01": { label: "MTN Nigeria", bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300" },
  "02": { label: "Glo Mobile", bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  "03": { label: "9mobile", bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
  "04": { label: "Airtel Nigeria", bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300" },
}

export default async function TrackerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params
  const tracker = await getTrackerById(id)
  if (!tracker) notFound()

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
    console.error("[TrackerDetailPage] Failed to fetch data plans:", err)
  }

  // Combine and sort purchase history
  const combinedHistory = [
    ...tracker.airtimePurchases.map((a: any) => ({
      ...a,
      itemType: "AIRTIME",
      description: `Airtime Top-up (₦${a.amount.toLocaleString()})`,
    })),
    ...tracker.dataPurchases.map((d: any) => ({
      ...d,
      itemType: "DATA",
      description: `Data Plan: ${d.plan}`,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const net = NETWORK_META[tracker.network] || {
    label: "Unknown",
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-300",
  }

  return (
    <div className="space-y-6">
      {/* Back button and Header */}
      <div>
        <Link
          href="/trackers"
          className="inline-flex items-center text-xs font-semibold text-gray-500 hover:text-blue-600 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Tracker Fleet
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-slate-900 text-white rounded-xl">
              <Car className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-lg font-bold bg-slate-900 text-white px-3 py-0.5 rounded-md">
                  {tracker.plateNumber}
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  {tracker.vehicleName}
                </h1>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Diagnostic Overview & Recharge History for Device SIM:{" "}
                <span className="font-mono font-semibold text-gray-800">{tracker.simNumber}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Troubleshooting Diagnostics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: GPRS Data Telemetry Status */}
        <Card className={`border ${tracker.isDataExpired ? "border-rose-300 bg-rose-50/20" : ""}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-gray-800">
                <Wifi className="w-4 h-4 text-blue-600" />
                GPRS Data Status
              </CardTitle>

              {tracker.dataStatus === "ACTIVE" && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active ({tracker.dataRemainingDays}d left)
                </span>
              )}
              {tracker.dataStatus === "EXPIRING_SOON" && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Expiring in {tracker.dataRemainingDays} days
                </span>
              )}
              {tracker.dataStatus === "EXPIRED" && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  EXPIRED ({Math.abs(tracker.dataRemainingDays || 0)}d ago)
                </span>
              )}
              {tracker.dataStatus === "NEVER_TOPPED_UP" && (
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-200 text-gray-700">
                  Never topped up
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Last Plan Bought:</span>
              <span className="font-semibold text-gray-900">{tracker.lastDataPlan || "None recorded"}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Date Last Loaded:</span>
              <span className="font-medium text-gray-800">
                {tracker.lastDataDate ? new Date(tracker.lastDataDate).toLocaleString() : "Never"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Expiry Date:</span>
              <span className="font-semibold text-gray-900">
                {tracker.dataExpiryDate ? new Date(tracker.dataExpiryDate).toLocaleDateString() : "N/A"}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Last Reference:</span>
              <span className="font-mono text-[11px] text-gray-500 truncate max-w-[150px]">
                {tracker.lastDataRef || "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: SMS Airtime Communication Status */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-gray-800">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                SMS Airtime Status
              </CardTitle>

              {tracker.lastAirtimeDate ? (
                tracker.needsAirtime ? (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Loaded {tracker.airtimeDaysAgo}d ago
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Recent ({tracker.airtimeDaysAgo}d ago)
                  </span>
                )
              ) : (
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-gray-200 text-gray-600">
                  Never topped up
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Last Amount Loaded:</span>
              <span className="font-semibold text-gray-900">
                {tracker.lastAirtimeAmount ? `₦${tracker.lastAirtimeAmount.toFixed(0)}` : "None"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Date Last Loaded:</span>
              <span className="font-medium text-gray-800">
                {tracker.lastAirtimeDate ? new Date(tracker.lastAirtimeDate).toLocaleString() : "Never"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">SMS Reliability:</span>
              <span className={`font-semibold ${tracker.needsAirtime ? "text-amber-600" : "text-emerald-600"}`}>
                {tracker.needsAirtime ? "⚠️ Low / Check Airtime" : "Good"}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Last Reference:</span>
              <span className="font-mono text-[11px] text-gray-500 truncate max-w-[150px]">
                {tracker.lastAirtimeRef || "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Vehicle & Hardware Meta */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-gray-800">
              <Layers className="w-4 h-4 text-slate-600" />
              Device Hardware Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">SIM Network:</span>
              <span className={`font-semibold px-2 py-0.5 rounded-sm border text-[11px] ${net.bg} ${net.text} ${net.border}`}>
                {net.label}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Tracker Model:</span>
              <span className="font-medium text-gray-900">{tracker.deviceModel || "Not specified"}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-gray-500">Device IMEI:</span>
              <span className="font-mono font-medium text-gray-800">{tracker.imei || "Not recorded"}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Fleet Client:</span>
              <span className="font-medium text-gray-800">{tracker.clientName || "Personal / None"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instant Recharge Controls */}
      <TrackerRechargeCards
        trackerId={tracker.id}
        plateNumber={tracker.plateNumber}
        vehicleName={tracker.vehicleName}
        simNumber={tracker.simNumber}
        network={tracker.network}
        walletBalance={walletBalance}
        servers={servers}
        availablePlans={availablePlans}
      />

      {/* Historical Audit Trail Timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <div>
              <CardTitle className="text-base">Complete Recharge Audit Trail</CardTitle>
              <CardDescription>
                Chronological timeline of all data and airtime purchases made for {tracker.plateNumber}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description / Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No recharge records found for this vehicle SIM yet. Use the top-up forms above to recharge.
                  </TableCell>
                </TableRow>
              ) : (
                combinedHistory.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.itemType === "DATA" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                          <Wifi className="w-3 h-3" />
                          DATA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                          <Smartphone className="w-3 h-3" />
                          AIRTIME
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-gray-800">
                      {item.description}
                    </TableCell>
                    <TableCell className="font-mono">₦{item.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          item.status === "SUCCESS"
                            ? "bg-green-100 text-green-800"
                            : item.status === "PENDING"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">
                      {item.reference}
                    </TableCell>
                    <TableCell className="text-right text-xs text-gray-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
