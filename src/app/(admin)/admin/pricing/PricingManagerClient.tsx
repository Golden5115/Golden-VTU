"use client"

import { useState, useTransition, useMemo, useEffect } from "react"
import { VtuDataPlan } from "@/services/providers/vtu-provider.interface"
import {
  updatePlanPriceAction,
  resetPlanPriceAction,
  updateDefaultMarkupAction,
} from "@/actions/pricing.actions"
import {
  Coins,
  Server,
  Search,
  Check,
  RotateCcw,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Filter,
  Loader2,
  Tag,
  Sliders,
} from "lucide-react"

interface ServerOption {
  id: string
  serverName: string
  identifier: string
  serverCode?: string | null
}

interface PricingManagerClientProps {
  servers: ServerOption[]
  initialServerId: string
  initialPlans: VtuDataPlan[]
  defaultMarkup: number
  customPriceCount: number
}

export const NETWORK_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  "01": { label: "MTN", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  "02": { label: "Glo", bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
  "03": { label: "9mobile", bg: "bg-green-50", text: "text-green-900", border: "border-green-200" },
  "04": { label: "Airtel", bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200" },
}

/**
 * Robust normalizer for carrier network codes across various VTU APIs.
 * Converts "1" | "01" | "MTN" -> "01", etc.
 */
export function normalizeNetworkId(net: string | undefined | null): string {
  if (!net) return ""
  const clean = String(net).trim().toLowerCase()
  if (clean === "01" || clean === "1" || clean === "mtn") return "01"
  if (clean === "02" || clean === "2" || clean === "glo" || clean === "globacom") return "02"
  if (clean === "03" || clean === "3" || clean === "9mobile" || clean === "etisalat") return "03"
  if (clean === "04" || clean === "4" || clean === "airtel") return "04"
  return clean.padStart(2, "0")
}

/**
 * Creates a unique composite key for a plan so duplicate numeric IDs across
 * different networks (e.g. MTN plan 2 vs Glo plan 2) do not collide.
 */
export function getPlanCompositeKey(plan: { network?: string; id: string | number }): string {
  return `${normalizeNetworkId(plan.network)}_${plan.id}`
}

export function PricingManagerClient({
  servers,
  initialServerId,
  initialPlans,
  defaultMarkup: serverDefaultMarkup,
  customPriceCount: initialCustomCount,
}: PricingManagerClientProps) {
  const [selectedServerId, setSelectedServerId] = useState(initialServerId)
  const [plans, setPlans] = useState<VtuDataPlan[]>(initialPlans)
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)

  // Default markup state
  const [defaultMarkup, setDefaultMarkup] = useState(serverDefaultMarkup)
  const [markupInput, setMarkupInput] = useState(serverDefaultMarkup.toString())
  const [isUpdatingMarkup, startMarkupTransition] = useTransition()
  const [markupFeedback, setMarkupFeedback] = useState<string | null>(null)

  // Filtering state
  const [selectedNetwork, setSelectedNetwork] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterCustomOnly, setFilterCustomOnly] = useState(false)

  // Edit states for individual plans (keyed by composite key: network_planId)
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({})
  const [savingPlanKey, setSavingPlanKey] = useState<string | null>(null)
  const [savedSuccessKey, setSavedSuccessKey] = useState<string | null>(null)
  const [customCount, setCustomCount] = useState(initialCustomCount)

  // Sync state if server component re-renders with fresh plans or server
  useEffect(() => {
    if (initialPlans && initialPlans.length > 0) {
      setPlans(initialPlans)
    }
  }, [initialPlans])

  useEffect(() => {
    if (initialServerId) {
      setSelectedServerId(initialServerId)
    }
  }, [initialServerId])

  const currentServer = servers.find((s) => s.id === selectedServerId) || servers[0]

  // Switch server and fetch its plans
  async function handleSwitchServer(serverId: string) {
    if (serverId === selectedServerId) return
    setSelectedServerId(serverId)
    setIsLoadingPlans(true)
    try {
      const res = await fetch(`/api/servers/${serverId}/plans`)
      const data = await res.json()
      if (data.success && Array.isArray(data.plans)) {
        setPlans(data.plans)
      }
    } catch (err) {
      console.error("Failed to load server plans:", err)
    } finally {
      setIsLoadingPlans(false)
    }
  }

  // Update Global Default Markup
  function handleSaveDefaultMarkup() {
    const val = parseFloat(markupInput)
    if (isNaN(val) || val < 0) {
      setMarkupFeedback("Markup must be ₦0 or greater")
      return
    }

    startMarkupTransition(async () => {
      try {
        await updateDefaultMarkupAction(val)
        setDefaultMarkup(val)
        setMarkupFeedback("Default markup updated successfully!")
        setTimeout(() => setMarkupFeedback(null), 3500)
        // Refresh plans
        const res = await fetch(`/api/servers/${selectedServerId}/plans`)
        const data = await res.json()
        if (data.success && Array.isArray(data.plans)) {
          setPlans(data.plans)
        }
      } catch (err: any) {
        setMarkupFeedback(err.message || "Failed to update default markup")
      }
    })
  }

  // Save manual custom price for a specific plan
  async function handleSavePlanPrice(plan: VtuDataPlan) {
    const planKey = getPlanCompositeKey(plan)
    const inputVal = priceInputs[planKey] ?? plan.price.toString()
    const parsedPrice = parseFloat(inputVal)
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      alert("Please enter a valid price amount greater than 0.")
      return
    }

    const net = normalizeNetworkId(plan.network)
    setSavingPlanKey(planKey)
    try {
      await updatePlanPriceAction({
        provider: currentServer.identifier,
        network: net,
        planId: plan.id,
        planName: plan.name,
        customPrice: parsedPrice,
      })

      // Update in local state: ONLY match both planId AND network to prevent cross-network pollution
      setPlans((prev) =>
        prev.map((p) =>
          p.id === plan.id && normalizeNetworkId(p.network) === net
            ? { ...p, price: Math.ceil(parsedPrice), isCustomPrice: true }
            : p
        )
      )
      setCustomCount((c) => c + 1)
      setSavedSuccessKey(planKey)
      setTimeout(() => setSavedSuccessKey(null), 2500)
    } catch (err: any) {
      alert(err.message || "Failed to update plan price")
    } finally {
      setSavingPlanKey(null)
    }
  }

  // Reset a custom price back to default markup
  async function handleResetPlanPrice(plan: VtuDataPlan) {
    const planKey = getPlanCompositeKey(plan)
    const net = normalizeNetworkId(plan.network)
    setSavingPlanKey(planKey)
    try {
      await resetPlanPriceAction({
        provider: currentServer.identifier,
        network: net,
        planId: plan.id,
      })

      // Re-fetch plans to recalculate with default markup
      const res = await fetch(`/api/servers/${selectedServerId}/plans`)
      const data = await res.json()
      if (data.success && Array.isArray(data.plans)) {
        setPlans(data.plans)
      }
      setPriceInputs((prev) => {
        const next = { ...prev }
        delete next[planKey]
        return next
      })
      setCustomCount((c) => Math.max(0, c - 1))
      setSavedSuccessKey(planKey)
      setTimeout(() => setSavedSuccessKey(null), 2500)
    } catch (err: any) {
      alert(err.message || "Failed to reset plan price")
    } finally {
      setSavingPlanKey(null)
    }
  }

  // Filter plans with network code normalization
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const net = normalizeNetworkId(p.network)
      if (selectedNetwork !== "ALL" && net !== selectedNetwork) return false
      if (filterCustomOnly && !p.isCustomPrice) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.networkName && p.networkName.toLowerCase().includes(q)) ||
          (p.validity && p.validity.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [plans, selectedNetwork, filterCustomOnly, searchQuery])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Coins className="w-6 h-6 text-amber-500" />
            Data Pricing &amp; Profit Margins
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manually set customer selling prices for each data bundle or adjust the default profit markup across your servers.
          </p>
        </div>
      </div>

      {/* 2. Top Metric & Global Controls Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Global Default Markup */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Default Profit Markup
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
              Auto-Applied
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Added to carrier wholesale cost whenever a plan doesn't have an individual custom price override.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₦</span>
              <input
                type="number"
                min="0"
                step="10"
                value={markupInput}
                onChange={(e) => setMarkupInput(e.target.value)}
                className="w-full pl-7 pr-3 py-2 text-sm font-bold border rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveDefaultMarkup}
              disabled={isUpdatingMarkup}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center gap-1.5"
            >
              {isUpdatingMarkup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Update
            </button>
          </div>

          {markupFeedback && (
            <p className="text-[11px] font-semibold text-emerald-600 animate-fadeIn">
              {markupFeedback}
            </p>
          )}
        </div>

        {/* Card 2: Custom Overrides Counter */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-blue-500" />
              Custom Overrides
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
              Active
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{customCount}</span>
            <span className="text-xs text-slate-500 font-medium">plans manually customized</span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            These plans will always sell at your fixed custom price, regardless of carrier wholesale fluctuations.
          </p>
        </div>

        {/* Card 3: Instant Live Sync Status */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Live Wallet Sync
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <p className="text-xs text-slate-700 font-semibold">
            All price adjustments apply instantly to the customer recharge page and tracker top-up stations.
          </p>

          <p className="text-[11px] text-slate-500">
            Current Server: <strong className="text-slate-800">{currentServer.serverName}</strong> ({plans.length} total bundles).
          </p>
        </div>
      </div>

      {/* 3. Server Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-100 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2 overflow-x-auto">
          {servers.map((s) => {
            const isSelected = s.id === selectedServerId
            const isServer1 = s.serverCode === "server-1" || s.identifier === "CLUBKONNECT"
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSwitchServer(s.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  isSelected
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                    : isServer1
                    ? "text-slate-400 bg-slate-200/50 hover:bg-slate-200/80"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Server className="w-3.5 h-3.5 text-blue-600" />
                <span>{s.serverName}</span>
                {isServer1 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    Offline
                  </span>
                )}
                <span className="text-[10px] opacity-60 uppercase font-mono">({s.identifier})</span>
              </button>
            )
          })}
        </div>

        {isLoadingPlans && (
          <span className="text-xs text-blue-600 font-semibold flex items-center gap-1.5 px-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading latest server plans...
          </span>
        )}
      </div>

      {/* 4. Search and Network Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Network Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedNetwork("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              selectedNetwork === "ALL"
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            All Networks ({plans.length})
          </button>

          {["01", "04", "02", "03"].map((netId) => {
            const badge = NETWORK_BADGES[netId]
            const count = plans.filter((p) => normalizeNetworkId(p.network) === netId).length
            const isSelected = selectedNetwork === netId

            // Dedicated network color styles when selected
            const activeClass =
              netId === "01"
                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                : netId === "04"
                ? "bg-rose-600 text-white border-rose-700 shadow-xs"
                : netId === "02"
                ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                : "bg-green-700 text-white border-green-800 shadow-xs"

            return (
              <button
                key={netId}
                type="button"
                onClick={() => setSelectedNetwork(netId)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? activeClass
                    : `bg-white ${badge.text} border-slate-200 hover:bg-slate-50`
                }`}
              >
                {badge.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Search Bar & Custom Only Toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Filter plan name (e.g. 500MB, 1GB)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={() => setFilterCustomOnly(!filterCustomOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              filterCustomOnly
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
            title="Filter plans that have manual price overrides"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Customized Only</span>
          </button>
        </div>
      </div>

      {/* 5. Plans Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Active Network / Count Indicator Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              {selectedNetwork === "ALL" ? (
                <>Showing all <strong className="text-slate-900">{filteredPlans.length}</strong> data bundles</>
              ) : (
                <>
                  Showing <strong className="text-slate-900">{filteredPlans.length}</strong> {NETWORK_BADGES[selectedNetwork]?.label || selectedNetwork} data bundles
                </>
              )}
            </span>
            {filterCustomOnly && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                Customized Only
              </span>
            )}
            {searchQuery.trim() && (
              <span className="text-slate-500 text-[11px]">
                Matching &quot;{searchQuery}&quot;
              </span>
            )}
          </div>
          {selectedNetwork !== "ALL" && (
            <button
              type="button"
              onClick={() => setSelectedNetwork("ALL")}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline self-start sm:self-auto cursor-pointer"
            >
              Reset to All Networks
            </button>
          )}
        </div>

        {filteredPlans.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs sm:text-sm space-y-2">
            <p>
              No data plans matched your filter {selectedNetwork !== "ALL" ? `for ${NETWORK_BADGES[selectedNetwork]?.label || selectedNetwork}` : ""} on {currentServer.serverName}.
            </p>
            {selectedNetwork !== "ALL" && (
              <button
                type="button"
                onClick={() => setSelectedNetwork("ALL")}
                className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                View all networks ({plans.length})
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b bg-slate-50/70 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                  <th className="py-3.5 px-4">Network</th>
                  <th className="py-3.5 px-4">Data Plan &amp; Duration</th>
                  <th className="py-3.5 px-4">Wholesale Carrier Cost</th>
                  <th className="py-3.5 px-4">Your Margin</th>
                  <th className="py-3.5 px-4">Customer Selling Price</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPlans.map((plan) => {
                  const planKey = getPlanCompositeKey(plan)
                  const normNet = normalizeNetworkId(plan.network)
                  const badge = NETWORK_BADGES[normNet] || {
                    label: plan.networkName || normNet,
                    bg: "bg-slate-100",
                    text: "text-slate-700",
                    border: "border-slate-200",
                  }
                  const wholesale = plan.rawPrice ?? Math.max(0, plan.price - defaultMarkup)
                  const currentPrice = plan.price
                  const margin = currentPrice - wholesale
                  const inputValue = priceInputs[planKey] ?? currentPrice.toString()
                  const isSaving = savingPlanKey === planKey
                  const isSuccess = savedSuccessKey === planKey

                  return (
                    <tr key={planKey} className="hover:bg-slate-50/80 transition-colors">
                      {/* Network */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                      </td>

                      {/* Plan Name & Validity */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 leading-snug">{plan.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Code: {plan.id} {plan.validity ? `• ${plan.validity}` : ""}
                        </div>
                      </td>

                      {/* Wholesale Cost */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-600 whitespace-nowrap">
                        ₦{wholesale.toLocaleString()}
                      </td>

                      {/* Profit Margin */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            margin >= defaultMarkup
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : margin > 0
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-rose-50 text-rose-800 border border-rose-200"
                          }`}
                        >
                          +₦{margin.toLocaleString()}
                        </span>
                      </td>

                      {/* Customer Selling Price Input */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="relative w-28 sm:w-32">
                            <span className="absolute left-2.5 top-2 text-slate-400 font-bold text-xs">₦</span>
                            <input
                              type="number"
                              min={wholesale}
                              step="5"
                              value={inputValue}
                              onChange={(e) =>
                                setPriceInputs((prev) => ({
                                  ...prev,
                                  [planKey]: e.target.value,
                                }))
                              }
                              className={`w-full pl-6 pr-2 py-1.5 text-xs sm:text-sm font-bold border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden ${
                                plan.isCustomPrice
                                  ? "border-blue-400 bg-blue-50/40 text-blue-900 font-extrabold"
                                  : "border-slate-200 bg-white text-slate-900"
                              }`}
                            />
                          </div>

                          {plan.isCustomPrice && (
                            <span
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded border border-blue-200 hidden sm:inline-block"
                              title="Custom price set manually by admin"
                            >
                              Manual
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSavePlanPrice(plan)}
                            disabled={isSaving}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isSuccess
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-900 hover:bg-slate-800 text-white"
                            }`}
                          >
                            {isSaving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isSuccess ? (
                              <>
                                <Check className="w-3.5 h-3.5" /> Saved
                              </>
                            ) : (
                              "Set Price"
                            )}
                          </button>

                          {plan.isCustomPrice && (
                            <button
                              type="button"
                              onClick={() => handleResetPlanPrice(plan)}
                              disabled={isSaving}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Reset to default automated markup"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
