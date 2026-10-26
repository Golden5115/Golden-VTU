"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  Radio,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Car,
  Smartphone,
  ShieldCheck,
  Zap,
  ArrowRight,
  Filter,
  Layers,
  ChevronDown,
  Info,
  ExternalLink,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  searchCustomerFleet,
  searchDirectTrackers,
  rechargeFleetVehicles,
  type FleetTrackerDevice,
  type CustomerFleetResult,
} from "@/actions/cartracker.actions"
import { ServerBadge } from "@/components/vtu/ServerBadge"
import { extractValidityDays } from "@/lib/phone-utils"

interface FleetTroubleshootClientProps {
  initialWalletBalance: number
  servers: Array<{
    id: string
    serverName: string
    serverCode?: string | null
    status?: boolean | string
    isDefault: boolean
  }>
  availablePlans: any[]
}

const NETWORK_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  "01": { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", label: "MTN" },
  "02": { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", label: "GLO" },
  "03": { bg: "bg-green-100", text: "text-green-800", border: "border-green-300", label: "9MOBILE" },
  "04": { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300", label: "AIRTEL" },
}

export function FleetTroubleshootClient({
  initialWalletBalance,
  servers,
  availablePlans,
}: FleetTroubleshootClientProps) {
  // Navigation Search Mode
  const [searchMode, setSearchMode] = useState<"email" | "direct">("email")

  // Search Inputs
  const [emailInput, setEmailInput] = useState("")
  const [directQuery, setDirectQuery] = useState("")

  // Wallet & Server
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)
  const [selectedServerId, setSelectedServerId] = useState(servers[0]?.id || "")

  // Search Results State
  const [isSearching, startSearchTransition] = useTransition()
  const [customerInfo, setCustomerInfo] = useState<CustomerFleetResult["client"] | null>(null)
  const [vehicles, setVehicles] = useState<FleetTrackerDevice[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  // Selection & Plan Selection for Bulk Recharge
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<number>>(new Set())
  const [selectedPlanValue, setSelectedPlanValue] = useState<string>("")

  // Copy feedback
  const [copiedText, setCopiedText] = useState<string | null>(null)

  // Recharge Execution State
  const [isRecharging, setIsRecharging] = useState(false)
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false)
  const [rechargeProgress, setRechargeProgress] = useState<{
    total: number
    completed: number
    results: Array<{ vehicleName: string; phone: string; status: "SUCCESS" | "FAILED"; message?: string }>
    summaryError?: string
  } | null>(null)

  // Helper to copy text to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(null), 2000)
  }

  // Handle Mode A: Email Search
  const handleSearchEmail = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const email = emailInput.trim()
    if (!email) return

    setSearchError(null)
    setCustomerInfo(null)
    setVehicles([])
    setSelectedVehicleIds(new Set())

    startSearchTransition(async () => {
      setHasSearched(true)
      const res = await searchCustomerFleet(email)
      if (!res.success) {
        setSearchError(res.error || "No customer account found.")
      } else {
        setCustomerInfo(res.client || null)
        setVehicles(res.vehicles)
      }
    })
  }

  // Handle Mode B: Direct Search (SIM, IMEI, Plate)
  const handleSearchDirect = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const query = directQuery.trim()
    if (!query) return

    setSearchError(null)
    setCustomerInfo(null)
    setVehicles([])
    setSelectedVehicleIds(new Set())

    startSearchTransition(async () => {
      setHasSearched(true)
      const res = await searchDirectTrackers(query)
      if (!res.success) {
        setSearchError(res.error || "No matching vehicles found.")
      } else {
        setVehicles(res.vehicles)
        if (res.vehicles.length === 0) {
          setSearchError(`No tracker found matching "${query}" on Car Tracker Nigeria.`)
        }
      }
    })
  }

  // Selection Toggles
  const handleToggleSelect = (id: number) => {
    const next = new Set(selectedVehicleIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedVehicleIds(next)
  }

  const handleSelectAll = () => {
    if (selectedVehicleIds.size === vehicles.length) {
      setSelectedVehicleIds(new Set())
    } else {
      setSelectedVehicleIds(new Set(vehicles.map((v) => v.id)))
    }
  }

  const handleSelectExpiredOnly = () => {
    const expiredIds = vehicles
      .filter((v) => v.vtuHistory.statusBadge === "EXPIRED" || v.vtuHistory.statusBadge === "EXPIRING_SOON")
      .map((v) => v.id)
    setSelectedVehicleIds(new Set(expiredIds))
  }

  // Parse currently selected plan
  const [selectedPlanId, selectedPlanPriceStr, rawSelectedPlanName, selectedPlanValidity] = selectedPlanValue.split("::")
  const selectedPlanPrice = Number(selectedPlanPriceStr || 0)
  const totalRechargeCost = selectedPlanPrice * selectedVehicleIds.size
  const effectiveValidity = extractValidityDays(selectedPlanValidity || rawSelectedPlanName || selectedPlanId, 30)
  const selectedPlanName = selectedPlanValidity && !rawSelectedPlanName.toLowerCase().includes("day") && !rawSelectedPlanName.toLowerCase().includes("week")
    ? `${rawSelectedPlanName} (${selectedPlanValidity})`
    : rawSelectedPlanName

  // Execute Bulk Recharge
  const handleExecuteRecharge = async () => {
    if (selectedVehicleIds.size === 0) {
      alert("Please select at least one vehicle to recharge.")
      return
    }

    if (!selectedPlanValue) {
      alert("Please select a data bundle from the dropdown.")
      return
    }

    if (walletBalance < totalRechargeCost) {
      alert(
        `Insufficient wallet balance. Total cost is ₦${totalRechargeCost.toLocaleString()}, but your balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`
      )
      return
    }

    const selectedVehicles = vehicles.filter((v) => selectedVehicleIds.has(v.id))
    const confirmMsg = `Are you sure you want to recharge ${selectedVehicles.length} vehicles with ${selectedPlanName} for a total of ₦${totalRechargeCost.toLocaleString()}?`
    if (!window.confirm(confirmMsg)) return

    setIsRecharging(true)
    setRechargeModalOpen(true)
    setRechargeProgress({
      total: selectedVehicles.length,
      completed: 0,
      results: [],
    })

    try {
      const res = await rechargeFleetVehicles({
        vehicles: selectedVehicles.map((v) => ({
          id: v.id,
          name: v.name,
          plateNumber: v.plateNumber,
          phone: v.normalizedPhone,
          networkId: v.network?.id || "01",
          imei: v.imei,
        })),
        dataPlanId: selectedPlanId,
        planName: selectedPlanName,
        amount: selectedPlanPrice,
        validityDays: effectiveValidity,
        serverId: selectedServerId,
      })

      setWalletBalance(res.newWalletBalance)
      setRechargeProgress({
        total: selectedVehicles.length,
        completed: selectedVehicles.length,
        results: res.results,
        summaryError: res.error,
      })

      // Update local vehicle diagnostics if successful
      if (res.successCount > 0) {
        const successIds = new Set(
          res.results.filter((r) => r.status === "SUCCESS").map((r) => r.vehicleId)
        )
        setVehicles((prev) =>
          prev.map((v) => {
            if (successIds.has(v.id)) {
              return {
                ...v,
                vtuHistory: {
                  ...v.vtuHistory,
                  hasRecord: true,
                  lastDataPlan: selectedPlanName,
                  lastDataAmount: selectedPlanPrice,
                  lastDataDaysAgo: 0,
                  isExpired: false,
                  isExpiringSoon: false,
                  daysUntilExpiry: effectiveValidity,
                  statusBadge: "ACTIVE",
                },
              }
            }
            return v
          })
        )
      }
    } catch (err: any) {
      setRechargeProgress((prev) =>
        prev
          ? { ...prev, summaryError: err.message || "Failed to complete recharge batch." }
          : null
      )
    } finally {
      setIsRecharging(false)
    }
  }

  // Summary counts for current search
  const expiredCount = vehicles.filter((v) => v.vtuHistory.statusBadge === "EXPIRED").length
  const expiringSoonCount = vehicles.filter((v) => v.vtuHistory.statusBadge === "EXPIRING_SOON").length
  const activeCount = vehicles.filter((v) => v.vtuHistory.statusBadge === "ACTIVE").length
  const neverLoadedCount = vehicles.filter((v) => v.vtuHistory.statusBadge === "NEVER_LOADED").length
  const movingTrackersCount = vehicles.filter(
    (v) => (v.onlineStatus === "online" || v.onlineStatus === "ack") && typeof v.speed === "number" && v.speed > 0
  ).length
  const idleTrackersCount = vehicles.filter(
    (v) => (v.onlineStatus === "online" || v.onlineStatus === "ack") && !(typeof v.speed === "number" && v.speed > 0)
  ).length
  const offlineTrackersCount = vehicles.filter((v) => v.onlineStatus === "offline").length

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER & TELEMETRY STATUS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Troubleshoot Section</h1>
              <p className="text-xs text-slate-300">
                Car Tracker Nigeria Fleet Integration & Live SIM Telemetry Diagnostics
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2 flex items-center gap-3">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Available Wallet</div>
              <div className="text-sm font-bold text-emerald-400 font-mono">
                ₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>app.cartracker.com.ng Live</span>
          </div>
        </div>
      </div>

      {/* 2. SEARCH CONTROL CARD WITH TWO MODES */}
      <Card className="border border-slate-200/90 shadow-sm rounded-2xl overflow-hidden bg-white">
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSearchMode("email")
              setSearchError(null)
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              searchMode === "email"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Mode A: Customer Fleet (By Email)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchMode("direct")
              setSearchError(null)
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              searchMode === "direct"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Car className="w-4 h-4 text-indigo-600" />
            <span>Mode B: Tracker Lookup (SIM / IMEI / Plate)</span>
          </button>
        </div>

        <CardContent className="p-6">
          {searchMode === "email" ? (
            <form onSubmit={handleSearchEmail} className="space-y-3">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <span>Customer Email Address</span>
                <span className="text-[11px] font-normal text-gray-500">
                  (Fetches all vehicles registered under this client on Car Tracker Nigeria)
                </span>
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <Input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Enter customer email (e.g. client@company.com)..."
                    className="pl-10 h-11 text-sm font-medium border-slate-200 rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSearching || !emailInput.trim()}
                  className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs shrink-0"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Querying Fleet...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Fetch Customer Fleet
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSearchDirect} className="space-y-3">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <span>Tracker SIM Number, IMEI, or Plate / Vehicle Name</span>
                <span className="text-[11px] font-normal text-gray-500">
                  (e.g. 07078172145, 358657104575415, or KJA-663)
                </span>
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <Input
                    type="text"
                    value={directQuery}
                    onChange={(e) => setDirectQuery(e.target.value)}
                    placeholder="Search by SIM number, IMEI, or Plate number..."
                    className="pl-10 h-11 text-sm font-medium border-slate-200 rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSearching || !directQuery.trim()}
                  className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs shrink-0"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Find Tracker
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Search Error Banner */}
          {searchError && (
            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. CUSTOMER PROFILE SUMMARY (WHEN MODE A SEARCH SUCCEEDS) */}
      {customerInfo && (
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                Customer Profile
              </span>
              <span className="font-mono text-sm font-black text-gray-900">{customerInfo.email}</span>
            </div>
            <div className="text-xs text-gray-500">
              Client ID: <span className="font-mono font-semibold">{customerInfo.id}</span>
              {customerInfo.phoneNumber && ` • Phone: ${customerInfo.phoneNumber}`}
              {` • ${vehicles.length} vehicle trackers found`}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {movingTrackersCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold inline-flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                </span>
                {movingTrackersCount} Moving
              </span>
            )}
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-bold inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {idleTrackersCount} Idle
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              {offlineTrackersCount} Offline
            </span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold">
              {expiredCount} Data Expired
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-bold">
              {expiringSoonCount} Expiring Soon
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
              {activeCount} Data Active
            </span>
            {neverLoadedCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 font-bold">
                {neverLoadedCount} No Record
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3B. DIRECT SEARCH SUMMARY BANNER (MODE B) */}
      {!customerInfo && vehicles.length > 0 && (
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fadeIn">
          <div className="text-xs text-gray-600 font-medium">
            Found <span className="font-bold text-gray-900">{vehicles.length}</span> tracker vehicles matching &ldquo;<span className="font-semibold text-indigo-700">{directQuery}</span>&rdquo;
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {movingTrackersCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold inline-flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                </span>
                {movingTrackersCount} Moving
              </span>
            )}
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-bold inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {idleTrackersCount} Idle
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              {offlineTrackersCount} Offline
            </span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold">
              {expiredCount} Data Expired
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
              {activeCount} Data Active
            </span>
          </div>
        </div>
      )}

      {/* 4. FLEET VEHICLES LIST & BULK ACTION BAR */}
      {vehicles.length > 0 && (
        <Card className="border border-slate-200/90 shadow-sm rounded-2xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50/70 border-b border-slate-100 py-4 px-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left: Selection Shortcuts */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50 text-xs font-bold text-gray-700 shadow-2xs transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedVehicleIds.size === vehicles.length && vehicles.length > 0}
                    onChange={handleSelectAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Select All ({vehicles.length})</span>
                </button>

                {(expiredCount > 0 || expiringSoonCount > 0) && (
                  <button
                    type="button"
                    onClick={handleSelectExpiredOnly}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-800 shadow-2xs transition-colors"
                  >
                    Select Expired Only ({expiredCount + expiringSoonCount})
                  </button>
                )}

                <span className="text-xs text-gray-500 font-medium ml-1">
                  <span className="font-bold text-indigo-700">{selectedVehicleIds.size}</span> selected
                </span>
              </div>

              {/* Right: Data Plan & Server Route Selection */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Telecom Server Route */}
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-bold text-gray-600 hidden sm:inline">Route:</label>
                  <select
                    value={selectedServerId}
                    onChange={(e) => setSelectedServerId(e.target.value)}
                    className="h-9 border rounded-lg px-2.5 text-xs bg-white font-semibold text-gray-800 border-slate-200"
                  >
                    {servers.map((s, idx) => (
                      <option key={s.id} value={s.id}>
                        Server {idx + 1} {s.isDefault ? "(Default)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Plan Dropdown */}
                <select
                  value={selectedPlanValue}
                  onChange={(e) => setSelectedPlanValue(e.target.value)}
                  className="h-9 border rounded-lg px-3 text-xs bg-white font-semibold text-gray-800 border-slate-200 max-w-[220px] truncate"
                >
                  <option value="">-- Choose Data Plan --</option>
                  {availablePlans.map((p) => {
                    const hasDuration = /day|month|week|daily|weekly|monthly|\(\d+/i.test(p.name)
                    const validityLabel = !hasDuration && p.validity ? ` (${p.validity})` : ""
                    return (
                      <option key={`${p.id}-${p.name}`} value={`${p.id}::${p.price}::${p.name}::${p.validity || ""}`}>
                        {p.name} — ₦{p.price}{validityLabel}
                      </option>
                    )
                  })}
                  {availablePlans.length === 0 && (
                    <>
                      <option value="8::380::1.0GB SME (30 Days)::30 Days">1.0GB SME — ₦380 (Recommended)</option>
                      <option value="7::245::500MB SME (30 Days)::30 Days">500MB SME — ₦245</option>
                      <option value="9::660::2.0GB SME (30 Days)::30 Days">2.0GB SME — ₦660</option>
                    </>
                  )}
                </select>

                {/* Bulk Recharge Button */}
                <Button
                  onClick={handleExecuteRecharge}
                  disabled={isRecharging || selectedVehicleIds.size === 0 || !selectedPlanValue}
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs shrink-0"
                >
                  <Zap className="w-3.5 h-3.5 mr-1 text-amber-300" />
                  <span>
                    Recharge Selected ({selectedVehicleIds.size})
                    {totalRechargeCost > 0 && ` • ₦${totalRechargeCost.toLocaleString()}`}
                  </span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-gray-500 font-semibold">
                  <tr>
                    <th className="py-3 px-3 w-10"></th>
                    <th className="py-3 px-3">Vehicle & Plate</th>
                    <th className="py-3 px-3">Tracker IMEI</th>
                    <th className="py-3 px-3">Tracker SIM</th>
                    <th className="py-3 px-3">Live Status</th>
                    <th className="py-3 px-3">Data Health Status</th>
                    <th className="py-3 px-3">Last Data Loaded</th>
                    <th className="py-3 px-3">Protocol</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicles.map((v) => {
                    const isSelected = selectedVehicleIds.has(v.id)
                    const net = v.network ? NETWORK_COLORS[v.network.id] : null
                    const vtu = v.vtuHistory

                    return (
                      <tr
                        key={v.id}
                        className={`transition-colors hover:bg-slate-50/80 cursor-pointer ${
                          isSelected ? "bg-indigo-50/40" : ""
                        }`}
                        onClick={() => handleToggleSelect(v.id)}
                      >
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(v.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>

                        {/* Vehicle & Plate */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-gray-900 flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{v.name}</span>
                          </div>
                          {v.plateNumber ? (
                            <span className="inline-block mt-0.5 font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {v.plateNumber}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">No plate set</span>
                          )}
                        </td>

                        {/* IMEI */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1 font-mono text-[11px] text-gray-600">
                            <span>{v.imei}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopy(v.imei)
                              }}
                              className="text-gray-400 hover:text-indigo-600"
                              title="Copy IMEI"
                            >
                              {copiedText === v.imei ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          {v.deviceModel && (
                            <div className="text-[10px] text-gray-400 mt-0.5">{v.deviceModel}</div>
                          )}
                        </td>

                        {/* SIM Phone Number */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            {net && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${net.bg} ${net.text} ${net.border}`}
                              >
                                {net.label}
                              </span>
                            )}
                            <span className="font-mono font-bold text-gray-900 text-[11px]">
                              {v.normalizedPhone || v.rawSimNumber || "No SIM"}
                            </span>
                            {v.normalizedPhone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopy(v.normalizedPhone)
                                }}
                                className="text-gray-400 hover:text-indigo-600"
                                title="Copy SIM number"
                              >
                                {copiedText === v.normalizedPhone ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Tracker Live Status (Moving / Idle / Offline) */}
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const isOnlineOrAck = v.onlineStatus === "online" || v.onlineStatus === "ack"
                            const isMoving = isOnlineOrAck && typeof v.speed === "number" && v.speed > 0
                            const isIdle = isOnlineOrAck && !isMoving
                            const isOffline = v.onlineStatus === "offline"

                            if (isMoving) {
                              return (
                                <div>
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                                    </span>
                                    Moving • {Math.round(v.speed as number)} km/h
                                  </span>
                                  {v.lastHeartbeat && (
                                    <div className="text-[10px] text-gray-500 mt-0.5 font-medium truncate max-w-[130px]" title={v.lastHeartbeat}>
                                      {v.lastHeartbeat}
                                    </div>
                                  )}
                                </div>
                              )
                            }

                            if (isIdle) {
                              return (
                                <div>
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                                    <span className="inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                    Idle
                                  </span>
                                  {v.lastHeartbeat && (
                                    <div className="text-[10px] text-gray-500 mt-0.5 font-medium truncate max-w-[130px]" title={v.lastHeartbeat}>
                                      {v.lastHeartbeat}
                                    </div>
                                  )}
                                </div>
                              )
                            }

                            if (isOffline) {
                              return (
                                <div>
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                                    <span className="inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                    Offline
                                  </span>
                                  {v.lastHeartbeat && (
                                    <div className="text-[10px] text-gray-500 mt-0.5 font-medium truncate max-w-[130px]" title={v.lastHeartbeat}>
                                      Last: {v.lastHeartbeat}
                                    </div>
                                  )}
                                </div>
                              )
                            }

                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                <span className="inline-flex rounded-full h-1.5 w-1.5 bg-gray-400"></span>
                                Unknown
                              </span>
                            )
                          })()}
                        </td>

                        {/* Data Health Status */}
                        <td className="py-3 px-3">
                          {vtu.statusBadge === "EXPIRED" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              EXPIRED ({vtu.lastDataDaysAgo}d ago)
                            </span>
                          )}
                          {vtu.statusBadge === "EXPIRING_SOON" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              {vtu.daysUntilExpiry}d left
                            </span>
                          )}
                          {vtu.statusBadge === "ACTIVE" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Active ({vtu.daysUntilExpiry}d left)
                            </span>
                          )}
                          {vtu.statusBadge === "NEVER_LOADED" && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              Never Topped Up
                            </span>
                          )}
                        </td>

                        {/* Last Data Loaded Details */}
                        <td className="py-3 px-3">
                          {vtu.lastDataPlan ? (
                            <div>
                              <div className="font-semibold text-gray-800 text-[11px]">
                                {vtu.lastDataPlan}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                {vtu.lastDataFormattedDate} ({vtu.lastDataDaysAgo}d ago)
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Protocol */}
                        <td className="py-3 px-3 font-mono text-[11px] text-gray-500">
                          {v.protocol || "—"}
                        </td>

                        {/* Action: Quick Link to Diagnostic Station */}
                        <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/trackers?inspect=${v.normalizedPhone}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="divide-y divide-gray-100 lg:hidden">
              {vehicles.map((v) => {
                const isSelected = selectedVehicleIds.has(v.id)
                const net = v.network ? NETWORK_COLORS[v.network.id] : null
                const vtu = v.vtuHistory

                return (
                  <div
                    key={v.id}
                    onClick={() => handleToggleSelect(v.id)}
                    className={`p-4 space-y-2.5 transition-colors cursor-pointer ${
                      isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(v.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{v.name}</span>
                          </div>
                          {v.plateNumber && (
                            <span className="inline-block mt-0.5 font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {v.plateNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {/* Tracker Moving / Idle / Offline Status */}
                        {(() => {
                          const isOnlineOrAck = v.onlineStatus === "online" || v.onlineStatus === "ack"
                          const isMoving = isOnlineOrAck && typeof v.speed === "number" && v.speed > 0
                          const isIdle = isOnlineOrAck && !isMoving
                          const isOffline = v.onlineStatus === "offline"

                          if (isMoving) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
                                </span>
                                Moving ({Math.round(v.speed as number)} km/h)
                              </span>
                            )
                          }

                          if (isIdle) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <span className="inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                Idle
                              </span>
                            )
                          }

                          if (isOffline) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <span className="inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                                Offline
                              </span>
                            )
                          }

                          return null
                        })()}

                        {/* Data health badge */}
                        {vtu.statusBadge === "EXPIRED" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            Data EXPIRED
                          </span>
                        )}
                        {vtu.statusBadge === "EXPIRING_SOON" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            {vtu.daysUntilExpiry}d data left
                          </span>
                        )}
                        {vtu.statusBadge === "ACTIVE" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Data Active ({vtu.daysUntilExpiry}d)
                          </span>
                        )}
                        {vtu.statusBadge === "NEVER_LOADED" && (
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                            No VTU Record
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 text-xs">
                      <div className="flex items-center gap-1.5">
                        {net && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${net.bg} ${net.text} ${net.border}`}
                          >
                            {net.label}
                          </span>
                        )}
                        <span className="font-mono font-bold text-gray-900 text-xs">
                          {v.normalizedPhone || v.rawSimNumber || "No SIM"}
                        </span>
                      </div>

                      <div className="text-[11px] text-gray-500">
                        {vtu.lastDataPlan ? (
                          <span>
                            {vtu.lastDataPlan} ({vtu.lastDataDaysAgo}d ago)
                          </span>
                        ) : (
                          <span className="text-gray-400">Never topped up</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. RECHARGE RESULTS MODAL */}
      {rechargeModalOpen && rechargeProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  {isRecharging ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">
                    {isRecharging ? "Dispensing Fleet Data Bundles..." : "Recharge Batch Complete"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Processed {rechargeProgress.completed} of {rechargeProgress.total} vehicles
                  </p>
                </div>
              </div>
            </div>

            {/* Results List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 text-xs">
              {rechargeProgress.results.map((res, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-gray-900">{res.vehicleName}</div>
                    <div className="font-mono text-[11px] text-gray-500">{res.phone}</div>
                  </div>
                  <div className="text-right">
                    {res.status === "SUCCESS" ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Dispensed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[10px]">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        {res.message || "Failed"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {rechargeProgress.summaryError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                {rechargeProgress.summaryError}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button
                disabled={isRecharging}
                onClick={() => setRechargeModalOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 h-9 rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
