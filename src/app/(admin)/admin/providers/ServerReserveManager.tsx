"use client"

import { useState, useTransition, useMemo } from "react"
import {
  updateServer3ReserveSettings,
  getServer3ReserveSettings,
} from "@/actions/admin.actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Save,
  CheckCircle2,
  Clock,
  Wallet,
  Zap,
  ChevronDown,
  ChevronUp,
  Search,
  Smartphone,
  Car,
  Calendar,
  AlertTriangle,
  Info,
} from "lucide-react"

export interface ScheduledRenewalItem {
  id: string
  phone: string
  network: string
  planName: string
  cycle: number
  scheduledDate: string
  status: string
  vehicleName: string
  plateNumber: string | null
  daysLeft: number
  error: string | null
}

interface ServerReserveManagerProps {
  initialLiveBalance: number
  initialMinReserve: number
  initialPendingCount: number
  initialTotalScheduledCost?: number
  initialRequiredTotalBalance?: number
  initialScheduledList?: ScheduledRenewalItem[]
}

export function ServerReserveManager({
  initialLiveBalance,
  initialMinReserve,
  initialPendingCount,
  initialTotalScheduledCost = 0,
  initialRequiredTotalBalance = 3000,
  initialScheduledList = [],
}: ServerReserveManagerProps) {
  const [liveBalance, setLiveBalance] = useState(initialLiveBalance)
  const [minReserve, setMinReserve] = useState(initialMinReserve)
  const [reserveInput, setReserveInput] = useState(initialMinReserve.toString())
  const [pendingCount, setPendingCount] = useState(initialPendingCount)
  const [totalScheduledCost, setTotalScheduledCost] = useState(initialTotalScheduledCost)
  const [requiredTotalBalance, setRequiredTotalBalance] = useState(initialRequiredTotalBalance)
  const [scheduledList, setScheduledList] = useState<ScheduledRenewalItem[]>(initialScheduledList)

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, startSaving] = useTransition()
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Expandable list state (open by default so admin sees it immediately)
  const [isQueueExpanded, setIsQueueExpanded] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "SUCCESS" | "FAILED">("PENDING")

  const availableForRenewals = Math.max(0, liveBalance - minReserve)
  const renewalsCovered = Math.floor(availableForRenewals / 150)
  const isHealthy = liveBalance >= minReserve
  const hasFullCoverage = liveBalance >= requiredTotalBalance

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const data = await getServer3ReserveSettings()
      setLiveBalance(data.liveBalance)
      setMinReserve(data.minReserve)
      setReserveInput(data.minReserve.toString())
      setPendingCount(data.pendingCount)
      setTotalScheduledCost(data.totalScheduledCost || 0)
      setRequiredTotalBalance(data.requiredTotalBalance || data.minReserve)
      if (data.scheduledList) {
        setScheduledList(data.scheduledList)
      }
    } catch (e: any) {
      alert("Failed to refresh balance: " + e?.message)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSave = () => {
    const val = parseFloat(reserveInput)
    if (isNaN(val) || val < 0) {
      alert("Please enter a valid positive number for the reserve balance.")
      return
    }

    startSaving(async () => {
      try {
        const res = await updateServer3ReserveSettings(val)
        if (res.success) {
          setMinReserve(val)
          setSaveSuccess(true)
          setRequiredTotalBalance(val + totalScheduledCost)
          setTimeout(() => setSaveSuccess(false), 2500)
        }
      } catch (err: any) {
        alert("Failed to update reserve threshold: " + err?.message)
      }
    })
  }

  // Filtered queue items
  const filteredQueue = useMemo(() => {
    return scheduledList.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        item.phone?.toLowerCase().includes(q) ||
        item.vehicleName?.toLowerCase().includes(q) ||
        item.plateNumber?.toLowerCase().includes(q) ||
        item.planName?.toLowerCase().includes(q)
      )
    })
  }, [scheduledList, statusFilter, searchQuery])

  return (
    <Card className="border border-indigo-200/80 shadow-sm rounded-2xl overflow-hidden bg-gradient-to-br from-white via-indigo-50/20 to-slate-50">
      <CardHeader className="border-b border-indigo-100/60 pb-3 sm:pb-4 bg-white/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg font-bold text-slate-900">
                  Server 3 Reserve Balance & Bi-Weekly Renewals Monitor
                </CardTitle>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                    !isHealthy
                      ? "bg-rose-100 text-rose-800 border-rose-300"
                      : !hasFullCoverage
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-emerald-100 text-emerald-800 border-emerald-300"
                  }`}
                >
                  {!isHealthy ? (
                    <>
                      <ShieldAlert className="w-3 h-3 text-rose-600 animate-pulse" />
                      Low Reserve Deficit
                    </>
                  ) : !hasFullCoverage ? (
                    <>
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      Reserve Ok / Top-up Recommended
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Healthy & Fully Funded
                    </>
                  )}
                </span>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Tracks scheduled SIM renewals and enforces the minimum carrier wallet floor so automated 2-week data recharges never fail.
              </CardDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 px-3 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 shrink-0 self-start sm:self-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Checking..." : "Refresh Live Balance"}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Core Metric Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
          {/* Tile 1: Current Live Balance */}
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400">Current Server 3 Balance</div>
            <div className="text-base sm:text-xl font-black text-slate-900 font-mono mt-0.5">
              ₦{liveBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Live carrier wallet</div>
          </div>

          {/* Tile 2: Configured Reserve Floor */}
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400">Protected Reserve Floor</div>
            <div className="text-base sm:text-xl font-black text-indigo-700 font-mono mt-0.5">
              ₦{minReserve.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-indigo-600 font-medium mt-0.5">Must never be breached</div>
          </div>

          {/* Tile 3: Scheduled SIMs Count */}
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400">Scheduled SIMs (Cycle 2)</div>
            <div className="text-base sm:text-xl font-black text-amber-700 font-mono mt-0.5">
              {pendingCount.toLocaleString()} SIM{pendingCount === 1 ? "" : "s"}
            </div>
            <div className="text-[10px] text-amber-600 font-medium mt-0.5">
              Cost: ₦{totalScheduledCost.toLocaleString()} (@ ₦150/SIM)
            </div>
          </div>

          {/* Tile 4: Total Balance Required */}
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Money Required</div>
            <div className="text-base sm:text-xl font-black text-slate-900 font-mono mt-0.5">
              ₦{requiredTotalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Reserve (₦{minReserve.toLocaleString()}) + Queue</div>
          </div>

          {/* Tile 5: Net Surplus / Deficit */}
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
            <div className="text-[10px] uppercase font-bold text-slate-400">Net Surplus Headroom</div>
            <div
              className={`text-base sm:text-xl font-black font-mono mt-0.5 ${
                liveBalance >= requiredTotalBalance ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {liveBalance >= requiredTotalBalance ? "+" : "-"}₦
              {Math.abs(liveBalance - requiredTotalBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Covers {renewalsCovered} more renewals
            </div>
          </div>
        </div>

        {/* Warning Banners */}
        {!isHealthy ? (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Critical Reserve Deficit:</strong> Server 3 balance (₦{liveBalance.toLocaleString()}) has dropped below your minimum reserve floor of ₦{minReserve.toLocaleString()}. Bi-weekly renewals will be paused until funded to protect your carrier wallet from emptying.
            </div>
          </div>
        ) : !hasFullCoverage ? (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Recommended Top-Up Notice:</strong> You have {pendingCount} SIMs scheduled (costing ₦{totalScheduledCost.toLocaleString()}). To preserve your ₦{minReserve.toLocaleString()} reserve floor through all upcoming renewals, maintain at least <strong>₦{requiredTotalBalance.toLocaleString()}</strong> in your Server 3 wallet.
            </div>
          </div>
        ) : null}

        {/* Setting Form & Queue Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl bg-white border border-slate-200">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-600" />
              <span>Configure Minimum Reserve Floor (₦)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              The automated renewal engine will pause if Server 3 balance drops below this amount.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-44">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₦</span>
              <Input
                type="number"
                min="0"
                step="500"
                value={reserveInput}
                onChange={(e) => setReserveInput(e.target.value)}
                className="pl-7 h-8 text-xs font-mono font-bold bg-slate-50 border-slate-200"
                placeholder="3000"
              />
            </div>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-8 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shrink-0 inline-flex items-center gap-1.5"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? "Saving..." : "Save Threshold"}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Collapsible Scheduled SIMs Queue List */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setIsQueueExpanded(!isQueueExpanded)}
            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">
                Scheduled SIM Renewals Queue ({scheduledList.length} Total, {pendingCount} Pending)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold">
              <span>{isQueueExpanded ? "Hide SIM Numbers" : "View SIM Numbers & Schedule"}</span>
              {isQueueExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {isQueueExpanded && (
            <div className="p-3 sm:p-4 space-y-3 border-t border-slate-200">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search phone or plate number..."
                    className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  {(["PENDING", "SUCCESS", "FAILED", "ALL"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setStatusFilter(filter)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        statusFilter === filter
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table of SIMs */}
              {filteredQueue.length === 0 ? (
                <div className="py-7 px-4 text-center text-xs bg-slate-50/80 rounded-xl border border-dashed border-indigo-200/80 space-y-2">
                  <div className="p-2.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 inline-flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-slate-800 text-sm">
                    {searchQuery ? "No matching SIMs found" : "No SIMs Currently in Bi-Weekly Queue"}
                  </div>
                  <p className="text-slate-500 max-w-md mx-auto text-xs leading-relaxed">
                    {searchQuery
                      ? "Try searching with a different phone or plate number."
                      : "When staff or users buy the 'MTN 100MB Twice a Month' plan (₦400), their SIM number, linked vehicle, and automatic 14-day renewal schedule will appear right here."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">SIM Phone Number</th>
                        <th className="px-3 py-2.5">Vehicle Tracker</th>
                        <th className="px-3 py-2.5">Scheduled Date</th>
                        <th className="px-3 py-2.5">Time Until Renewal</th>
                        <th className="px-3 py-2.5">Plan & Cycle</th>
                        <th className="px-3 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredQueue.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                              {item.phone}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <div className="flex items-center gap-1 text-slate-900 font-medium">
                              <Car className="w-3 h-3 text-slate-400" />
                              <span>{item.vehicleName || "Tracker SIM"}</span>
                            </div>
                            {item.plateNumber && (
                              <div className="text-[10px] font-mono text-slate-400">
                                {item.plateNumber}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }) : "—"}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.status !== "PENDING"
                                  ? "bg-slate-100 text-slate-500"
                                  : item.daysLeft <= 0
                                  ? "bg-rose-100 text-rose-700 font-extrabold animate-pulse"
                                  : item.daysLeft <= 2
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {item.status !== "PENDING"
                                ? "Completed"
                                : item.daysLeft <= 0
                                ? "Due Today"
                                : item.daysLeft === 1
                                ? "Tomorrow"
                                : `In ${item.daysLeft} days`}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-[11px]">
                            <div className="font-medium text-slate-900">
                              MTN 100MB Bi-Weekly
                            </div>
                            <div className="text-[10px] text-indigo-600 font-semibold">
                              Cycle {item.cycle} of 2 (Prepaid — ₦0 wallet debit)
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                item.status === "SUCCESS"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : item.status === "FAILED"
                                  ? "bg-rose-100 text-rose-800 border-rose-300"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
