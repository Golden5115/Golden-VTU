"use client"

import { useState, useTransition, useRef } from "react"
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
  ChevronLeft,
  ChevronRight,
  Info,
  ExternalLink,
  Wallet,
  AlertCircle,
  X,
  Database,
  Signal,
  History,
  Sparkles,
  CloudDownload,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  searchCustomerFleet,
  searchDirectTrackers,
  getOfflineVehicles,
  syncOfflineVehiclesBatch,
  rechargeSingleVehicle,
  verifyDeviceLiveStatus,
  type FleetTrackerDevice,
  type CustomerFleetResult,
  type GetOfflineVehiclesResult,
} from "@/actions/cartracker.actions"
import { checkSimHistory, type SimDiagnosticHistory } from "@/actions/sim-history.actions"
import { ServerBadge } from "@/components/vtu/ServerBadge"
import { extractValidityDays, detectNetwork } from "@/lib/phone-utils"

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
  initialOfflineData?: GetOfflineVehiclesResult
}

const NETWORK_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  "01": { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", label: "MTN" },
  "02": { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", label: "GLO" },
  "03": { bg: "bg-green-100", text: "text-green-800", border: "border-green-300", label: "9MOBILE" },
  "04": { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300", label: "AIRTEL" },
  MTN: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", label: "MTN" },
  GLO: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", label: "GLO" },
  Glo: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", label: "GLO" },
  "9MOBILE": { bg: "bg-green-100", text: "text-green-800", border: "border-green-300", label: "9MOBILE" },
  "9Mobile": { bg: "bg-green-100", text: "text-green-800", border: "border-green-300", label: "9MOBILE" },
  AIRTEL: { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300", label: "AIRTEL" },
  Airtel: { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300", label: "AIRTEL" },
}

export function FleetTroubleshootClient({
  initialWalletBalance,
  servers,
  availablePlans,
  initialOfflineData,
}: FleetTroubleshootClientProps) {
  // Navigation Search Mode: "email" (Tab 1), "direct" (Tab 2), "offline" (Tab 3)
  const [activeTab, setActiveTab] = useState<"email" | "direct" | "offline">("email")

  // Wallet State
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)

  // Copy feedback
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(null), 2000)
  }

  // -------------------------------------------------------------
  // TAB 1: 10,000+ OFFLINE VEHICLES (LOCAL INDEXED POSTGRESQL)
  // -------------------------------------------------------------
  const [offlineVehicles, setOfflineVehicles] = useState(initialOfflineData?.vehicles || [])
  const [offlineTotal, setOfflineTotal] = useState(initialOfflineData?.total || 0)
  const [offlinePage, setOfflinePage] = useState(initialOfflineData?.page || 1)
  const [offlineTotalPages, setOfflineTotalPages] = useState(initialOfflineData?.totalPages || 1)
  const [offlineSummary, setOfflineSummary] = useState(
    initialOfflineData?.summary || {
      totalOffline: 0,
      criticalCount: 0,
      expiredCount: 0,
      neverLoadedCount: 0,
      activeCount: 0,
      lastSyncAt: null,
    }
  )

  // Offline Filters
  const [offlineSearch, setOfflineSearch] = useState("")
  const [offlineDaysFilter, setOfflineDaysFilter] = useState("all")
  const [offlineVtuFilter, setOfflineVtuFilter] = useState("all")
  const [offlineNetworkFilter, setOfflineNetworkFilter] = useState("all")
  const [isLoadingOffline, startOfflineTransition] = useTransition()

  // Refetch offline vehicles with current filters
  const fetchOfflinePage = (
    pageNumber: number = 1,
    overrides?: {
      search?: string
      days?: string
      vtu?: string
      network?: string
    }
  ) => {
    const s = overrides?.search !== undefined ? overrides.search : offlineSearch
    const d = overrides?.days !== undefined ? overrides.days : offlineDaysFilter
    const v = overrides?.vtu !== undefined ? overrides.vtu : offlineVtuFilter
    const n = overrides?.network !== undefined ? overrides.network : offlineNetworkFilter

    startOfflineTransition(async () => {
      const res = await getOfflineVehicles({
        page: pageNumber,
        limit: 50,
        search: s,
        daysOfflineFilter: d,
        vtuStatusFilter: v,
        networkFilter: n,
      })
      if (res.success) {
        setOfflineVehicles(res.vehicles)
        setOfflineTotal(res.total)
        setOfflinePage(res.page)
        setOfflineTotalPages(res.totalPages)
        setOfflineSummary(res.summary)
      }
    })
  }

  const handleOfflineSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchOfflinePage(1, { search: offlineSearch })
  }

  // 1-Click Real-Time Live Status Verification
  const [checkingDeviceId, setCheckingDeviceId] = useState<number | null>(null)
  const [liveVerifiedStatus, setLiveVerifiedStatus] = useState<
    Record<number, { isOnline: boolean; message: string; time: string | null }>
  >({})
  const [liveBanner, setLiveBanner] = useState<{
    type: "success" | "info" | "error"
    message: string
  } | null>(null)

  const handleCheckLiveStatus = async (cartrackerId: number, vehicleName: string) => {
    setCheckingDeviceId(cartrackerId)
    setLiveBanner(null)
    try {
      const res = await verifyDeviceLiveStatus(cartrackerId)
      setLiveVerifiedStatus((prev) => ({
        ...prev,
        [cartrackerId]: {
          isOnline: res.isOnline,
          message: res.message,
          time: res.time,
        },
      }))

      if (res.isOnline) {
        setLiveBanner({
          type: "success",
          message: `🟢 ${vehicleName} is ONLINE (${res.onlineStatus.toUpperCase()})! Connected: ${res.time || "Just now"}. Automatically pruned from offline list.`,
        })
        setTimeout(() => {
          setOfflineVehicles((prev) => prev.filter((v) => v.cartrackerId !== cartrackerId))
          setOfflineTotal((prev) => Math.max(0, prev - 1))
        }, 2200)
      } else {
        setLiveBanner({
          type: "info",
          message: `📡 ${vehicleName} is confirmed OFFLINE. Last heartbeat: ${res.time || "No recent signal"}.`,
        })
      }
    } catch (err: any) {
      setLiveBanner({
        type: "error",
        message: err.message || "Failed to verify live connection with CarTracker server.",
      })
    } finally {
      setCheckingDeviceId(null)
    }
  }

  // Live Batch Syncing Engine from CarTracker Nigeria
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<{
    page: number
    scanned: number
    offlineSynced: number
    isDone: boolean
    error?: string
  }>({ page: 0, scanned: 0, offlineSynced: 0, isDone: false })
  const abortSyncRef = useRef(false)

  const handleStartCarTrackerSync = async () => {
    setSyncModalOpen(true)
    setIsSyncing(true)
    abortSyncRef.current = false
    setSyncProgress({ page: 0, scanned: 0, offlineSynced: 0, isDone: false })

    let currentPage = 1
    let totalScanned = 0
    let totalOfflineInDb = 0
    const maxPages = 35 // ~17,500 devices at 500/page

    try {
      while (currentPage <= maxPages && !abortSyncRef.current) {
        const batchRes = await syncOfflineVehiclesBatch(currentPage, 500)
        if (!batchRes.success) {
          setSyncProgress((prev) => ({
            ...prev,
            error: batchRes.error || `Sync error on batch ${currentPage}`,
            isDone: true,
          }))
          break
        }

        totalScanned += batchRes.batchItemsCount
        totalOfflineInDb = batchRes.totalSyncedSoFar

        setSyncProgress({
          page: currentPage,
          scanned: totalScanned,
          offlineSynced: totalOfflineInDb,
          isDone: batchRes.isDone,
        })

        if (batchRes.isDone || batchRes.batchItemsCount < 500) {
          break
        }

        currentPage++
      }
    } catch (err: any) {
      setSyncProgress((prev) => ({
        ...prev,
        error: err.message || "CarTracker sync interrupted.",
        isDone: true,
      }))
    } finally {
      setIsSyncing(false)
      // Refresh local table with freshly synchronized data
      fetchOfflinePage(1)
    }
  }

  const handleStopSync = () => {
    abortSyncRef.current = true
    setIsSyncing(false)
    fetchOfflinePage(1)
  }

  // -------------------------------------------------------------
  // TAB 2 & 3: CUSTOMER FLEET (EMAIL) & DIRECT SEARCH
  // -------------------------------------------------------------
  const [emailInput, setEmailInput] = useState("")
  const [directQuery, setDirectQuery] = useState("")
  const [isSearchingOnline, startOnlineSearchTransition] = useTransition()
  const [customerInfo, setCustomerInfo] = useState<CustomerFleetResult["client"] | null>(null)
  const [liveVehicles, setLiveVehicles] = useState<FleetTrackerDevice[]>([])
  const [onlineSearchError, setOnlineSearchError] = useState<string | null>(null)
  const [hasSearchedOnline, setHasSearchedOnline] = useState(false)

  // Handle Mode A: Email Search
  const handleSearchEmail = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const email = emailInput.trim()
    if (!email) return

    setOnlineSearchError(null)
    setCustomerInfo(null)
    setLiveVehicles([])

    startOnlineSearchTransition(async () => {
      setHasSearchedOnline(true)
      const res = await searchCustomerFleet(email)
      if (!res.success) {
        setOnlineSearchError(res.error || "No customer account found.")
      } else {
        setCustomerInfo(res.client || null)
        setLiveVehicles(res.vehicles)
      }
    })
  }

  // Handle Mode B: Direct Search
  const handleSearchDirect = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const query = directQuery.trim()
    if (!query) return

    setOnlineSearchError(null)
    setCustomerInfo(null)
    setLiveVehicles([])

    startOnlineSearchTransition(async () => {
      setHasSearchedOnline(true)
      const res = await searchDirectTrackers(query)
      if (!res.success) {
        setOnlineSearchError(res.error || "No matching vehicles found.")
      } else {
        setLiveVehicles(res.vehicles)
        if (res.vehicles.length === 0) {
          setOnlineSearchError(`No tracker found matching "${query}" on Car Tracker Nigeria.`)
        }
      }
    })
  }

  // -------------------------------------------------------------
  // SINGLE VEHICLE RECHARGE MODAL (PER VEHICLE ONLY)
  // -------------------------------------------------------------
  const [singleRechargeModalOpen, setSingleRechargeModalOpen] = useState(false)
  const [targetVehicle, setTargetVehicle] = useState<{
    vehicleId: number
    vehicleName: string
    plateNumber: string
    phone: string
    network: string | null
    imei?: string
  } | null>(null)

  // Default server route (Prefers Server 2 / Pairgate while Server 1 is offline)
  const defaultServer = servers.find((s) => s.isDefault) || servers.find((s) => s.id === "pairgate") || servers[0]
  const [modalServerId, setModalServerId] = useState(defaultServer?.id || "")
  const [modalPlanValue, setModalPlanValue] = useState("")
  const [isDispensing, setIsDispensing] = useState(false)
  const [rechargeFeedback, setRechargeFeedback] = useState<{
    success: boolean
    reference?: string
    message?: string
    error?: string
  } | null>(null)

  const openSingleRechargeModal = (vehicle: {
    vehicleId: number
    vehicleName: string
    plateNumber: string
    phone: string
    network: string | null
    imei?: string
  }) => {
    setTargetVehicle(vehicle)
    setRechargeFeedback(null)
    setModalServerId(defaultServer?.id || servers[0]?.id || "")
    setModalPlanValue("")
    setSingleRechargeModalOpen(true)
  }

  // Parse selected plan in modal
  const [planId, planPriceStr, rawPlanName, planValidity] = modalPlanValue.split("::")
  const planPrice = Number(planPriceStr || 0)
  const planName = planValidity && !rawPlanName?.toLowerCase().includes("day") ? `${rawPlanName} (${planValidity})` : rawPlanName

  // Resolve network ID for recharge
  const detectedNet = targetVehicle?.phone ? detectNetwork(targetVehicle.phone) : null
  const targetNetworkId = detectedNet?.id || (targetVehicle?.network ? (NETWORK_COLORS[targetVehicle.network]?.label === "AIRTEL" ? "04" : NETWORK_COLORS[targetVehicle.network]?.label === "GLO" ? "02" : NETWORK_COLORS[targetVehicle.network]?.label === "9MOBILE" ? "03" : "01") : "01")

  const handleExecuteSingleRecharge = async () => {
    if (!targetVehicle) return
    if (!modalPlanValue) {
      alert("Please select a data bundle from the dropdown.")
      return
    }

    if (walletBalance < planPrice) {
      alert(`Insufficient wallet balance. Required: ₦${planPrice.toLocaleString()}, Balance: ₦${walletBalance.toLocaleString()}. Please fund your wallet.`)
      return
    }

    setIsDispensing(true)
    setRechargeFeedback(null)

    try {
      const res = await rechargeSingleVehicle({
        vehicleId: targetVehicle.vehicleId,
        vehicleName: targetVehicle.vehicleName,
        phone: targetVehicle.phone,
        networkId: targetNetworkId,
        dataPlanId: planId,
        planName: planName || "1.0GB SME Data",
        amount: planPrice,
        validityDays: extractValidityDays(planValidity || planName || "", 30),
        serverId: modalServerId,
      })

      if (res.success) {
        setWalletBalance(res.newWalletBalance)
        setRechargeFeedback({
          success: true,
          reference: res.reference,
          message: res.message || "Data dispensed successfully!",
        })

        // Update vehicle state immediately in UI
        setOfflineVehicles((prev) =>
          prev.map((v) =>
            v.cartrackerId === targetVehicle.vehicleId
              ? {
                  ...v,
                  vtuStatus: "ACTIVE",
                  hasVtuRecord: true,
                  lastDataPlan: planName,
                  lastDataAmount: planPrice,
                  lastDataDate: new Date().toISOString(),
                }
              : v
          )
        )

        setLiveVehicles((prev) =>
          prev.map((v) =>
            v.id === targetVehicle.vehicleId
              ? {
                  ...v,
                  vtuHistory: {
                    ...v.vtuHistory,
                    hasRecord: true,
                    lastDataPlan: planName,
                    lastDataAmount: planPrice,
                    statusBadge: "ACTIVE",
                    isExpired: false,
                    isExpiringSoon: false,
                  },
                }
              : v
          )
        )
      } else {
        setRechargeFeedback({
          success: false,
          error: res.error || "Failed to dispense data.",
        })
      }
    } catch (err: any) {
      setRechargeFeedback({
        success: false,
        error: err.message || "Server communication error.",
      })
    } finally {
      setIsDispensing(false)
    }
  }

  // -------------------------------------------------------------
  // SIM DIAGNOSTIC HISTORY MODAL
  // -------------------------------------------------------------
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyVehicle, setHistoryVehicle] = useState<{ name: string; plate: string; phone: string } | null>(null)
  const [historyData, setHistoryData] = useState<SimDiagnosticHistory | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const openSimHistoryModal = async (vehicle: { name: string; plate: string; phone: string }) => {
    setHistoryVehicle(vehicle)
    setHistoryData(null)
    setIsLoadingHistory(true)
    setHistoryModalOpen(true)

    try {
      const diag = await checkSimHistory(vehicle.phone)
      setHistoryData(diag)
    } catch (err) {
      console.error("Failed to load SIM history:", err)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER & TELEMETRY STATUS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-lg sm:rounded-xl text-indigo-400 shrink-0">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-black tracking-tight">Troubleshoot Section</h1>
              <p className="text-[10px] sm:text-xs text-slate-300">
                Car Tracker Nigeria Offline Fleet Diagnostic Telemetry & Per-Vehicle SIM Bundle Management
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg sm:rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2 sm:gap-3">
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-semibold">Available Wallet</div>
              <div className="text-xs sm:text-sm font-bold text-emerald-400 font-mono">
                ₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] sm:text-xs font-semibold shrink-0">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="hidden sm:inline">app.cartracker.com.ng Live</span>
            <span className="sm:hidden">Live Sync</span>
          </div>
        </div>
      </div>

      {/* 2. MODE SELECTOR TABS */}
      <Card className="border border-slate-200/90 shadow-sm rounded-xl sm:rounded-2xl overflow-hidden bg-white">
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1 sm:p-1.5 gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className={`flex-1 py-2 sm:py-2.5 px-1.5 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-2 ${
              activeTab === "email"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
            <span className="hidden sm:inline">Search Customer Account (Email)</span>
            <span className="sm:hidden">Customer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`flex-1 py-2 sm:py-2.5 px-1.5 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-2 ${
              activeTab === "direct"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
            <span className="hidden sm:inline">Direct Tracker Search (SIM / IMEI / Plate)</span>
            <span className="sm:hidden">Tracker</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("offline")}
            className={`flex-1 py-2 sm:py-2.5 px-1.5 sm:px-4 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-2 ${
              activeTab === "offline"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
            <span className="hidden sm:inline">Offline Fleet Engine (10,000+)</span>
            <span className="sm:hidden">Offline</span>
            {offlineSummary.totalOffline > 0 && (
              <span className="px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full text-[9px] sm:text-[10px] bg-rose-100 text-rose-800 font-bold font-mono">
                {offlineSummary.totalOffline > 999
                  ? `${(offlineSummary.totalOffline / 1000).toFixed(1)}k`
                  : offlineSummary.totalOffline.toLocaleString()}
              </span>
            )}
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: OFFLINE FLEET ENGINE VIEW (10,000+ VEHICLES)            */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "offline" && (
          <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            {/* Top Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              <div className="p-2.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Offline</div>
                <div className="text-base sm:text-xl font-black text-slate-900 font-mono mt-0.5">
                  {offlineSummary.totalOffline.toLocaleString()}
                </div>
                <div className="text-[9px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1">From CarTracker</div>
              </div>

              <div className="p-2.5 sm:p-4 rounded-xl bg-rose-50 border border-rose-200">
                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-rose-600 tracking-wider">Critical (&gt;30d)</div>
                <div className="text-base sm:text-xl font-black text-rose-800 font-mono mt-0.5">
                  {offlineSummary.criticalCount.toLocaleString()}
                </div>
                <div className="text-[9px] sm:text-[11px] text-rose-600 mt-0.5 sm:mt-1">Prolonged Offline</div>
              </div>

              <div className="p-2.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-700 tracking-wider">Data Expired</div>
                <div className="text-base sm:text-xl font-black text-amber-900 font-mono mt-0.5">
                  {offlineSummary.expiredCount.toLocaleString()}
                </div>
                <div className="text-[9px] sm:text-[11px] text-amber-700 mt-0.5 sm:mt-1">Needs Data Recharge</div>
              </div>

              <div className="p-2.5 sm:p-4 rounded-xl bg-purple-50 border border-purple-200">
                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-purple-700 tracking-wider">Never Loaded</div>
                <div className="text-base sm:text-xl font-black text-purple-900 font-mono mt-0.5">
                  {offlineSummary.neverLoadedCount.toLocaleString()}
                </div>
                <div className="text-[9px] sm:text-[11px] text-purple-700 mt-0.5 sm:mt-1">No Past VTU Record</div>
              </div>

              <div className="p-2.5 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200 col-span-2 sm:col-span-1">
                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Active Data</div>
                <div className="text-base sm:text-xl font-black text-emerald-900 font-mono mt-0.5">
                  {offlineSummary.activeCount.toLocaleString()}
                </div>
                <div className="text-[9px] sm:text-[11px] text-emerald-700 mt-0.5 sm:mt-1">Possible HW/GPS Fault</div>
              </div>
            </div>

            {/* Sync Bar & Filter Controls */}
            <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-200/80 pb-2.5 sm:pb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 sm:h-2.5 w-2 sm:w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 sm:h-2.5 w-2 sm:w-2.5 bg-rose-600"></span>
                  </span>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-800">
                    Offline Telemetry Engine
                  </span>
                  <span className="text-[10px] sm:text-xs text-slate-500">
                    • ({offlineTotal.toLocaleString()} cached)
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                  {offlineSummary.lastSyncAt && (
                    <span className="text-[10px] sm:text-[11px] text-slate-500">
                      Synced: {new Date(offlineSummary.lastSyncAt).toLocaleDateString()} {new Date(offlineSummary.lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <Button
                    type="button"
                    onClick={handleStartCarTrackerSync}
                    disabled={isSyncing}
                    className="h-7 sm:h-8 px-2.5 sm:px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] sm:text-xs rounded-lg sm:rounded-xl shadow-xs inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                    <span>{isSyncing ? "Syncing..." : "Sync Live Fleet"}</span>
                  </Button>
                </div>
              </div>

              {/* Filter inputs */}
              <form onSubmit={handleOfflineSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-2.5 top-2.5 text-slate-400" />
                  <Input
                    placeholder="Search plate, name, SIM, or IMEI..."
                    value={offlineSearch}
                    onChange={(e) => setOfflineSearch(e.target.value)}
                    className="pl-8 sm:pl-9 h-8 sm:h-9 text-[11px] sm:text-xs bg-white border-slate-200"
                  />
                </div>

                {/* Days Offline Filter */}
                <select
                  value={offlineDaysFilter}
                  onChange={(e) => {
                    const val = e.target.value
                    setOfflineDaysFilter(val)
                    fetchOfflinePage(1, { days: val })
                  }}
                  className="h-8 sm:h-9 border border-slate-200 rounded-lg px-2.5 text-[11px] sm:text-xs bg-white font-medium text-slate-800"
                >
                  <option value="all">All Days Offline</option>
                  <option value="<1">Within 24 Hours (&lt; 1 Day)</option>
                  <option value="1-7">Recent Offline (1 - 7 Days)</option>
                  <option value="7-30">Medium Offline (7 - 30 Days)</option>
                  <option value="30-90">Long Offline (30 - 90 Days)</option>
                  <option value="90+">Critical Offline (&gt; 90 Days)</option>
                </select>

                {/* VTU Status Filter */}
                <select
                  value={offlineVtuFilter}
                  onChange={(e) => {
                    const val = e.target.value
                    setOfflineVtuFilter(val)
                    fetchOfflinePage(1, { vtu: val })
                  }}
                  className="h-8 sm:h-9 border border-slate-200 rounded-lg px-2.5 text-[11px] sm:text-xs bg-white font-medium text-slate-800"
                >
                  <option value="all">All VTU Statuses</option>
                  <option value="EXPIRED">Data Expired (Needs Top-up)</option>
                  <option value="EXPIRING_SOON">Expiring Soon (≤3 Days)</option>
                  <option value="NEVER_LOADED">Never Loaded via VTU</option>
                  <option value="ACTIVE">Data Active (Check Hardware/GPS)</option>
                </select>

                {/* Network Filter & Search Button */}
                <div className="flex items-center gap-2">
                  <select
                    value={offlineNetworkFilter}
                    onChange={(e) => {
                      const val = e.target.value
                      setOfflineNetworkFilter(val)
                      fetchOfflinePage(1, { network: val })
                    }}
                    className="flex-1 h-8 sm:h-9 border border-slate-200 rounded-lg px-2.5 text-[11px] sm:text-xs bg-white font-medium text-slate-800"
                  >
                    <option value="all">All Networks</option>
                    <option value="MTN">MTN</option>
                    <option value="Airtel">Airtel</option>
                    <option value="Glo">Glo</option>
                    <option value="9mobile">9mobile</option>
                  </select>

                  <Button
                    type="submit"
                    disabled={isLoadingOffline}
                    className="h-8 sm:h-9 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] sm:text-xs rounded-lg shrink-0 inline-flex items-center gap-1"
                  >
                    {isLoadingOffline && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Filter</span>
                  </Button>
                </div>
              </form>
            </div>

            {/* Live Status Ping Banner */}
            {liveBanner && (
              <div
                className={`p-3 rounded-xl sm:rounded-2xl border text-xs font-semibold flex items-center justify-between transition-all animate-fadeIn ${
                  liveBanner.type === "success"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : liveBanner.type === "error"
                    ? "bg-rose-50 border-rose-300 text-rose-900"
                    : "bg-indigo-50 border-indigo-200 text-indigo-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  {liveBanner.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : liveBanner.type === "error" ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <Radio className="w-4 h-4 text-indigo-600 shrink-0 animate-pulse" />
                  )}
                  <span>{liveBanner.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLiveBanner(null)}
                  className="text-slate-400 hover:text-slate-700 ml-2 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Offline Vehicles Table (50 per page) */}
            <div className="border border-slate-200/90 rounded-xl sm:rounded-2xl overflow-hidden bg-white shadow-2xs">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Vehicle & Plate</th>
                      <th className="py-3 px-4">Tracker SIM</th>
                      <th className="py-3 px-4">Tracker IMEI</th>
                      <th className="py-3 px-4">Offline Duration</th>
                      <th className="py-3 px-4">Last Heartbeat</th>
                      <th className="py-3 px-4">VTU Data Health</th>
                      <th className="py-3 px-4 text-right">Individual Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoadingOffline ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                          <span className="text-xs font-semibold">Loading offline vehicles...</span>
                        </td>
                      </tr>
                    ) : offlineVehicles.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <Database className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <div className="text-sm font-bold text-slate-800">No Offline Vehicles Found</div>
                          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                            {offlineTotal === 0
                              ? "Click 'Sync from CarTracker Live' above to scan and cache the ~10,000 offline vehicles."
                              : "No records match the active filters or search term."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      offlineVehicles.map((v) => {
                        const netColor = v.network ? NETWORK_COLORS[v.network] : null

                        return (
                          <tr key={v.id} className="transition-colors hover:bg-slate-50/80">
                            {/* Vehicle & Plate */}
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <Car className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span>{v.name}</span>
                              </div>
                              {v.plateNumber ? (
                                <span className="inline-block mt-0.5 font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {v.plateNumber}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No plate set</span>
                              )}
                            </td>

                            {/* SIM Number */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-semibold text-slate-800">
                                  {v.normalizedPhone || v.rawSimNumber || "No SIM"}
                                </span>
                                {(v.normalizedPhone || v.rawSimNumber) && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(v.normalizedPhone || v.rawSimNumber)}
                                    className="text-slate-400 hover:text-indigo-600"
                                  >
                                    {copiedText === (v.normalizedPhone || v.rawSimNumber) ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                              {v.network && (
                                <span
                                  className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                    netColor ? `${netColor.bg} ${netColor.text} ${netColor.border}` : "bg-slate-100 text-slate-700 border-slate-200"
                                  }`}
                                >
                                  {v.network}
                                </span>
                              )}
                            </td>

                            {/* IMEI */}
                            <td className="py-3 px-4">
                              <span className="font-mono text-[11px] text-slate-600">{v.imei || "—"}</span>
                            </td>

                            {/* Days Offline Badge */}
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                  v.daysOffline >= 90
                                    ? "bg-rose-100 border-rose-300 text-rose-900"
                                    : v.daysOffline >= 30
                                    ? "bg-rose-50 border-rose-200 text-rose-800"
                                    : v.daysOffline >= 7
                                    ? "bg-amber-50 border-amber-200 text-amber-800"
                                    : v.daysOffline >= 1
                                    ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    v.daysOffline >= 30
                                      ? "bg-rose-600 animate-pulse"
                                      : v.daysOffline >= 1
                                      ? "bg-amber-500"
                                      : "bg-emerald-600"
                                  }`}
                                />
                                {v.daysOffline === 0 ? "Today (<24h)" : `${v.daysOffline}d offline`}
                              </span>
                            </td>

                            {/* Last Heartbeat */}
                            <td className="py-3 px-4">
                              {v.lastHeartbeat ? (
                                <div className="text-slate-700">
                                  <div>{new Date(v.lastHeartbeat).toLocaleDateString()}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {new Date(v.lastHeartbeat).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Expired / Unknown</span>
                              )}
                            </td>

                            {/* VTU Data Health */}
                            <td className="py-3 px-4">
                              {v.vtuStatus === "EXPIRED" && (
                                <div>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    Data Expired
                                  </span>
                                  {v.lastDataPlan && (
                                    <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[130px]">
                                      {v.lastDataPlan}
                                    </div>
                                  )}
                                </div>
                              )}
                              {v.vtuStatus === "EXPIRING_SOON" && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  Expiring Soon
                                </span>
                              )}
                              {v.vtuStatus === "ACTIVE" && (
                                <div>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                                    Active Data
                                  </span>
                                  <div className="text-[10px] text-emerald-700 mt-0.5">Check GPS Hardware</div>
                                </div>
                              )}
                              {v.vtuStatus === "NEVER_LOADED" && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  Never Loaded
                                </span>
                              )}
                            </td>

                            {/* Per-Vehicle Actions (NO BULK RECHARGE) */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* 1-Click Live Status Ping Button */}
                                <button
                                  type="button"
                                  onClick={() => handleCheckLiveStatus(v.cartrackerId, v.name)}
                                  disabled={checkingDeviceId === v.cartrackerId}
                                  title="Ping real-time live status from CarTracker server"
                                  className={`h-8 px-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 transition-all ${
                                    liveVerifiedStatus[v.cartrackerId]?.isOnline
                                      ? "bg-emerald-500 text-white border-emerald-600 animate-pulse"
                                      : liveVerifiedStatus[v.cartrackerId]
                                      ? "bg-slate-100 text-slate-700 border-slate-300"
                                      : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs"
                                  }`}
                                >
                                  {checkingDeviceId === v.cartrackerId ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                  ) : (
                                    <Radio className="w-3 h-3 text-indigo-600" />
                                  )}
                                  <span>
                                    {checkingDeviceId === v.cartrackerId
                                      ? "Pinging..."
                                      : liveVerifiedStatus[v.cartrackerId]?.isOnline
                                      ? "ONLINE"
                                      : "Live Ping"}
                                  </span>
                                </button>

                                <Button
                                  type="button"
                                  onClick={() =>
                                    openSingleRechargeModal({
                                      vehicleId: v.cartrackerId,
                                      vehicleName: v.name,
                                      plateNumber: v.plateNumber,
                                      phone: v.normalizedPhone || v.rawSimNumber,
                                      network: v.network,
                                      imei: v.imei,
                                    })
                                  }
                                  className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-2xs inline-flex items-center gap-1"
                                >
                                  <Zap className="w-3 h-3 text-amber-300" />
                                  <span>Recharge</span>
                                </Button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openSimHistoryModal({
                                      name: v.name,
                                      plate: v.plateNumber,
                                      phone: v.normalizedPhone || v.rawSimNumber,
                                    })
                                  }
                                  className="h-8 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1"
                                >
                                  <History className="w-3 h-3 text-slate-500" />
                                  <span className="hidden sm:inline">History</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List (Zero horizontal scrolling, dense touch-friendly actions) */}
              <div className="md:hidden divide-y divide-slate-100">
                {isLoadingOffline ? (
                  <div className="py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span className="text-xs font-semibold">Loading offline vehicles...</span>
                  </div>
                ) : offlineVehicles.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Database className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <div className="text-xs font-bold text-slate-800">No Offline Vehicles Found</div>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                      {offlineTotal === 0
                        ? "Click 'Sync Live Fleet' above to scan offline vehicles."
                        : "No records match the active filters or search term."}
                    </p>
                  </div>
                ) : (
                  offlineVehicles.map((v) => {
                    const netColor = v.network ? NETWORK_COLORS[v.network] : null

                    return (
                      <div key={`m-off-${v.id}`} className="p-3 bg-white hover:bg-slate-50/70 transition-colors space-y-2">
                        {/* Row 1: Vehicle Name & Plate + Days offline badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
                              <Car className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span className="truncate">{v.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {v.plateNumber ? (
                                <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {v.plateNumber}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No plate</span>
                              )}
                              {v.imei && (
                                <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                                  IMEI: {v.imei}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Days offline badge */}
                          <span
                            className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              v.daysOffline >= 90
                                ? "bg-rose-100 border-rose-300 text-rose-900"
                                : v.daysOffline >= 30
                                ? "bg-rose-50 border-rose-200 text-rose-800"
                                : v.daysOffline >= 7
                                ? "bg-amber-50 border-amber-200 text-amber-800"
                                : v.daysOffline >= 1
                                ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                                : "bg-emerald-50 border-emerald-200 text-emerald-800"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                v.daysOffline >= 30
                                  ? "bg-rose-600 animate-pulse"
                                  : v.daysOffline >= 1
                                  ? "bg-amber-500"
                                  : "bg-emerald-600"
                              }`}
                            />
                            {v.daysOffline === 0 ? "Today (<24h)" : `${v.daysOffline}d offline`}
                          </span>
                        </div>

                        {/* Row 2: SIM, Network, VTU Health Badge */}
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-[11px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {v.network && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${
                                  netColor ? `${netColor.bg} ${netColor.text} ${netColor.border}` : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {v.network}
                              </span>
                            )}
                            <span className="font-mono font-semibold text-slate-800 truncate text-[11px]">
                              {v.normalizedPhone || v.rawSimNumber || "No SIM"}
                            </span>
                            {(v.normalizedPhone || v.rawSimNumber) && (
                              <button
                                type="button"
                                onClick={() => handleCopy(v.normalizedPhone || v.rawSimNumber)}
                                className="text-slate-400 hover:text-indigo-600 shrink-0"
                              >
                                {copiedText === (v.normalizedPhone || v.rawSimNumber) ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* VTU Data Badge */}
                          <div className="shrink-0">
                            {v.vtuStatus === "EXPIRED" && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                                <XCircle className="w-2.5 h-2.5 text-rose-600" />
                                Data Expired
                              </span>
                            )}
                            {v.vtuStatus === "EXPIRING_SOON" && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                Expiring Soon
                              </span>
                            )}
                            {v.vtuStatus === "ACTIVE" && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                                Active Data
                              </span>
                            )}
                            {v.vtuStatus === "NEVER_LOADED" && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Never Loaded
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Row 3: Heartbeat date & Quick Actions */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                          <div className="truncate">
                            {v.lastHeartbeat ? (
                              <span>Last: {new Date(v.lastHeartbeat).toLocaleDateString()}</span>
                            ) : (
                              <span className="italic text-slate-400">Offline / No signal</span>
                            )}
                            {v.lastDataPlan && (
                              <span className="ml-1 text-slate-400 truncate">• {v.lastDataPlan}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Mobile Live Ping Button */}
                            <button
                              type="button"
                              onClick={() => handleCheckLiveStatus(v.cartrackerId, v.name)}
                              disabled={checkingDeviceId === v.cartrackerId}
                              title="Ping real-time live status from CarTracker server"
                              className={`h-7 px-2 rounded-lg border text-[10px] font-semibold inline-flex items-center gap-1 transition-all ${
                                liveVerifiedStatus[v.cartrackerId]?.isOnline
                                  ? "bg-emerald-500 text-white border-emerald-600 animate-pulse"
                                  : liveVerifiedStatus[v.cartrackerId]
                                  ? "bg-slate-100 text-slate-700 border-slate-300"
                                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                              }`}
                            >
                              {checkingDeviceId === v.cartrackerId ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-600" />
                              ) : (
                                <Radio className="w-2.5 h-2.5 text-indigo-600" />
                              )}
                              <span>
                                {checkingDeviceId === v.cartrackerId
                                  ? "..."
                                  : liveVerifiedStatus[v.cartrackerId]?.isOnline
                                  ? "ONLINE"
                                  : "Ping"}
                              </span>
                            </button>

                            <Button
                              type="button"
                              onClick={() =>
                                openSingleRechargeModal({
                                  vehicleId: v.cartrackerId,
                                  vehicleName: v.name,
                                  plateNumber: v.plateNumber,
                                  phone: v.normalizedPhone || v.rawSimNumber,
                                  network: v.network,
                                  imei: v.imei,
                                })
                              }
                              className="h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg inline-flex items-center gap-1 shadow-2xs"
                            >
                              <Zap className="w-2.5 h-2.5 text-amber-300" />
                              <span>Recharge</span>
                            </Button>

                            <button
                              type="button"
                              onClick={() =>
                                openSimHistoryModal({
                                  name: v.name,
                                  plate: v.plateNumber,
                                  phone: v.normalizedPhone || v.rawSimNumber,
                                })
                              }
                              className="h-7 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-semibold"
                            >
                              History
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Server-Side Pagination Bar */}
              {offlineTotalPages > 1 && (
                <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-[11px] sm:text-xs text-slate-600">
                  <div className="text-center sm:text-left">
                    Showing{" "}
                    <span className="font-bold text-slate-900">
                      {(offlinePage - 1) * 50 + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-bold text-slate-900">
                      {Math.min(offlinePage * 50, offlineTotal)}
                    </span>{" "}
                    of <span className="font-bold text-slate-900">{offlineTotal.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      disabled={offlinePage <= 1 || isLoadingOffline}
                      onClick={() => fetchOfflinePage(offlinePage - 1)}
                      className="h-7 sm:h-8 px-2.5 sm:px-3 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] sm:text-xs rounded-lg shadow-2xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 mr-0.5 sm:mr-1" />
                      Prev
                    </Button>

                    <span className="font-semibold text-slate-700 px-1 sm:px-2 text-[11px] sm:text-xs">
                      Page {offlinePage} / {offlineTotalPages}
                    </span>

                    <Button
                      type="button"
                      disabled={offlinePage >= offlineTotalPages || isLoadingOffline}
                      onClick={() => fetchOfflinePage(offlinePage + 1)}
                      className="h-7 sm:h-8 px-2.5 sm:px-3 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] sm:text-xs rounded-lg shadow-2xs"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5 sm:ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: SEARCH CUSTOMER FLEET (BY EMAIL)                        */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "email" && (
          <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            <form onSubmit={handleSearchEmail} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  type="email"
                  placeholder="Enter customer email (e.g. client@example.com)..."
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="pl-8 sm:pl-9 h-9 sm:h-10 text-[11px] sm:text-xs bg-white border-slate-200"
                />
              </div>
              <Button
                type="submit"
                disabled={isSearchingOnline || !emailInput.trim()}
                className="h-9 sm:h-10 px-4 sm:px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] sm:text-xs rounded-xl shadow-xs shrink-0"
              >
                {isSearchingOnline ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5 mr-1.5" />
                    <span>Search Fleet</span>
                  </>
                )}
              </Button>
            </form>

            {customerInfo && (
              <div className="p-3 sm:p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-xs">
                <div>
                  <div className="font-bold text-indigo-950 text-xs sm:text-sm">{customerInfo.email}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Account ID: #{customerInfo.id} • {customerInfo.devicesCount} Total Registered Vehicles
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-indigo-600 text-white font-bold text-[10px] sm:text-xs shrink-0 self-start sm:self-auto">
                  {liveVehicles.length} Vehicles Loaded
                </span>
              </div>
            )}

            {/* Render Live Vehicles for Customer */}
            {liveVehicles.length > 0 && (
              <div className="border border-slate-200/90 rounded-xl sm:rounded-2xl overflow-hidden bg-white shadow-2xs">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Vehicle & Plate</th>
                        <th className="py-3 px-4">Tracker SIM</th>
                        <th className="py-3 px-4">IMEI</th>
                        <th className="py-3 px-4">Live Status</th>
                        <th className="py-3 px-4">VTU Health</th>
                        <th className="py-3 px-4 text-right">Individual Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {liveVehicles.map((v) => (
                        <tr key={v.id} className="transition-colors hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div>{v.name}</div>
                            {v.plateNumber && (
                              <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border">
                                {v.plateNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold">
                            {v.normalizedPhone || v.rawSimNumber}
                            {v.network && (
                              <span className="ml-1 text-[10px] px-1 rounded bg-slate-100 text-slate-600">
                                {v.network.name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">{v.imei}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                v.onlineStatus === "online"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {v.onlineStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                v.vtuHistory.statusBadge === "ACTIVE"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : v.vtuHistory.statusBadge === "EXPIRED"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {v.vtuHistory.statusBadge}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                onClick={() =>
                                  openSingleRechargeModal({
                                    vehicleId: v.id,
                                    vehicleName: v.name,
                                    plateNumber: v.plateNumber,
                                    phone: v.normalizedPhone || v.rawSimNumber,
                                    network: v.network?.name || null,
                                    imei: v.imei,
                                  })
                                }
                                className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1"
                              >
                                <Zap className="w-3 h-3 text-amber-300" />
                                <span>Recharge</span>
                              </Button>

                              <button
                                type="button"
                                onClick={() =>
                                  openSimHistoryModal({
                                    name: v.name,
                                    plate: v.plateNumber,
                                    phone: v.normalizedPhone || v.rawSimNumber,
                                  })
                                }
                                className="h-8 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                              >
                                History
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List (Zero horizontal scrolling) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {liveVehicles.map((v) => (
                    <div key={`m-cust-${v.id}`} className="p-3 bg-white hover:bg-slate-50/70 transition-colors space-y-2">
                      {/* Top: Name & Plate + Online/Offline Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate">{v.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {v.plateNumber ? (
                              <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {v.plateNumber}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No plate</span>
                            )}
                            {v.imei && (
                              <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                                IMEI: {v.imei}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            v.onlineStatus === "online"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {v.onlineStatus}
                        </span>
                      </div>

                      {/* Mid: SIM, Network, VTU Health */}
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {v.network && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                              {v.network.name}
                            </span>
                          )}
                          <span className="font-mono font-semibold text-slate-800 truncate text-[11px]">
                            {v.normalizedPhone || v.rawSimNumber || "No SIM"}
                          </span>
                          {(v.normalizedPhone || v.rawSimNumber) && (
                            <button
                              type="button"
                              onClick={() => handleCopy(v.normalizedPhone || v.rawSimNumber)}
                              className="text-slate-400 hover:text-indigo-600 shrink-0"
                            >
                              {copiedText === (v.normalizedPhone || v.rawSimNumber) ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>

                        <div className="shrink-0">
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                              v.vtuHistory.statusBadge === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800"
                                : v.vtuHistory.statusBadge === "EXPIRED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {v.vtuHistory.statusBadge}
                          </span>
                        </div>
                      </div>

                      {/* Bottom: Action buttons */}
                      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                        <Button
                          type="button"
                          onClick={() =>
                            openSingleRechargeModal({
                              vehicleId: v.id,
                              vehicleName: v.name,
                              plateNumber: v.plateNumber,
                              phone: v.normalizedPhone || v.rawSimNumber,
                              network: v.network?.name || null,
                              imei: v.imei,
                            })
                          }
                          className="h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Zap className="w-2.5 h-2.5 text-amber-300" />
                          <span>Recharge</span>
                        </Button>

                        <button
                          type="button"
                          onClick={() =>
                            openSimHistoryModal({
                              name: v.name,
                              plate: v.plateNumber,
                              phone: v.normalizedPhone || v.rawSimNumber,
                            })
                          }
                          className="h-7 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-semibold"
                        >
                          History
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: DIRECT TRACKER SEARCH (SIM, IMEI, PLATE)                */}
        {/* ------------------------------------------------------------- */}
        {activeTab === "direct" && (
          <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            <form onSubmit={handleSearchDirect} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  placeholder="Enter SIM phone number, IMEI, or vehicle plate number..."
                  value={directQuery}
                  onChange={(e) => setDirectQuery(e.target.value)}
                  className="pl-8 sm:pl-9 h-9 sm:h-10 text-[11px] sm:text-xs bg-white border-slate-200"
                />
              </div>
              <Button
                type="submit"
                disabled={isSearchingOnline || !directQuery.trim()}
                className="h-9 sm:h-10 px-4 sm:px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] sm:text-xs rounded-xl shadow-xs shrink-0"
              >
                {isSearchingOnline ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5 mr-1.5" />
                    <span>Search Direct</span>
                  </>
                )}
              </Button>
            </form>

            {onlineSearchError && (
              <div className="p-3 sm:p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] sm:text-xs font-medium">
                {onlineSearchError}
              </div>
            )}

            {/* Render Direct Match Vehicles */}
            {liveVehicles.length > 0 && (
              <div className="border border-slate-200/90 rounded-xl sm:rounded-2xl overflow-hidden bg-white shadow-2xs">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Vehicle & Plate</th>
                        <th className="py-3 px-4">Tracker SIM</th>
                        <th className="py-3 px-4">IMEI</th>
                        <th className="py-3 px-4">Live Status</th>
                        <th className="py-3 px-4">VTU Health</th>
                        <th className="py-3 px-4 text-right">Individual Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {liveVehicles.map((v) => (
                        <tr key={v.id} className="transition-colors hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div>{v.name}</div>
                            {v.plateNumber && (
                              <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border">
                                {v.plateNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold">
                            {v.normalizedPhone || v.rawSimNumber}
                            {v.network && (
                              <span className="ml-1 text-[10px] px-1 rounded bg-slate-100 text-slate-600">
                                {v.network.name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">{v.imei}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                v.onlineStatus === "online"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {v.onlineStatus}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                v.vtuHistory.statusBadge === "ACTIVE"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : v.vtuHistory.statusBadge === "EXPIRED"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {v.vtuHistory.statusBadge}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                onClick={() =>
                                  openSingleRechargeModal({
                                    vehicleId: v.id,
                                    vehicleName: v.name,
                                    plateNumber: v.plateNumber,
                                    phone: v.normalizedPhone || v.rawSimNumber,
                                    network: v.network?.name || null,
                                    imei: v.imei,
                                  })
                                }
                                className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg inline-flex items-center gap-1"
                              >
                                <Zap className="w-3 h-3 text-amber-300" />
                                <span>Recharge</span>
                              </Button>

                              <button
                                type="button"
                                onClick={() =>
                                  openSimHistoryModal({
                                    name: v.name,
                                    plate: v.plateNumber,
                                    phone: v.normalizedPhone || v.rawSimNumber,
                                  })
                                }
                                className="h-8 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                              >
                                History
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List (Zero horizontal scrolling) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {liveVehicles.map((v) => (
                    <div key={`m-dir-${v.id}`} className="p-3 bg-white hover:bg-slate-50/70 transition-colors space-y-2">
                      {/* Top: Name & Plate + Online/Offline Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate">{v.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {v.plateNumber ? (
                              <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {v.plateNumber}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No plate</span>
                            )}
                            {v.imei && (
                              <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                                IMEI: {v.imei}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            v.onlineStatus === "online"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {v.onlineStatus}
                        </span>
                      </div>

                      {/* Mid: SIM, Network, VTU Health */}
                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {v.network && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                              {v.network.name}
                            </span>
                          )}
                          <span className="font-mono font-semibold text-slate-800 truncate text-[11px]">
                            {v.normalizedPhone || v.rawSimNumber || "No SIM"}
                          </span>
                          {(v.normalizedPhone || v.rawSimNumber) && (
                            <button
                              type="button"
                              onClick={() => handleCopy(v.normalizedPhone || v.rawSimNumber)}
                              className="text-slate-400 hover:text-indigo-600 shrink-0"
                            >
                              {copiedText === (v.normalizedPhone || v.rawSimNumber) ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>

                        <div className="shrink-0">
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                              v.vtuHistory.statusBadge === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800"
                                : v.vtuHistory.statusBadge === "EXPIRED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {v.vtuHistory.statusBadge}
                          </span>
                        </div>
                      </div>

                      {/* Bottom: Action buttons */}
                      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                        <Button
                          type="button"
                          onClick={() =>
                            openSingleRechargeModal({
                              vehicleId: v.id,
                              vehicleName: v.name,
                              plateNumber: v.plateNumber,
                              phone: v.normalizedPhone || v.rawSimNumber,
                              network: v.network?.name || null,
                              imei: v.imei,
                            })
                          }
                          className="h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Zap className="w-2.5 h-2.5 text-amber-300" />
                          <span>Recharge</span>
                        </Button>

                        <button
                          type="button"
                          onClick={() =>
                            openSimHistoryModal({
                              name: v.name,
                              plate: v.plateNumber,
                              phone: v.normalizedPhone || v.rawSimNumber,
                            })
                          }
                          className="h-7 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-semibold"
                        >
                          History
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: SINGLE-VEHICLE RECHARGE (PER VEHICLE ONLY)            */}
      {/* ------------------------------------------------------------- */}
      {singleRechargeModalOpen && targetVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-3.5 sm:space-y-5 max-h-[92vh] overflow-y-auto animate-scaleUp">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-indigo-600 uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                  <span>Per-Vehicle Data Top-up</span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 mt-0.5 sm:mt-1">{targetVehicle.vehicleName}</h3>
                {targetVehicle.plateNumber && (
                  <span className="font-mono text-[10px] sm:text-xs font-bold text-slate-700 bg-slate-100 px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                    {targetVehicle.plateNumber}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSingleRechargeModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target SIM Card Info */}
            <div className="p-2.5 sm:p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-slate-500 shrink-0" />
                <div>
                  <div className="font-mono font-bold text-slate-800 text-xs sm:text-sm">{targetVehicle.phone}</div>
                  <div className="text-[10px] sm:text-[11px] text-slate-500">Tracker SIM Card</div>
                </div>
              </div>
              {targetVehicle.network && (
                <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px] sm:text-xs">
                  {targetVehicle.network}
                </span>
              )}
            </div>

            {/* Live Connection Status & Verification */}
            <div className="p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full ${
                    liveVerifiedStatus[targetVehicle.vehicleId]?.isOnline
                      ? "bg-emerald-500 animate-ping"
                      : "bg-rose-500 animate-pulse"
                  }`}
                />
                <div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Live Tracker Status</div>
                  <div className="font-bold text-slate-800 text-xs">
                    {liveVerifiedStatus[targetVehicle.vehicleId]?.isOnline
                      ? "🟢 ONLINE (Connected Just Now)"
                      : liveVerifiedStatus[targetVehicle.vehicleId]
                      ? "🔴 Confirmed Offline"
                      : "Offline (Cached Telemetry)"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCheckLiveStatus(targetVehicle.vehicleId, targetVehicle.vehicleName)}
                disabled={checkingDeviceId === targetVehicle.vehicleId}
                className="h-7 px-2.5 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[10px] sm:text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
              >
                {checkingDeviceId === targetVehicle.vehicleId ? (
                  <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                ) : (
                  <Radio className="w-3 h-3 text-indigo-600" />
                )}
                <span>{checkingDeviceId === targetVehicle.vehicleId ? "Pinging..." : "Verify Live"}</span>
              </button>
            </div>

            {liveVerifiedStatus[targetVehicle.vehicleId]?.isOnline && (
              <div className="p-2.5 sm:p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Notice: This vehicle is currently <strong>ONLINE</strong>! Recharging may not be required.</span>
              </div>
            )}

            {/* Telecom Server Route Selector */}
            <div className="space-y-1">
              <label className="text-[11px] sm:text-xs font-bold text-slate-700">Telecom Server Route</label>
              <select
                value={modalServerId}
                onChange={(e) => setModalServerId(e.target.value)}
                className="w-full h-9 sm:h-10 border border-slate-200 rounded-xl px-2.5 sm:px-3 text-[11px] sm:text-xs bg-white font-semibold text-slate-800"
              >
                {servers.map((s, idx) => (
                  <option key={s.id} value={s.id}>
                    Server {idx + 1} ({s.serverName}) {s.isDefault ? "— (Active Default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Plan Selector */}
            <div className="space-y-1">
              <label className="text-[11px] sm:text-xs font-bold text-slate-700">Select Data Bundle</label>
              <select
                value={modalPlanValue}
                onChange={(e) => setModalPlanValue(e.target.value)}
                className="w-full h-9 sm:h-10 border border-slate-200 rounded-xl px-2.5 sm:px-3 text-[11px] sm:text-xs bg-white font-semibold text-slate-800"
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
                    <option value="8::380::1.0GB SME (30 Days)::30 Days">1.0GB SME (30 Days) — ₦380 (Recommended)</option>
                    <option value="7::245::500MB SME (30 Days)::30 Days">500MB SME (30 Days) — ₦245</option>
                    <option value="9::660::2.0GB SME (30 Days)::30 Days">2.0GB SME (30 Days) — ₦660</option>
                  </>
                )}
              </select>
            </div>

            {/* Wallet & Cost Breakdown */}
            <div className="p-2.5 sm:p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 sm:space-y-1.5 text-[11px] sm:text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Wallet Balance:</span>
                <span className="font-mono font-bold text-slate-800">
                  ₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Plan Cost:</span>
                <span className="font-mono font-bold text-indigo-700">
                  {planPrice > 0 ? `₦${planPrice.toLocaleString()}` : "—"}
                </span>
              </div>
              {planPrice > 0 && (
                <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                  <span className="text-slate-800">Balance After Recharge:</span>
                  <span
                    className={`font-mono ${
                      walletBalance >= planPrice ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    ₦{(walletBalance - planPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* Feedback Message */}
            {rechargeFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                  rechargeFeedback.success
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {rechargeFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div>{rechargeFeedback.message || rechargeFeedback.error}</div>
                  {rechargeFeedback.reference && (
                    <div className="font-mono text-[11px] text-emerald-700 mt-1">
                      Ref: {rechargeFeedback.reference}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1 sm:pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSingleRechargeModalOpen(false)}
                className="h-9 sm:h-10 px-3.5 sm:px-4 text-[11px] sm:text-xs font-bold"
              >
                Close
              </Button>

              <Button
                type="button"
                disabled={isDispensing || !modalPlanValue || walletBalance < planPrice}
                onClick={handleExecuteSingleRecharge}
                className="h-9 sm:h-10 px-3.5 sm:px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] sm:text-xs rounded-xl shadow-xs"
              >
                {isDispensing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    <span>Dispensing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-1 text-amber-300" />
                    <span>Dispense ({planPrice > 0 ? `₦${planPrice.toLocaleString()}` : ""})</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: CARTRACKER LIVE BATCH SYNC PROGRESS MODAL             */}
      {/* ------------------------------------------------------------- */}
      {syncModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-3.5 sm:space-y-5 animate-scaleUp">
            <div className="flex items-center gap-2">
              <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0">
                <CloudDownload className="w-4 h-4 sm:w-5 sm:h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">Synchronizing CarTracker Fleet</h3>
                <p className="text-[10px] sm:text-xs text-slate-500">Safely caching offline devices into local PostgreSQL</p>
              </div>
            </div>

            {/* Progress indicators */}
            <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 sm:space-y-3">
              <div className="flex justify-between text-[11px] sm:text-xs">
                <span className="text-slate-600">Current Batch:</span>
                <span className="font-bold text-slate-900">Batch {syncProgress.page} (500 per batch)</span>
              </div>
              <div className="flex justify-between text-[11px] sm:text-xs">
                <span className="text-slate-600">Total Devices Scanned:</span>
                <span className="font-mono font-bold text-slate-900">{syncProgress.scanned.toLocaleString()} / ~15,200</span>
              </div>
              <div className="flex justify-between text-[11px] sm:text-xs">
                <span className="text-slate-600">Offline Vehicles Synced:</span>
                <span className="font-mono font-bold text-rose-600">{syncProgress.offlineSynced.toLocaleString()}</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round((syncProgress.scanned / 15200) * 100))}%`,
                  }}
                />
              </div>
              <div className="text-right text-[10px] font-mono font-bold text-indigo-600">
                {Math.min(100, Math.round((syncProgress.scanned / 15200) * 100))}% Completed
              </div>
            </div>

            {syncProgress.error && (
              <div className="p-2.5 sm:p-3 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] sm:text-xs rounded-xl">
                {syncProgress.error}
              </div>
            )}

            {syncProgress.isDone && !isSyncing && (
              <div className="p-2.5 sm:p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] sm:text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Synchronization completed successfully!</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1 sm:pt-2">
              {isSyncing ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleStopSync}
                  className="h-8 sm:h-9 px-3.5 sm:px-4 text-[11px] sm:text-xs font-bold text-rose-600 hover:text-rose-700"
                >
                  Stop Sync
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setSyncModalOpen(false)}
                  className="h-8 sm:h-9 px-4 sm:px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] sm:text-xs rounded-xl"
                >
                  Done
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: SIM DIAGNOSTIC HISTORY MODAL                          */}
      {/* ------------------------------------------------------------- */}
      {historyModalOpen && historyVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-100 space-y-3 sm:space-y-4 max-h-[92vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] sm:text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>SIM Transaction History</span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 mt-0.5 sm:mt-1">{historyVehicle.name}</h3>
                <div className="font-mono text-[11px] sm:text-xs text-slate-600">{historyVehicle.phone}</div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="py-12 text-center text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                <span className="text-xs font-semibold">Fetching SIM records from database...</span>
              </div>
            ) : !historyData ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-[11px] sm:text-xs text-slate-500">
                No past transactions recorded for this SIM on Golden VTU.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Last Data Card */}
                <div className="p-2.5 sm:p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                  <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">Most Recent Data Bundle</div>
                  {historyData.lastData ? (
                    <div>
                      <div className="font-bold text-slate-900 text-xs sm:text-sm">{historyData.lastData.plan}</div>
                      <div className="text-slate-600 flex justify-between mt-1 text-[11px] sm:text-xs">
                        <span>Dispensed: {historyData.lastData.formattedDate}</span>
                        <span className="font-mono font-bold text-indigo-600">₦{historyData.lastData.amount}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-slate-500 mt-1 border-t border-slate-200/80 pt-1">
                        <span>Expires: {historyData.lastData.expiryDate}</span>
                        <span
                          className={`font-bold ${
                            historyData.lastData.isExpired ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {historyData.lastData.isExpired ? "EXPIRED" : `${historyData.lastData.daysUntilExpiry} days left`}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-[11px]">No past data purchases on record.</div>
                  )}
                </div>

                {/* Recent Purchases List */}
                <div className="space-y-1.5">
                  <div className="text-[10px] sm:text-[11px] font-bold text-slate-700">Past SIM Transactions:</div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {historyData.recentTransactions && historyData.recentTransactions.length > 0 ? (
                      historyData.recentTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="p-2 sm:p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-800 text-[11px] sm:text-xs">{tx.description}</span>
                            <div className="text-[9px] sm:text-[10px] text-slate-400">{tx.date}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-slate-900 text-xs">₦{tx.amount}</div>
                            <span
                              className={`text-[9px] font-bold uppercase ${
                                tx.status === "SUCCESS" ? "text-emerald-600" : "text-amber-600"
                              }`}
                            >
                              {tx.status}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">No recent transactions found.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-1 sm:pt-2">
              <Button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="h-8 sm:h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] sm:text-xs rounded-xl"
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
