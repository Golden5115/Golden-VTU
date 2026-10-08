"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Car,
  Search,
  Plus,
  Wifi,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  ShieldAlert,
  Radio,
  Filter,
  Check,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  createTracker,
  updateTracker,
  deleteTracker,
  rechargeTrackerAirtime,
  rechargeTrackerData,
} from "@/actions/tracker.actions"
import { EnrichedTracker } from "@/lib/tracker-utils"

interface TrackerFleetViewProps {
  initialTrackers: EnrichedTracker[]
  initialMetrics: {
    total: number
    active: number
    expiringSoon: number
    expired: number
    neverRecharged: number
    needsAirtimeCount: number
  }
  walletBalance: number
  servers: any[]
  availablePlans: any[]
}

const NETWORK_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  "01": { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", label: "MTN" },
  "02": { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", label: "GLO" },
  "03": { bg: "bg-green-100", text: "text-green-800", border: "border-green-300", label: "9MOBILE" },
  "04": { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300", label: "AIRTEL" },
}

export function TrackerFleetView({
  initialTrackers,
  initialMetrics,
  walletBalance,
  servers,
  availablePlans,
}: TrackerFleetViewProps) {
  const [trackers, setTrackers] = useState<EnrichedTracker[]>(initialTrackers)
  const [metrics, setMetrics] = useState(initialMetrics)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [networkFilter, setNetworkFilter] = useState<string>("ALL")

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDataRechargeOpen, setIsDataRechargeOpen] = useState(false)
  const [isAirtimeRechargeOpen, setIsAirtimeRechargeOpen] = useState(false)
  const [activeTracker, setActiveTracker] = useState<EnrichedTracker | null>(null)

  // Loading & Feedback
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [copiedTrackerId, setCopiedTrackerId] = useState<string | null>(null)

  // Filtered Trackers
  const filteredTrackers = trackers.filter((t) => {
    // Search match
    const q = search.toLowerCase().trim()
    const matchSearch =
      !q ||
      t.plateNumber.toLowerCase().includes(q) ||
      t.vehicleName.toLowerCase().includes(q) ||
      t.simNumber.includes(q) ||
      (t.imei && t.imei.includes(q)) ||
      (t.clientName && t.clientName.toLowerCase().includes(q))

    // Status filter
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && t.dataStatus === "ACTIVE") ||
      (statusFilter === "EXPIRING_SOON" && t.dataStatus === "EXPIRING_SOON") ||
      (statusFilter === "EXPIRED" && t.dataStatus === "EXPIRED") ||
      (statusFilter === "NEVER_TOPPED_UP" && t.dataStatus === "NEVER_TOPPED_UP") ||
      (statusFilter === "NEEDS_AIRTIME" && t.needsAirtime)

    // Network filter
    const matchNetwork = networkFilter === "ALL" || t.network === networkFilter

    return matchSearch && matchStatus && matchNetwork
  })

  // Format Helper for Date
  const formatDate = (date: Date | null) => {
    if (!date) return "Never"
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tracker Fleet SIMs</h1>
              <p className="text-sm text-gray-500">
                Track exact data & airtime top-up history to troubleshoot offline GPS devices instantly
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Vehicle SIM
          </Button>
        </div>
      </div>

      {/* Global Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline ml-4 hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Fleet Diagnostics Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <Card
          onClick={() => setStatusFilter("ALL")}
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "ALL" ? "ring-2 ring-blue-500" : ""
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">Total Trackers</span>
              <Radio className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold mt-2 text-gray-900">{metrics.total}</div>
            <p className="text-xs text-gray-400 mt-1">Registered fleet devices</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter("ACTIVE")}
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "ACTIVE" ? "ring-2 ring-emerald-500" : ""
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-emerald-700">Data Active</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold mt-2 text-emerald-700">{metrics.active}</div>
            <p className="text-xs text-emerald-600/70 mt-1">Transmitting normally</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter("EXPIRING_SOON")}
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "EXPIRING_SOON" ? "ring-2 ring-amber-500 bg-amber-50/50" : ""
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-amber-700">Expiring Soon</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold mt-2 text-amber-800">{metrics.expiringSoon}</div>
            <p className="text-xs text-amber-700/80 mt-1">Expires within 3 days</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter("EXPIRED")}
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "EXPIRED" ? "ring-2 ring-rose-500 bg-rose-50/50" : ""
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-rose-700">Data Expired</span>
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold mt-2 text-rose-800">{metrics.expired}</div>
            <p className="text-xs text-rose-700/80 mt-1">⚠️ Likely offline / no GPS</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setStatusFilter("NEEDS_AIRTIME")}
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "NEEDS_AIRTIME" ? "ring-2 ring-purple-500" : ""
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-purple-700">Needs Airtime</span>
              <Smartphone className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold mt-2 text-purple-800">{metrics.needsAirtimeCount}</div>
            <p className="text-xs text-purple-700/70 mt-1">&gt;45 days or never loaded</p>
          </CardContent>
        </Card>
      </div>

      {/* Troubleshooting Search & Filter Bar */}
      <Card className="border shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Search plate, SIM, IMEI, or vehicle name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-gray-50/50 focus:bg-white"
              />
            </div>

            {/* Quick Status and Network Filter Badges */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Network Filter */}
              <div className="flex items-center bg-gray-100 p-1 rounded-lg text-xs font-medium">
                <span className="px-2 text-gray-500">Network:</span>
                {["ALL", "01", "04", "02", "03"].map((net) => {
                  const label =
                    net === "ALL" ? "All" : NETWORK_COLORS[net]?.label || net
                  const isSelected = networkFilter === net
                  return (
                    <button
                      key={net}
                      onClick={() => setNetworkFilter(net)}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        isSelected
                          ? "bg-white text-gray-900 shadow-xs font-semibold"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Status Clear */}
              {statusFilter !== "ALL" && (
                <button
                  onClick={() => setStatusFilter("ALL")}
                  className="text-xs text-blue-600 hover:underline px-2 py-1"
                >
                  Clear Status Filter ({statusFilter})
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Tracker List */}
      {filteredTrackers.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-gray-100 rounded-full text-gray-400">
              <Car className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">No Tracker SIMs Found</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              {search || statusFilter !== "ALL" || networkFilter !== "ALL"
                ? "No vehicle SIMs match your active search and filter criteria."
                : "You haven't registered any vehicle tracker SIMs yet. Add your first vehicle to start monitoring data and airtime validity."}
            </p>
            <Button
              onClick={() => setIsAddOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white mt-2"
            >
              <Plus className="w-4 h-4 mr-1" />
              Register Vehicle Tracker
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTrackers.map((tracker) => {
            const netMeta = NETWORK_COLORS[tracker.network] || {
              bg: "bg-gray-100",
              text: "text-gray-800",
              border: "border-gray-300",
              label: "Unknown",
            }

            return (
              <Card
                key={tracker.id}
                className="hover:border-blue-300 transition-all shadow-xs border overflow-hidden"
              >
                <div className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Column: Vehicle & Device Info */}
                  <div className="flex items-start gap-4 min-w-[280px]">
                    <div className="p-3 bg-slate-100 rounded-xl text-slate-700 shrink-0 mt-1">
                      <Car className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-base font-bold bg-slate-900 text-white px-2.5 py-0.5 rounded-md tracking-wider">
                          {tracker.plateNumber}
                        </span>
                        <h2 className="text-base font-semibold text-gray-900">
                          {tracker.vehicleName}
                        </h2>
                      </div>

                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 flex-wrap">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded-sm border ${netMeta.bg} ${netMeta.text} ${netMeta.border}`}
                        >
                          {netMeta.label}
                        </span>
                        <span className="font-mono font-medium text-gray-800">
                          {tracker.simNumber}
                        </span>
                        {tracker.deviceModel && (
                          <span>• Model: {tracker.deviceModel}</span>
                        )}
                        {tracker.imei && (
                          <span>• IMEI: <span className="font-mono">{tracker.imei}</span></span>
                        )}
                      </div>

                      {tracker.clientName && (
                        <p className="text-xs text-gray-500 mt-1">
                          Client: <span className="font-medium text-gray-700">{tracker.clientName}</span>
                          {tracker.clientPhone && ` (${tracker.clientPhone})`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Middle Column: Instant Troubleshooting Diagnostics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border lg:min-w-[420px]">
                    {/* GPRS Data Telemetry Box */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                            <Wifi className="w-3.5 h-3.5 text-blue-500" />
                            GPRS Data
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const daysDesc = tracker.dataStatus === "NEVER_TOPPED_UP"
                                ? "Never loaded"
                                : tracker.isDataExpired
                                ? `Last loaded ${Math.abs(tracker.dataRemainingDays || 0)}d ago (Expired)`
                                : `Active (${tracker.dataRemainingDays}d left)`
                              const planDesc = tracker.lastDataPlan ? ` (${tracker.lastDataPlan})` : ""
                              const line = `${tracker.simNumber} - Data: ${daysDesc}${planDesc}`
                              navigator.clipboard.writeText(line)
                              setCopiedTrackerId(tracker.id)
                              setTimeout(() => setCopiedTrackerId(null), 2000)
                            }}
                            title="Copy status for report"
                            className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            {copiedTrackerId === tracker.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {/* Health Badge */}
                        {tracker.dataStatus === "ACTIVE" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active ({tracker.dataRemainingDays}d left)
                          </span>
                        )}
                        {tracker.dataStatus === "EXPIRING_SOON" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Expiring ({tracker.dataRemainingDays}d left)
                          </span>
                        )}
                        {tracker.dataStatus === "EXPIRED" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            EXPIRED ({Math.abs(tracker.dataRemainingDays || 0)}d ago)
                          </span>
                        )}
                        {tracker.dataStatus === "NEVER_TOPPED_UP" && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                            Never loaded
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-600">
                        {tracker.lastDataDate ? (
                          <>
                            <p className="truncate">
                              Last: <span className="font-semibold text-gray-800">{tracker.lastDataPlan || "Data Bundle"}</span>
                            </p>
                            <p className="text-[11px] text-gray-400">
                              Loaded: {formatDate(tracker.lastDataDate)} (Exp: {formatDate(tracker.dataExpiryDate)})
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] text-rose-600 font-medium">
                            No data recharge record yet!
                          </p>
                        )}
                      </div>
                    </div>

                    {/* SMS Airtime Box */}
                    <div className="space-y-1 sm:border-l sm:pl-3 border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                          <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                          SMS Airtime
                        </span>

                        {tracker.lastAirtimeDate ? (
                          tracker.needsAirtime ? (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              {tracker.airtimeDaysAgo}d ago
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              Recent ({tracker.airtimeDaysAgo}d ago)
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                            Never loaded
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-600">
                        {tracker.lastAirtimeDate ? (
                          <>
                            <p>
                              Last Top-up: <span className="font-semibold text-gray-800">₦{tracker.lastAirtimeAmount?.toFixed(0)}</span>
                            </p>
                            <p className="text-[11px] text-gray-400">
                              Date: {formatDate(tracker.lastAirtimeDate)}
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] text-gray-500">
                            No airtime recharge on file
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => {
                        setActiveTracker(tracker)
                        setIsDataRechargeOpen(true)
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9"
                    >
                      <Wifi className="w-3.5 h-3.5 mr-1" />
                      Top-up Data
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveTracker(tracker)
                        setIsAirtimeRechargeOpen(true)
                      }}
                      className="text-xs h-9"
                    >
                      <Smartphone className="w-3.5 h-3.5 mr-1" />
                      Airtime
                    </Button>

                    <Link href={`/trackers/${tracker.id}`}>
                      <Button size="sm" variant="secondary" className="text-xs h-9" title="View Full Troubleshooting History">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </Link>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setActiveTracker(tracker)
                        setIsEditOpen(true)
                      }}
                      className="h-9 w-9 p-0 text-gray-500 hover:text-gray-900"
                      title="Edit Vehicle Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: ADD VEHICLE TRACKER SIM */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Register Tracker SIM</h2>
            <p className="text-xs text-gray-500 mb-4">
              Add a vehicle and its tracker SIM phone number to monitor top-up validity.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setIsLoading(true)
                const fd = new FormData(e.currentTarget)
                try {
                  const res = await createTracker({
                    vehicleName: fd.get("vehicleName") as string,
                    plateNumber: fd.get("plateNumber") as string,
                    simNumber: fd.get("simNumber") as string,
                    network: fd.get("network") as string,
                    deviceModel: (fd.get("deviceModel") as string) || undefined,
                    imei: (fd.get("imei") as string) || undefined,
                    clientName: (fd.get("clientName") as string) || undefined,
                    clientPhone: (fd.get("clientPhone") as string) || undefined,
                    notes: (fd.get("notes") as string) || undefined,
                  })
                  setIsAddOpen(false)
                  setFeedback({ type: "success", message: `Vehicle ${res.tracker.plateNumber} registered successfully!` })
                  window.location.reload()
                } catch (err: any) {
                  setFeedback({ type: "error", message: err.message })
                } finally {
                  setIsLoading(false)
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Plate Number *</label>
                  <Input
                    name="plateNumber"
                    required
                    placeholder="e.g. KJA-821-AB"
                    className="uppercase font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Vehicle Name / Fleet ID *</label>
                  <Input
                    name="vehicleName"
                    required
                    placeholder="e.g. Toyota Corolla (Truck 04)"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Tracker SIM Number *</label>
                  <Input
                    name="simNumber"
                    required
                    type="tel"
                    placeholder="08031234567"
                    className="font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">SIM Network *</label>
                  <select
                    name="network"
                    required
                    defaultValue="01"
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white"
                  >
                    <option value="01">MTN Nigeria</option>
                    <option value="04">Airtel Nigeria</option>
                    <option value="02">Glo Mobile</option>
                    <option value="03">9mobile</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Tracker Device Model</label>
                  <Input
                    name="deviceModel"
                    placeholder="e.g. Concox GT06N, Coban TK103"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Device IMEI</label>
                  <Input
                    name="imei"
                    placeholder="e.g. 864210048123456"
                    className="font-mono mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Fleet Owner / Client</label>
                  <Input
                    name="clientName"
                    placeholder="e.g. Alhaji Sanni / Prime Logistics"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Client Phone Contact</label>
                  <Input
                    name="clientPhone"
                    placeholder="e.g. 08098765432"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Installation Notes</label>
                <Input
                  name="notes"
                  placeholder="e.g. Installed under dashboard behind fuse box"
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? "Saving..." : "Save Vehicle SIM"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: QUICK TOP-UP DATA */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isDataRechargeOpen && activeTracker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Top-up Tracker Data</h2>
                <p className="text-xs text-gray-500">
                  {activeTracker.vehicleName} ({activeTracker.plateNumber})
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border text-xs my-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">SIM Number:</span>
                <span className="font-mono font-bold text-gray-800">{activeTracker.simNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Network:</span>
                <span className="font-bold text-gray-800">
                  {NETWORK_COLORS[activeTracker.network]?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Expiry Status:</span>
                <span className="font-semibold text-rose-600">
                  {activeTracker.dataStatus === "EXPIRED"
                    ? `Expired (${Math.abs(activeTracker.dataRemainingDays || 0)}d ago)`
                    : activeTracker.dataStatus === "EXPIRING_SOON"
                    ? `Expiring in ${activeTracker.dataRemainingDays} days`
                    : activeTracker.dataStatus === "ACTIVE"
                    ? `Active (${activeTracker.dataRemainingDays} days left)`
                    : "Never topped up"}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-gray-500">Your Wallet Balance:</span>
                <span className="font-bold text-blue-600">₦{walletBalance.toLocaleString()}</span>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setIsLoading(true)
                const fd = new FormData(e.currentTarget)
                const planValue = fd.get("plan") as string
                if (!planValue) {
                  setFeedback({ type: "error", message: "Please select a data bundle." })
                  setIsLoading(false)
                  return
                }

                const [planId, priceStr, planName, validityStr] = planValue.split("::")
                const amount = parseFloat(priceStr)
                const validity = parseInt(validityStr) || 30
                const serverId = (fd.get("serverId") as string) || undefined

                try {
                  await rechargeTrackerData(
                    activeTracker.id,
                    planId,
                    amount,
                    planName,
                    validity,
                    serverId
                  )
                  setIsDataRechargeOpen(false)
                  setFeedback({
                    type: "success",
                    message: `Successfully sent ${planName} to ${activeTracker.plateNumber}! Expiry date updated.`,
                  })
                  window.location.reload()
                } catch (err: any) {
                  setFeedback({ type: "error", message: err.message })
                } finally {
                  setIsLoading(false)
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-gray-700">Select Data Bundle *</label>
                <select
                  name="plan"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white"
                >
                  <option value="">-- Choose Data Plan for Trackers --</option>
                  {/* Filter plans for this network */}
                  {availablePlans
                    .filter((p) => p.network === activeTracker.network)
                    .map((p) => {
                      const hasDuration = /day|month|week|daily|weekly|monthly|\(\d+/i.test(p.name)
                      const validityLabel = !hasDuration && p.validity ? ` (${p.validity})` : ""
                      return (
                        <option
                          key={p.id}
                          value={`${p.id}::${p.price}::${p.name}::${p.validity?.includes("30") ? "30" : "30"}`}
                        >
                          {p.name} — ₦{p.price.toLocaleString()}{validityLabel}
                        </option>
                      )
                    })}
                  {/* If no specific plans returned, render standard tracker options */}
                  {availablePlans.filter((p) => p.network === activeTracker.network).length === 0 && (
                    <>
                      <option value={`8::280::1.0GB SME (30 Days)::30`}>1.0GB — ₦280 (Recommended for Trackers, 30 Days)</option>
                      <option value={`7::145::500MB SME (30 Days)::30`}>500MB — ₦145 (Budget, 30 Days)</option>
                      <option value={`9::560::2.0GB SME (30 Days)::30`}>2.0GB — ₦560 (30 Days)</option>
                    </>
                  )}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  💡 Tip: 500MB to 1GB monthly SME plan is ideal for most 24/7 GPS trackers transmitting every 10–30s.
                </p>
              </div>

              {servers && servers.length > 1 && (
                <div>
                  <label className="text-xs font-semibold text-gray-700">Dispensing Server</label>
                  <select
                    name="serverId"
                    defaultValue={servers[0]?.id}
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white"
                  >
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.serverName} ({s.providerName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDataRechargeOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? "Purchasing..." : "Recharge & Renew"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 3: QUICK TOP-UP AIRTIME */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isAirtimeRechargeOpen && activeTracker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Top-up Tracker Airtime</h2>
                <p className="text-xs text-gray-500">
                  {activeTracker.vehicleName} ({activeTracker.plateNumber})
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-600 my-2">
              Airtime enables tracker SMS notifications (ignition alerts, geofence violations, SOS, and SMS command replies).
            </p>

            <div className="bg-slate-50 p-3 rounded-lg border text-xs my-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">SIM Number:</span>
                <span className="font-mono font-bold text-gray-800">{activeTracker.simNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Network:</span>
                <span className="font-bold text-gray-800">
                  {NETWORK_COLORS[activeTracker.network]?.label}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="text-gray-500">Your Wallet Balance:</span>
                <span className="font-bold text-blue-600">₦{walletBalance.toLocaleString()}</span>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setIsLoading(true)
                const fd = new FormData(e.currentTarget)
                const amount = parseFloat(fd.get("amount") as string)
                const serverId = (fd.get("serverId") as string) || undefined

                try {
                  await rechargeTrackerAirtime(activeTracker.id, amount, serverId)
                  setIsAirtimeRechargeOpen(false)
                  setFeedback({
                    type: "success",
                    message: `Successfully loaded ₦${amount} airtime to ${activeTracker.plateNumber}!`,
                  })
                  window.location.reload()
                } catch (err: any) {
                  setFeedback({ type: "error", message: err.message })
                } finally {
                  setIsLoading(false)
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-gray-700">Airtime Amount (₦) *</label>
                <Input
                  name="amount"
                  type="number"
                  min="50"
                  step="50"
                  defaultValue="200"
                  required
                  className="mt-1"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {[50, 100, 200, 500, 1000].map((quickAmt) => (
                    <button
                      key={quickAmt}
                      type="button"
                      onClick={(e) => {
                        const input = e.currentTarget.form?.querySelector('input[name="amount"]') as HTMLInputElement
                        if (input) input.value = quickAmt.toString()
                      }}
                      className="px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                    >
                      ₦{quickAmt}
                    </button>
                  ))}
                </div>
              </div>

              {servers && servers.length > 1 && (
                <div>
                  <label className="text-xs font-semibold text-gray-700">Dispensing Server</label>
                  <select
                    name="serverId"
                    defaultValue={servers[0]?.id}
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white"
                  >
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.serverName} ({s.providerName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAirtimeRechargeOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isLoading ? "Dispensing..." : "Recharge Airtime"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 4: EDIT VEHICLE DETAILS */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isEditOpen && activeTracker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-900">Edit Vehicle / SIM</h2>
              <button
                type="button"
                onClick={async () => {
                  if (confirm(`Are you sure you want to delete ${activeTracker.plateNumber}?`)) {
                    setIsLoading(true)
                    await deleteTracker(activeTracker.id)
                    setIsEditOpen(false)
                    window.location.reload()
                  }
                }}
                className="text-xs text-rose-600 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setIsLoading(true)
                const fd = new FormData(e.currentTarget)
                try {
                  await updateTracker(activeTracker.id, {
                    vehicleName: fd.get("vehicleName") as string,
                    plateNumber: fd.get("plateNumber") as string,
                    simNumber: fd.get("simNumber") as string,
                    network: fd.get("network") as string,
                    deviceModel: (fd.get("deviceModel") as string) || undefined,
                    imei: (fd.get("imei") as string) || undefined,
                    clientName: (fd.get("clientName") as string) || undefined,
                    clientPhone: (fd.get("clientPhone") as string) || undefined,
                    notes: (fd.get("notes") as string) || undefined,
                  })
                  setIsEditOpen(false)
                  setFeedback({ type: "success", message: "Vehicle details updated successfully!" })
                  window.location.reload()
                } catch (err: any) {
                  setFeedback({ type: "error", message: err.message })
                } finally {
                  setIsLoading(false)
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-gray-700">Plate Number</label>
                <Input
                  name="plateNumber"
                  defaultValue={activeTracker.plateNumber}
                  required
                  className="uppercase font-mono mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Vehicle Name</label>
                <Input
                  name="vehicleName"
                  defaultValue={activeTracker.vehicleName}
                  required
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">SIM Number</label>
                  <Input
                    name="simNumber"
                    defaultValue={activeTracker.simNumber}
                    required
                    className="font-mono mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Network</label>
                  <select
                    name="network"
                    defaultValue={activeTracker.network}
                    className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white"
                  >
                    <option value="01">MTN Nigeria</option>
                    <option value="04">Airtel Nigeria</option>
                    <option value="02">Glo Mobile</option>
                    <option value="03">9mobile</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Model</label>
                  <Input
                    name="deviceModel"
                    defaultValue={activeTracker.deviceModel || ""}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">IMEI</label>
                  <Input
                    name="imei"
                    defaultValue={activeTracker.imei || ""}
                    className="font-mono mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Client</label>
                  <Input
                    name="clientName"
                    defaultValue={activeTracker.clientName || ""}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Client Phone</label>
                  <Input
                    name="clientPhone"
                    defaultValue={activeTracker.clientPhone || ""}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">Notes</label>
                <Input
                  name="notes"
                  defaultValue={activeTracker.notes || ""}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
