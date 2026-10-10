"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Wifi,
  Smartphone,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Loader2,
  History,
  ArrowRight,
  Zap,
  Info,
  Calendar,
  Copy,
  Check,
  PlusCircle,
  X,
  ExternalLink,
  Layers,
  RefreshCw,
  CheckCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { checkSimHistory, SimDiagnosticHistory } from "@/actions/sim-history.actions"
import { BulkPhoneInputWithHistory } from "@/components/vtu/BulkPhoneInputWithHistory"
import { format12HourDateTime } from "@/lib/phone-utils"

interface SimTroubleshootStationProps {
  walletBalance: number
  servers: any[]
  availablePlans: any[]
  recentSims: Array<{
    phone: string
    network: string
    lastDataDate?: string | null
    lastAirtimeDate?: string | null
  }>
}

interface TransactionReceipt {
  type: "DATA" | "AIRTIME"
  phone: string
  networkName: string
  networkId: string
  amount: number
  planName: string
  reference: string
  date: Date
  walletBalanceBefore: number
  walletBalanceAfter: number
}

const NETWORK_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  "01": { label: "MTN", bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300" },
  "02": { label: "GLO", bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  "03": { label: "9MOBILE", bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
  "04": { label: "AIRTEL", bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300" },
}

export function SimTroubleshootStation({
  walletBalance: initialWalletBalance,
  servers,
  availablePlans,
  recentSims,
}: SimTroubleshootStationProps) {
  // Navigation Mode: Single SIM vs Bulk Multi-SIM
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single")

  // Shared Wallet Balance
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)
  const [selectedServerId, setSelectedServerId] = useState(servers[0]?.id || "")

  // ==========================================
  // 1. SINGLE SIM STATE
  // ==========================================
  const [phone, setPhone] = useState("")
  const [historyData, setHistoryData] = useState<SimDiagnosticHistory | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedAction, setSelectedAction] = useState<"data" | "airtime">("data")
  const [selectedNetwork, setSelectedNetwork] = useState("01")
  const [selectedPlanValue, setSelectedPlanValue] = useState("")
  const [airtimeAmount, setAirtimeAmount] = useState("200")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null)
  const [copiedRef, setCopiedRef] = useState(false)
  const [copiedReport, setCopiedReport] = useState<string | null>(null)

  const copyReportText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedReport(text)
    setTimeout(() => setCopiedReport(null), 2500)
  }

  // ==========================================
  // 2. BULK MULTI-SIM STATE
  // ==========================================
  const [bulkServiceType, setBulkServiceType] = useState<"data" | "airtime">("data")
  const [bulkNetworkId, setBulkNetworkId] = useState("01")
  const [bulkRawPhones, setBulkRawPhones] = useState("")
  const [bulkSelectedPhones, setBulkSelectedPhones] = useState<string[]>([])
  const [bulkPlanValue, setBulkPlanValue] = useState("")
  const [bulkAirtimeAmount, setBulkAirtimeAmount] = useState("200")
  const [bulkIsSubmitting, setBulkIsSubmitting] = useState(false)
  const [bulkFeedback, setBulkFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [bulkBatchResults, setBulkBatchResults] = useState<{
    totalProcessed: number
    successCount: number
    failureCount: number
    results: Array<{ phone: string; success: boolean; error?: string; reference?: string }>
  } | null>(null)

  function copyReference(ref: string) {
    if (!navigator?.clipboard) return
    navigator.clipboard.writeText(ref)
    setCopiedRef(true)
    setTimeout(() => setCopiedRef(false), 2000)
  }

  // Clear all single fields to prepare for next tracker SIM
  function handleResetForNextSim() {
    setReceipt(null)
    setPhone("")
    setHistoryData(null)
    setSelectedPlanValue("")
    setAirtimeAmount("200")
    setFeedback(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Inspect updated telemetry for single SIM
  function handleInspectUpdatedSim() {
    if (!receipt) return
    const reloadedPhone = receipt.phone
    setReceipt(null)
    handlePhoneLookup(reloadedPhone)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Quick lookup handler for single SIM
  async function handlePhoneLookup(numberToLookup: string) {
    const clean = numberToLookup.replace(/[^0-9]/g, "")
    setPhone(clean)
    setFeedback(null)

    if (clean.length < 10) {
      setHistoryData(null)
      return
    }

    setIsSearching(true)
    try {
      const res = await checkSimHistory(clean)
      setHistoryData(res)
      if (res?.network?.id) {
        setSelectedNetwork(res.network.id)
      }
    } catch (err: any) {
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }

  // Single Airtime Purchase
  async function handleBuyAirtime() {
    if (!phone || phone.length < 10) {
      setFeedback({ type: "error", message: "Please enter an 11-digit phone number." })
      return
    }
    const amt = parseFloat(airtimeAmount)
    if (!amt || amt < 50) {
      setFeedback({ type: "error", message: "Minimum airtime amount is ₦50." })
      return
    }
    if (walletBalance < amt) {
      setFeedback({
        type: "error",
        message: `Insufficient wallet balance. Total cost is ₦${amt.toLocaleString()} but your balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`,
      })
      return
    }

    setIsSubmitting(true)
    setFeedback(null)
    try {
      const res = await fetch("/api/vtu/bulk-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "airtime",
          networkId: selectedNetwork,
          amount: amt,
          phones: [phone],
          serverId: selectedServerId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Airtime purchase failed")
      }

      const resultItem = data.results?.[0]
      if (resultItem && !resultItem.success) {
        throw new Error(resultItem.error || "Airtime top-up was rejected by the carrier network")
      }

      const newBal = Math.max(0, walletBalance - amt)
      setWalletBalance(newBal)

      const ref = resultItem?.reference || data.reference || `AIR-${Date.now()}`
      setReceipt({
        type: "AIRTIME",
        phone: phone,
        networkName: NETWORK_META[selectedNetwork]?.label || "Network",
        networkId: selectedNetwork,
        amount: amt,
        planName: `₦${amt.toLocaleString()} Airtime Top-up`,
        reference: ref,
        date: new Date(),
        walletBalanceBefore: walletBalance,
        walletBalanceAfter: newBal,
      })
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to load airtime." })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Single Data Purchase
  async function handleBuyData() {
    if (!phone || phone.length < 10) {
      setFeedback({ type: "error", message: "Please enter an 11-digit phone number." })
      return
    }
    if (!selectedPlanValue) {
      setFeedback({ type: "error", message: "Please select a data bundle plan." })
      return
    }

    const [planId, priceStr, planName] = selectedPlanValue.split("::")
    const amt = parseFloat(priceStr)
    if (walletBalance < amt) {
      setFeedback({
        type: "error",
        message: `Insufficient wallet balance. Plan cost is ₦${amt.toLocaleString()} but your balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`,
      })
      return
    }

    setIsSubmitting(true)
    setFeedback(null)
    try {
      const res = await fetch("/api/vtu/bulk-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "data",
          networkId: selectedNetwork,
          planId: planId,
          amount: amt,
          phones: [phone],
          serverId: selectedServerId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Data purchase failed")
      }

      const resultItem = data.results?.[0]
      if (resultItem && !resultItem.success) {
        throw new Error(resultItem.error || "Data activation was rejected by the carrier network")
      }

      const newBal = Math.max(0, walletBalance - amt)
      setWalletBalance(newBal)

      const ref = resultItem?.reference || data.reference || `DATA-${Date.now()}`
      setReceipt({
        type: "DATA",
        phone: phone,
        networkName: NETWORK_META[selectedNetwork]?.label || "Network",
        networkId: selectedNetwork,
        amount: amt,
        planName: planName,
        reference: ref,
        date: new Date(),
        walletBalanceBefore: walletBalance,
        walletBalanceAfter: newBal,
      })

      setSelectedPlanValue("")
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "Failed to purchase data." })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ==========================================
  // BULK RECHARGE ACTIONS
  // ==========================================
  const bulkNetworkPlans = availablePlans.filter((p) => p.network === bulkNetworkId)

  // Calculate unit and total costs for bulk
  const bulkUnitCost =
    bulkServiceType === "data"
      ? bulkPlanValue
        ? parseFloat(bulkPlanValue.split("::")[1]) || 0
        : 0
      : parseFloat(bulkAirtimeAmount) || 0

  const bulkTotalCost = bulkUnitCost * bulkSelectedPhones.length
  const bulkHasInsufficientBalance = walletBalance < bulkTotalCost

  async function handleBulkSubmit() {
    if (bulkSelectedPhones.length === 0) {
      setBulkFeedback({
        type: "error",
        message: "Please enter or select at least one tracker SIM phone number.",
      })
      return
    }

    let unitCost = 0
    let planId: string | undefined = undefined

    if (bulkServiceType === "data") {
      if (!bulkPlanValue) {
        setBulkFeedback({ type: "error", message: "Please select a data bundle plan." })
        return
      }
      const [pId, priceStr] = bulkPlanValue.split("::")
      unitCost = parseFloat(priceStr)
      planId = pId
    } else {
      unitCost = parseFloat(bulkAirtimeAmount)
      if (!unitCost || unitCost < 50) {
        setBulkFeedback({ type: "error", message: "Minimum airtime is ₦50 per number." })
        return
      }
    }

    const totalCost = unitCost * bulkSelectedPhones.length
    if (walletBalance < totalCost) {
      setBulkFeedback({
        type: "error",
        message: `Insufficient wallet balance. Total cost is ₦${totalCost.toLocaleString()} for ${bulkSelectedPhones.length} numbers, but your balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`,
      })
      return
    }

    setBulkIsSubmitting(true)
    setBulkFeedback(null)

    try {
      const res = await fetch("/api/vtu/bulk-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: bulkServiceType,
          networkId: bulkNetworkId,
          planId: planId,
          amount: unitCost,
          phones: bulkSelectedPhones,
          serverId: selectedServerId || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Bulk recharge operation failed")
      }

      setBulkBatchResults(data)
      setWalletBalance((prev) => Math.max(0, prev - unitCost * (data.successCount || 0)))
    } catch (err: any) {
      setBulkFeedback({ type: "error", message: err.message || "Failed to process bulk recharge." })
    } finally {
      setBulkIsSubmitting(false)
    }
  }

  function handleResetBulkForm() {
    setBulkBatchResults(null)
    setBulkRawPhones("")
    setBulkSelectedPhones([])
    setBulkPlanValue("")
    setBulkAirtimeAmount("200")
    setBulkFeedback(null)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const networkPlans = availablePlans.filter((p) => p.network === selectedNetwork)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Zap className="w-6 h-6 text-blue-600" />
          Tracker SIM Station & Fast Top-up
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Troubleshoot single tracker SIMs with live telemetry history, or recharge multiple vehicle trackers in one bulk batch.
        </p>
      </div>

      {/* Wallet Balance Pill */}
      <div className="flex items-center justify-between p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-blue-900">
          <span className="font-semibold">Wallet Balance:</span>
          <span className="font-bold text-base text-blue-700">
            ₦{walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
        <Link
          href="/wallet/fund"
          className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
        >
          Fund Wallet
        </Link>
      </div>

      {/* TOP TABS: Single SIM vs Bulk Multi-SIM */}
      <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200 gap-1.5 shadow-xs">
        <button
          type="button"
          onClick={() => {
            setActiveTab("single")
            setFeedback(null)
          }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "single"
              ? "bg-white text-blue-700 shadow-sm border border-slate-200/80"
              : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
          }`}
        >
          <Search className="w-4 h-4 text-blue-600" />
          <span>Single SIM Troubleshooter</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("bulk")
            setBulkFeedback(null)
          }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === "bulk"
              ? "bg-white text-blue-700 shadow-sm border border-slate-200/80"
              : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
          }`}
        >
          <Layers className="w-4 h-4 text-blue-600" />
          <span>Bulk Multi-SIM Recharge</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 hidden sm:inline-block">
            Batch
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: SINGLE SIM TROUBLESHOOTER & TOP-UP */}
      {/* ========================================================= */}
      {activeTab === "single" && (
        <div className="space-y-6">
          {/* Top Feedback Banner */}
          {feedback && !receipt && (
            <div
              className={`p-4 rounded-xl flex items-center justify-between text-xs font-medium ${
                feedback.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button onClick={() => setFeedback(null)} className="underline ml-4 hover:opacity-75">
                Dismiss
              </button>
            </div>
          )}

          {/* SINGLE TRANSACTION RECEIPT CARD */}
          {receipt ? (
            <Card className="border-2 border-emerald-500/30 bg-white shadow-xl overflow-hidden rounded-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-gradient-to-b from-emerald-500/10 to-transparent p-6 sm:p-8 text-center space-y-3 border-b border-emerald-100">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50 mb-1">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold uppercase tracking-wider">
                    Transaction Successful
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  Recharge Complete!
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                  {receipt.type === "DATA"
                    ? `Data bundle has been successfully dispensed to tracker device.`
                    : `Airtime top-up has been credited to tracker device.`}
                </p>
              </div>

              <CardContent className="p-5 sm:p-8 space-y-6">
                {/* Receipt Breakdown Table */}
                <div className="bg-slate-50 border rounded-xl p-4 sm:p-5 space-y-3 text-xs sm:text-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <span className="text-gray-500 font-medium">Recipient Tracker SIM</span>
                    <div className="flex items-center gap-2">
                      {NETWORK_META[receipt.networkId] && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${NETWORK_META[receipt.networkId].bg} ${NETWORK_META[receipt.networkId].text} ${NETWORK_META[receipt.networkId].border}`}
                        >
                          {NETWORK_META[receipt.networkId].label}
                        </span>
                      )}
                      <span className="font-mono font-bold text-gray-900 text-sm sm:text-base">
                        {receipt.phone}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <span className="text-gray-500 font-medium">Service Purchased</span>
                    <span className="font-bold text-gray-900 text-right">
                      {receipt.planName}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <span className="text-gray-500 font-medium">Amount Debited</span>
                    <span className="font-extrabold text-emerald-700 text-base sm:text-lg">
                      ₦{receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <span className="text-gray-500 font-medium">Remaining Wallet Balance</span>
                    <span className="font-bold text-blue-700">
                      ₦{receipt.walletBalanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <span className="text-gray-500 font-medium">Reference Code</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-700 text-xs font-semibold select-all">
                        {receipt.reference}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyReference(receipt.reference)}
                        className="p-1.5 rounded-md hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1 text-[11px]"
                        title="Copy Reference"
                      >
                        {copiedRef ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Copied
                          </span>
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-gray-500 font-medium">Date & Time (12h)</span>
                    <span className="text-gray-900 text-xs font-semibold">
                      {format12HourDateTime(receipt.date).full}
                    </span>
                  </div>
                </div>

                {/* Primary & Secondary Action Buttons */}
                <div className="space-y-3 pt-1">
                  <Button
                    type="button"
                    onClick={handleResetForNextSim}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-6 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="w-5 h-5" />
                    Recharge Another Tracker SIM
                  </Button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleInspectUpdatedSim}
                      className="w-full text-xs font-semibold py-5 border-gray-300 hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                      <History className="w-4 h-4 text-gray-600" />
                      Inspect Updated SIM Telemetry
                    </Button>

                    <Link
                      href="/transactions"
                      className="w-full text-xs font-semibold py-3 px-4 border border-gray-300 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2 text-gray-700 transition-colors"
                    >
                      <span>View All Transactions</span>
                      <ArrowRight className="w-4 h-4 text-gray-500" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* MAIN SINGLE SIM SEARCH & INPUT CARD */
            <Card className="border-2 border-blue-200 shadow-sm overflow-hidden">
              <div className="p-5 md:p-6 space-y-4">
                <label className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-blue-600" />
                  Paste Tracker SIM Phone Number
                </label>

                <div className="relative">
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => handlePhoneLookup(e.target.value)}
                    placeholder="e.g. 08031234567 or 070..."
                    className="text-lg font-mono font-bold tracking-wider py-6 px-4 pr-16 bg-gray-50/50 focus:bg-white border-gray-300"
                    autoFocus
                  />
                  {phone && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhone("")
                        setHistoryData(null)
                        setFeedback(null)
                      }}
                      className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Clear phone number"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {isSearching && (
                    <div className="absolute right-3.5 top-3.5 flex items-center gap-1.5 text-xs text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-400">
                  Paste or type any 11-digit SIM number. The system automatically inspects both data and airtime records.
                </p>
              </div>

              {/* Live Diagnostics Card: Shows IMMEDIATELY when SIM is entered */}
              {historyData && (
                <div className="border-t bg-slate-50/70 p-5 space-y-4">
                  {/* Verdict Header */}
                  <div
                    className={`p-4 rounded-xl flex items-start gap-3 border ${
                      historyData.summary.verdictType === "CRITICAL_EXPIRED"
                        ? "bg-rose-50 border-rose-300 text-rose-900"
                        : historyData.summary.verdictType === "WARNING_EXPIRING"
                        ? "bg-amber-50 border-amber-300 text-amber-900"
                        : historyData.summary.verdictType === "HEALTHY_ACTIVE"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-white border-gray-200 text-gray-900"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {historyData.summary.verdictType === "CRITICAL_EXPIRED" ? (
                        <ShieldAlert className="w-6 h-6 text-rose-600" />
                      ) : historyData.summary.verdictType === "WARNING_EXPIRING" ? (
                        <Clock className="w-6 h-6 text-amber-600" />
                      ) : historyData.summary.verdictType === "HEALTHY_ACTIVE" ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <Info className="w-6 h-6 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold">{historyData.summary.verdictTitle}</h3>
                        {historyData.network?.id && NETWORK_META[historyData.network.id] && (
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-sm border ${
                              NETWORK_META[historyData.network.id].bg
                            } ${NETWORK_META[historyData.network.id].text} ${
                              NETWORK_META[historyData.network.id].border
                            }`}
                          >
                            {NETWORK_META[historyData.network.id].label}
                          </span>
                        )}
                        <span className="font-mono text-xs font-semibold text-gray-600">
                          SIM: {historyData.phone}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const dataDesc = historyData.lastData
                              ? `Data: Last loaded ${historyData.lastData.daysAgo === 0 ? "today" : `${historyData.lastData.daysAgo} days ago`} (${historyData.lastData.plan})`
                              : "Data: Never loaded"
                            const airtimeDesc = historyData.lastAirtime
                              ? `Airtime: Last loaded ${historyData.lastAirtime.daysAgo === 0 ? "today" : `${historyData.lastAirtime.daysAgo} days ago`} (₦${historyData.lastAirtime.amount})`
                              : "Airtime: Never loaded"
                            const fullReport = `${historyData.phone} (${historyData.network?.id && NETWORK_META[historyData.network.id] ? NETWORK_META[historyData.network.id].label : "SIM"})\n• ${dataDesc}\n• ${airtimeDesc}`
                            copyReportText(fullReport)
                          }}
                          className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-md bg-white border shadow-2xs hover:bg-slate-50 transition-colors text-slate-700"
                        >
                          {copiedReport && copiedReport.includes(historyData.phone) && copiedReport.includes("•") ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-500" />
                              <span>Copy Report Summary</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs mt-1 opacity-90 leading-relaxed">
                        {historyData.summary.verdictMessage}
                      </p>
                    </div>
                  </div>

                  {/* Side-by-Side: Last Data vs Last Airtime */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Box 1: GPRS Data Telemetry History */}
                    <div className="p-4 bg-white rounded-xl border space-y-2 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                          <Wifi className="w-4 h-4 text-blue-600" />
                          Last Data Bundle
                        </span>
                        {historyData.lastData ? (
                          historyData.lastData.isExpired ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                              EXPIRED
                            </span>
                          ) : historyData.lastData.isExpiringSoon ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              {historyData.lastData.daysUntilExpiry}d left
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Active ({historyData.lastData.daysUntilExpiry}d left)
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                            Never Bought
                          </span>
                        )}
                      </div>

                      {historyData.lastData ? (
                        <div className="space-y-1.5 text-xs text-gray-600 pt-1">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Plan:</span>
                            <span className="font-bold text-gray-900">{historyData.lastData.plan}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Date Bought:</span>
                            <span className="font-medium text-gray-800">
                              {historyData.lastData.formattedDate} ({historyData.lastData.daysAgo === 0 ? "today" : `${historyData.lastData.daysAgo} days ago`})
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Amount:</span>
                            <span className="font-medium text-gray-800">
                              ₦{historyData.lastData.amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-400 pt-1 border-t">
                            <span>Ref:</span>
                            <span className="font-mono">{historyData.lastData.reference}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 py-3 italic">
                          No data bundle has ever been bought for this SIM.
                        </p>
                      )}

                      <div className="pt-2 border-t">
                        <button
                          type="button"
                          onClick={() => {
                            const line = historyData.lastData
                              ? `${historyData.phone} - Data: Last loaded ${historyData.lastData.daysAgo === 0 ? "today" : `${historyData.lastData.daysAgo} days ago`} (${historyData.lastData.plan})`
                              : `${historyData.phone} - Data: Never loaded`
                            copyReportText(line)
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all bg-blue-50/70 hover:bg-blue-100 text-blue-700 border-blue-200"
                        >
                          {copiedReport && copiedReport.startsWith(historyData.phone) && copiedReport.includes("Data:") ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Copied Data Report!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-blue-600" />
                              <span>Copy Data Status for Report</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Box 2: SMS Airtime History */}
                    <div className="p-4 bg-white rounded-xl border space-y-2 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-indigo-600" />
                          Last Airtime Top-up
                        </span>
                        {historyData.lastAirtime ? (
                          historyData.lastAirtime.needsAirtime ? (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              Loaded {historyData.lastAirtime.daysAgo === 0 ? "today" : `${historyData.lastAirtime.daysAgo}d ago`}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Recent ({historyData.lastAirtime.daysAgo === 0 ? "today" : `${historyData.lastAirtime.daysAgo}d ago`})
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                            Never Bought
                          </span>
                        )}
                      </div>

                      {historyData.lastAirtime ? (
                        <div className="space-y-1.5 text-xs text-gray-600 pt-1">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Amount:</span>
                            <span className="font-bold text-gray-900">
                              ₦{historyData.lastAirtime.amount.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Date Bought:</span>
                            <span className="font-medium text-gray-800">
                              {historyData.lastAirtime.formattedDate} ({historyData.lastAirtime.daysAgo === 0 ? "today" : `${historyData.lastAirtime.daysAgo} days ago`})
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Status:</span>
                            <span className="font-semibold text-emerald-600">
                              {historyData.lastAirtime.status}
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-gray-400 pt-1 border-t">
                            <span>Ref:</span>
                            <span className="font-mono">{historyData.lastAirtime.reference}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 py-3 italic">
                          No airtime purchase on file for this SIM.
                        </p>
                      )}

                      <div className="pt-2 border-t">
                        <button
                          type="button"
                          onClick={() => {
                            const line = historyData.lastAirtime
                              ? `${historyData.phone} - Airtime: Last loaded ${historyData.lastAirtime.daysAgo === 0 ? "today" : `${historyData.lastAirtime.daysAgo} days ago`} (₦${historyData.lastAirtime.amount})`
                              : `${historyData.phone} - Airtime: Never loaded`
                            copyReportText(line)
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                        >
                          {copiedReport && copiedReport.startsWith(historyData.phone) && copiedReport.includes("Airtime:") ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Copied Airtime Report!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Copy Airtime Status for Report</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ACTION SELECTOR: Proceed with Data or Airtime */}
                  <div className="bg-white rounded-xl border p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                      <h4 className="text-sm font-bold text-gray-900">
                        Ready to recharge <span className="font-mono text-blue-700">{phone}</span>?
                      </h4>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setSelectedAction("data")}
                          className={`flex-1 sm:flex-none px-4 py-2 min-h-[42px] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            selectedAction === "data"
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          <Wifi className="w-3.5 h-3.5" />
                          Buy Data
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedAction("airtime")}
                          className={`flex-1 sm:flex-none px-4 py-2 min-h-[42px] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            selectedAction === "airtime"
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          Buy Airtime
                        </button>
                      </div>
                    </div>

                    {/* ACTION A: BUY DATA FORM */}
                    {selectedAction === "data" && (
                      <div className="space-y-4 pt-1">
                        {!historyData?.network && (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              <strong>Network not detected:</strong> Please select the correct mobile network below for <span className="font-mono font-bold">{phone}</span> to avoid cross-carrier delivery failure.
                            </span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-gray-700">Mobile Network</label>
                            <select
                              value={selectedNetwork}
                              onChange={(e) => {
                                setSelectedNetwork(e.target.value)
                                setSelectedPlanValue("")
                              }}
                              className="w-full border rounded-lg px-3 py-2.5 text-base sm:text-sm mt-1 bg-white font-medium min-h-[44px]"
                            >
                              <option value="01">MTN Nigeria</option>
                              <option value="04">Airtel Nigeria</option>
                              <option value="02">Glo Mobile</option>
                              <option value="03">9mobile</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-700">Select Data Plan</label>
                            <select
                              value={selectedPlanValue}
                              onChange={(e) => setSelectedPlanValue(e.target.value)}
                              className="w-full border rounded-lg px-3 py-2.5 text-base sm:text-sm mt-1 bg-white font-medium min-h-[44px]"
                            >
                              <option value="">-- Choose Data Bundle --</option>
                              {networkPlans.map((p) => {
                                const hasDuration = /day|month|week|daily|weekly|monthly|\(\d+/i.test(p.name)
                                const validityLabel = !hasDuration && p.validity ? ` (${p.validity})` : ""
                                return (
                                  <option key={p.id} value={`${p.id}::${p.price}::${p.name}`}>
                                    {p.name} — ₦{p.price.toLocaleString()}{validityLabel}
                                  </option>
                                )
                              })}
                              {networkPlans.length === 0 && (
                                <>
                                  <option value="8::380::1.0GB SME (30 Days)">1.0GB — ₦380 (Recommended for Trackers, 30 Days)</option>
                                  <option value="7::245::500MB SME (30 Days)">500MB — ₦245 (Budget Plan, 30 Days)</option>
                                  <option value="9::660::2.0GB SME (30 Days)">2.0GB — ₦660 (30 Days)</option>
                                </>
                              )}
                            </select>
                          </div>
                        </div>

                        {/* Inline Error Banner for Data */}
                        {feedback?.type === "error" && (
                          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                              <span>{feedback.message}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFeedback(null)}
                              className="text-red-700 underline text-[11px] ml-2 shrink-0 hover:text-red-900"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                          <span className="text-xs text-gray-500">
                            Destination: <span className="font-mono font-bold text-gray-800">{phone}</span>
                          </span>
                          <Button
                            onClick={handleBuyData}
                            disabled={isSubmitting || !selectedPlanValue}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-6 py-3 min-h-[44px]"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                Dispensing Data...
                              </>
                            ) : (
                              <>
                                <Wifi className="w-4 h-4 mr-1.5" />
                                Recharge Data Now
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* ACTION B: BUY AIRTIME FORM */}
                    {selectedAction === "airtime" && (
                      <div className="space-y-4 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-gray-700">Mobile Network</label>
                            <select
                              value={selectedNetwork}
                              onChange={(e) => setSelectedNetwork(e.target.value)}
                              className="w-full border rounded-lg px-3 py-2.5 text-base sm:text-sm mt-1 bg-white font-medium min-h-[44px]"
                            >
                              <option value="01">MTN Nigeria</option>
                              <option value="04">Airtel Nigeria</option>
                              <option value="02">Glo Mobile</option>
                              <option value="03">9mobile</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-700">Airtime Amount (₦)</label>
                            <Input
                              type="number"
                              min="50"
                              step="50"
                              value={airtimeAmount}
                              onChange={(e) => setAirtimeAmount(e.target.value)}
                              className="mt-1 font-mono font-semibold text-base sm:text-sm min-h-[44px]"
                            />
                            <div className="flex flex-wrap gap-2 mt-2">
                              {[50, 100, 200, 500, 1000].map((quickAmt) => (
                                <button
                                  key={quickAmt}
                                  type="button"
                                  onClick={() => setAirtimeAmount(quickAmt.toString())}
                                  className={`px-3 py-1.5 min-h-[36px] text-xs font-semibold rounded-lg border transition-colors ${
                                    airtimeAmount === quickAmt.toString()
                                      ? "bg-indigo-600 text-white border-indigo-600"
                                      : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                                  }`}
                                >
                                  ₦{quickAmt}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Inline Error Banner for Airtime */}
                        {feedback?.type === "error" && (
                          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                              <span>{feedback.message}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFeedback(null)}
                              className="text-red-700 underline text-[11px] ml-2 shrink-0 hover:text-red-900"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                          <span className="text-xs text-gray-500">
                            Destination: <span className="font-mono font-bold text-gray-800">{phone}</span>
                          </span>
                          <Button
                            onClick={handleBuyAirtime}
                            disabled={isSubmitting || !airtimeAmount}
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-6 py-3 min-h-[44px]"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                Dispensing Airtime...
                              </>
                            ) : (
                              <>
                                <Smartphone className="w-4 h-4 mr-1.5" />
                                Recharge Airtime Now
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Previous Transaction Timeline for This SIM */}
                  {historyData.recentTransactions.length > 0 && (
                    <div className="bg-white rounded-xl border p-4 space-y-2.5">
                      <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-gray-500" />
                        Previous Recharges for {phone} ({historyData.recentTransactions.length})
                      </h4>
                      <div className="divide-y text-xs">
                        {historyData.recentTransactions.map((tx) => (
                          <div key={tx.id} className="py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  tx.type === "DATA"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-indigo-100 text-indigo-800"
                                }`}
                              >
                                {tx.type}
                              </span>
                              <span className="font-medium text-gray-900">{tx.description}</span>
                              <span
                                className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                  tx.status === "SUCCESS"
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : tx.status === "PENDING"
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-rose-100 text-rose-800 border border-rose-200"
                                }`}
                              >
                                {tx.status === "SUCCESS"
                                  ? "✓ Success"
                                  : tx.status === "PENDING"
                                  ? "⏳ Processing"
                                  : "↩ Refunded"}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className={`font-bold mr-2 ${tx.status === "FAILED" ? "line-through text-gray-400" : "text-gray-900"}`}>
                                ₦{tx.amount.toLocaleString()}
                              </span>
                              <span className="text-gray-500 text-[11px] font-medium">{format12HourDateTime(tx.date).full}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Quick Access to Recently Recharged SIMs */}
          {recentSims && recentSims.length > 0 && (
            <Card className="border shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-gray-500" />
                  Recently Recharged SIM Numbers
                </CardTitle>
                <CardDescription className="text-xs">
                  Click any previously recharged SIM to pull up its live history and recharge it instantly:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {recentSims.map((sim) => {
                    const net = NETWORK_META[sim.network] || {
                      label: "NET",
                      bg: "bg-gray-100",
                      text: "text-gray-800",
                      border: "border-gray-200",
                    }
                    return (
                      <button
                        key={sim.phone}
                        type="button"
                        onClick={() => {
                          if (receipt) setReceipt(null)
                          handlePhoneLookup(sim.phone)
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors text-xs"
                      >
                        <span className={`px-1.5 py-0.2 rounded-sm text-[10px] font-bold border ${net.bg} ${net.text} ${net.border}`}>
                          {net.label}
                        </span>
                        <span className="font-mono font-bold text-gray-800">{sim.phone}</span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: BULK MULTI-SIM RECHARGE */}
      {/* ========================================================= */}
      {activeTab === "bulk" && (
        <div className="space-y-6">
          {/* BULK BATCH RESULTS RECEIPT */}
          {bulkBatchResults ? (
            <Card className="border-2 border-emerald-500/30 bg-white shadow-xl overflow-hidden rounded-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-gradient-to-b from-emerald-500/10 to-transparent p-6 sm:p-8 text-center space-y-3 border-b border-emerald-100">
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-1 ${
                    bulkBatchResults.successCount > 0
                      ? "bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50"
                      : "bg-rose-100 text-rose-600 ring-8 ring-rose-50"
                  }`}
                >
                  {bulkBatchResults.successCount > 0 ? (
                    <CheckCircle2 className="w-9 h-9" />
                  ) : (
                    <XCircle className="w-9 h-9" />
                  )}
                </div>
                <div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                      bulkBatchResults.successCount > 0
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {bulkBatchResults.successCount > 0 ? "Batch Order Completed" : "Batch Order Failed"}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  {bulkBatchResults.successCount} of {bulkBatchResults.totalProcessed} SIMs Recharged!
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                  {bulkBatchResults.successCount > 0
                    ? `Recharge successfully dispatched to ${bulkBatchResults.successCount} tracker SIMs.`
                    : `Could not dispatch bulk recharge. Please review errors below.`}
                </p>
              </div>

              <CardContent className="p-5 sm:p-8 space-y-5">
                {/* Metrics Breakdown */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-50 border rounded-xl">
                    <span className="text-[11px] text-gray-500 block">Total Processed</span>
                    <span className="text-lg font-bold text-gray-900">{bulkBatchResults.totalProcessed}</span>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-[11px] text-emerald-700 block">Delivered</span>
                    <span className="text-lg font-bold text-emerald-700">{bulkBatchResults.successCount}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border rounded-xl">
                    <span className="text-[11px] text-gray-500 block">Failed</span>
                    <span className={`text-lg font-bold ${bulkBatchResults.failureCount > 0 ? "text-rose-600" : "text-gray-400"}`}>
                      {bulkBatchResults.failureCount}
                    </span>
                  </div>
                </div>

                {/* Per-SIM Results List */}
                <div className="border rounded-xl p-3 max-h-72 overflow-y-auto space-y-2 bg-slate-50/50">
                  {bulkBatchResults.results.map((res, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2.5 bg-white rounded-lg border">
                      <div className="flex items-center gap-2">
                        {res.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        )}
                        <span className="font-mono font-bold text-gray-900">{res.phone}</span>
                      </div>
                      {res.success ? (
                        <span className="text-emerald-700 font-medium text-[11px] flex items-center gap-1">
                          <span>Delivered</span>
                          {res.reference && (
                            <span className="font-mono opacity-75 select-all">({res.reference})</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-rose-600 text-[11px] font-medium truncate max-w-[200px]">
                          {res.error || "Failed"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bulk Actions */}
                <div className="space-y-3 pt-2">
                  <Button
                    type="button"
                    onClick={handleResetBulkForm}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-6 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="w-5 h-5" />
                    Recharge Another Batch of SIMs
                  </Button>

                  <Link
                    href="/transactions"
                    className="w-full text-xs font-semibold py-3 px-4 border border-gray-300 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2 text-gray-700 transition-colors"
                  >
                    <span>View All Transactions</span>
                    <ArrowRight className="w-4 h-4 text-gray-500" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* BULK RECHARGE FORM CARD */
            <Card className="border-2 border-blue-200 shadow-sm overflow-hidden">
              <CardHeader className="pb-4 border-b bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                      <Layers className="w-5 h-5 text-blue-600" />
                      Bulk Tracker SIM Recharge
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Paste a list of tracker SIMs to check live expiry dates and dispense data or airtime simultaneously.
                    </CardDescription>
                  </div>

                  {/* Bulk Service Toggle: Data vs Airtime */}
                  <div className="flex p-1 bg-white border rounded-xl gap-1 w-fit shadow-xs">
                    <button
                      type="button"
                      onClick={() => setBulkServiceType("data")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        bulkServiceType === "data"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <Wifi className="w-3.5 h-3.5" />
                      Bulk Data
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkServiceType("airtime")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        bulkServiceType === "airtime"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      Bulk Airtime
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5 md:p-6 space-y-6">
                {/* 1. Network & Plan / Amount Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">1. Mobile Network</label>
                    <select
                      value={bulkNetworkId}
                      onChange={(e) => {
                        setBulkNetworkId(e.target.value)
                        setBulkPlanValue("")
                      }}
                      className="w-full border rounded-lg px-3 py-2.5 text-base sm:text-sm mt-1 bg-white font-medium min-h-[44px]"
                    >
                      <option value="01">MTN Nigeria</option>
                      <option value="04">Airtel Nigeria</option>
                      <option value="02">Glo Mobile</option>
                      <option value="03">9mobile</option>
                    </select>
                  </div>

                  {bulkServiceType === "data" ? (
                    <div>
                      <label className="text-xs font-semibold text-gray-700">2. Select Data Bundle Plan</label>
                      <select
                        value={bulkPlanValue}
                        onChange={(e) => setBulkPlanValue(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2.5 text-base sm:text-sm mt-1 bg-white font-medium min-h-[44px]"
                      >
                        <option value="">-- Choose Data Bundle --</option>
                        {bulkNetworkPlans.map((p) => {
                          const hasDuration = /day|month|week|daily|weekly|monthly|\(\d+/i.test(p.name)
                          const validityLabel = !hasDuration && p.validity ? ` (${p.validity})` : ""
                          return (
                            <option key={p.id} value={`${p.id}::${p.price}::${p.name}`}>
                              {p.name} — ₦{p.price.toLocaleString()}{validityLabel}
                            </option>
                          )
                        })}
                        {bulkNetworkPlans.length === 0 && (
                          <>
                            <option value="8::380::1.0GB SME (30 Days)">1.0GB — ₦380 (Recommended for Trackers, 30 Days)</option>
                            <option value="7::245::500MB SME (30 Days)">500MB — ₦245 (Budget Plan, 30 Days)</option>
                            <option value="9::660::2.0GB SME (30 Days)">2.0GB — ₦660 (30 Days)</option>
                          </>
                        )}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-semibold text-gray-700">2. Airtime Amount per SIM (₦)</label>
                      <Input
                        type="number"
                        min="50"
                        step="50"
                        value={bulkAirtimeAmount}
                        onChange={(e) => setBulkAirtimeAmount(e.target.value)}
                        className="mt-1 font-mono font-semibold text-base sm:text-sm min-h-[44px]"
                      />
                      <div className="flex flex-wrap gap-2 mt-2">
                        {[50, 100, 200, 500, 1000].map((quickAmt) => (
                          <button
                            key={quickAmt}
                            type="button"
                            onClick={() => setBulkAirtimeAmount(quickAmt.toString())}
                            className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                              bulkAirtimeAmount === quickAmt.toString()
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                            }`}
                          >
                            ₦{quickAmt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Bulk SIM Input with History Diagnostics Component */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700">
                    3. Recipient SIM Numbers (Paste Comma, Newline, or Space Separated)
                  </label>
                  <BulkPhoneInputWithHistory
                    type={bulkServiceType}
                    rawInput={bulkRawPhones}
                    onRawInputChange={setBulkRawPhones}
                    selectedPhones={bulkSelectedPhones}
                    onSelectedPhonesChange={setBulkSelectedPhones}
                    targetNetworkId={bulkNetworkId}
                    onNetworkChange={(netId) => setBulkNetworkId(netId)}
                  />
                </div>

                {/* Inline Error Banner */}
                {bulkFeedback?.type === "error" && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{bulkFeedback.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBulkFeedback(null)}
                      className="text-red-700 underline text-[11px] ml-2 shrink-0 hover:text-red-900"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* 3. Cost Breakdown Box */}
                {bulkSelectedPhones.length > 0 && bulkUnitCost > 0 && (
                  <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Rate per SIM:</span>
                      <span className="font-semibold text-gray-900">₦{bulkUnitCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Selected Recipients:</span>
                      <span className="font-semibold text-gray-900">{bulkSelectedPhones.length} tracker SIMs</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Wallet Balance:</span>
                      <span className="font-semibold text-gray-900">₦{walletBalance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-blue-200 text-sm font-bold">
                      <span className="text-gray-900">Total Batch Cost:</span>
                      <span className="text-blue-700 text-base">₦{bulkTotalCost.toLocaleString()}</span>
                    </div>
                    {bulkHasInsufficientBalance && (
                      <p className="text-red-600 font-semibold pt-1">
                        ⚠️ Insufficient wallet balance for this batch. Please fund your wallet to proceed.
                      </p>
                    )}
                  </div>
                )}

                {/* 4. Submit Bulk Button */}
                <Button
                  onClick={handleBulkSubmit}
                  disabled={
                    bulkIsSubmitting ||
                    bulkSelectedPhones.length === 0 ||
                    (bulkServiceType === "data" && !bulkPlanValue) ||
                    bulkHasInsufficientBalance
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-6 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {bulkIsSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Dispensing to {bulkSelectedPhones.length} Tracker SIMs...
                    </>
                  ) : (
                    <>
                      {bulkServiceType === "data" ? <Wifi className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                      Recharge All {bulkSelectedPhones.length} SIMs
                      {bulkTotalCost > 0 && ` (₦${bulkTotalCost.toLocaleString()})`}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
