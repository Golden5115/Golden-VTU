"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { BulkPhoneInputWithHistory } from "@/components/vtu/BulkPhoneInputWithHistory"
import {
  AlertTriangle,
  CheckCircle,
  Server,
  Loader2,
  Zap,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react"

export interface ServerOption {
  id: string
  serverName: string
  serverCode?: string | null
  providerName: string
  identifier: string
  isDefault?: boolean
}

export interface PlanItem {
  id: string
  network: string
  networkName: string
  name: string
  price: number
  validity?: string
}

interface DataPurchaseFormProps {
  servers: ServerOption[]
  initialServerId: string
  initialPlans: PlanItem[]
  walletBalance: number
}

const NETWORK_OPTIONS = [
  { id: "01", name: "MTN", color: "bg-yellow-500 text-black border-yellow-400" },
  { id: "04", name: "Airtel", color: "bg-red-600 text-white border-red-500" },
  { id: "02", name: "Glo", color: "bg-green-600 text-white border-green-500" },
  { id: "03", name: "9Mobile", color: "bg-emerald-800 text-white border-emerald-700" },
]

export function DataPurchaseForm({
  servers,
  initialServerId,
  initialPlans,
  walletBalance: initialWalletBalance,
}: DataPurchaseFormProps) {
  const router = useRouter()
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)
  const [selectedServerId, setSelectedServerId] = useState(initialServerId)
  const [plans, setPlans] = useState<PlanItem[]>(initialPlans)
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)

  const [selectedNetworkId, setSelectedNetworkId] = useState("01")
  const [selectedPlan, setSelectedPlan] = useState<PlanItem | null>(null)

  // Bulk / Comma-separated Phone Input State
  const [rawPhones, setRawPhones] = useState("")
  const [selectedPhones, setSelectedPhones] = useState<string[]>([])

  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batchResults, setBatchResults] = useState<{
    totalProcessed: number
    successCount: number
    failureCount: number
    results: Array<{ phone: string; success: boolean; error?: string; reference?: string }>
  } | null>(null)

  // When selected server changes, fetch plans for that server
  const handleServerChange = async (serverId: string) => {
    if (serverId === selectedServerId) return
    setSelectedServerId(serverId)
    setSelectedPlan(null)
    setError(null)
    setIsLoadingPlans(true)

    try {
      const res = await fetch(`/api/servers/${serverId}/plans`)
      const data = await res.json()
      if (data.success && Array.isArray(data.plans)) {
        setPlans(data.plans)
      } else {
        setError(data.error || "Failed to load plans for this server")
      }
    } catch (err: any) {
      setError("Network error while switching server")
    } finally {
      setIsLoadingPlans(false)
    }
  }

  // Filter plans by selected network
  const filteredPlans = plans.filter((p) => p.network === selectedNetworkId)

  // Current server info
  const currentServer = servers.find((s) => s.id === selectedServerId)

  // Total price calculation
  const totalAmount = selectedPlan ? selectedPlan.price * selectedPhones.length : 0
  const hasInsufficientBalance = walletBalance < totalAmount

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (selectedPhones.length === 0) {
      setError("Please enter or select at least one recipient phone number.")
      return
    }

    if (!selectedPlan) {
      setError("Please select a data bundle plan.")
      return
    }

    if (hasInsufficientBalance) {
      setError(
        `Insufficient wallet balance. Total cost is ₦${totalAmount.toLocaleString()} for ${selectedPhones.length} numbers, but your balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet.`
      )
      return
    }

    setError(null)
    setIsProcessing(true)
    setBatchResults(null)

    try {
      const res = await fetch("/api/vtu/bulk-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "data",
          networkId: selectedNetworkId,
          planId: selectedPlan.id,
          amount: selectedPlan.price,
          serverId: selectedServerId,
          phones: selectedPhones,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Bulk purchase failed")
      }

      setBatchResults(data)
      setWalletBalance((prev) => Math.max(0, prev - selectedPlan.price * data.successCount))
    } catch (err: any) {
      setError(err.message || "Failed to process data order")
    } finally {
      setIsProcessing(false)
    }
  }

  const resetForm = () => {
    setBatchResults(null)
    setRawPhones("")
    setSelectedPhones([])
    setSelectedPlan(null)
    setError(null)
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto mt-6 space-y-6">
      {/* Multi-Server Selection Pill Navigation */}
      {servers.length > 0 && (
        <div className="bg-muted/40 p-3 rounded-2xl border backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Server className="w-3.5 h-3.5" />
              Select VTU Server
            </div>
            <span className="text-xs text-primary font-medium flex items-center gap-1">
              <Zap className="w-3 h-3" /> Live Server Pricing
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {servers.map((srv) => {
              const isActive = srv.id === selectedServerId
              return (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => handleServerChange(srv.id)}
                  className={`flex flex-col items-start text-left p-2.5 rounded-xl border transition-all text-xs relative ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                      : "bg-card hover:bg-muted/80 text-foreground border-border"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold truncate">{srv.serverName}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isActive ? "bg-green-300 animate-pulse" : "bg-green-500"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-[10px] mt-1 ${
                      isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}
                  >
                    {srv.providerName.toLowerCase().includes("club") ? "High-Speed Route" : srv.providerName.toLowerCase().includes("mock") ? "Sandbox Route" : "Express Route"}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Card */}
      <Card className="shadow-lg border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4">
          <div>
            <CardTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              Buy Data Bundle (Single or Bulk)
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Currently routed through:{" "}
              <span className="font-semibold text-foreground">
                {currentServer?.serverName || "Default Server"}
              </span>
            </CardDescription>
          </div>
          <div className="text-left sm:text-right bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20 w-fit sm:w-auto">
            <span className="text-[11px] text-muted-foreground block font-medium">Balance</span>
            <span className="text-base font-bold text-primary">₦{walletBalance.toLocaleString()}</span>
          </div>
        </CardHeader>

        <CardContent>
          {/* Results Screen after Bulk Submission */}
          {batchResults ? (
            <div className="space-y-5 py-2">
              <div className="text-center space-y-1">
                <div
                  className={`inline-flex p-3 rounded-full mb-2 ${
                    batchResults.successCount > 0
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-red-500/10 text-red-600"
                  }`}
                >
                  {batchResults.successCount > 0 ? (
                    <CheckCircle2 className="w-8 h-8" />
                  ) : (
                    <XCircle className="w-8 h-8" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  {batchResults.successCount > 0
                    ? "Order Completed Successfully"
                    : "Order Failed"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {batchResults.successCount} of {batchResults.totalProcessed} orders processed successfully.
                </p>
              </div>

              {/* Status List */}
              <div className="border rounded-xl p-3 max-h-60 overflow-y-auto space-y-2 bg-muted/20">
                {batchResults.results.map((res, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs p-2 bg-card rounded-lg border"
                  >
                    <div className="flex items-center gap-2">
                      {res.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      )}
                      <span className="font-mono font-bold">{res.phone}</span>
                    </div>
                    {res.success ? (
                      <span className="text-emerald-600 font-medium text-[11px]">
                        Success ({res.reference})
                      </span>
                    ) : (
                      <span className="text-red-500 text-[11px] truncate max-w-[200px]">
                        {res.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1 text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Buy More Data
                </Button>
                <Button
                  type="button"
                  onClick={() => router.push("/transactions")}
                  className="flex-1 text-xs font-semibold"
                >
                  View Transactions <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. Network Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  1. Select Mobile Network
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {NETWORK_OPTIONS.map((net) => {
                    const isSelected = selectedNetworkId === net.id
                    return (
                      <button
                        key={net.id}
                        type="button"
                        onClick={() => {
                          setSelectedNetworkId(net.id)
                          setSelectedPlan(null)
                        }}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                          isSelected
                            ? `${net.color} ring-2 ring-primary ring-offset-1 shadow-sm`
                            : "bg-muted/50 text-foreground hover:bg-muted"
                        }`}
                      >
                        {net.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 2. Plan Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground">
                    2. Select Data Plan (Prices adjust per server)
                  </Label>
                  {isLoadingPlans && (
                    <span className="text-xs text-primary flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Updating prices...
                    </span>
                  )}
                </div>

                {isLoadingPlans ? (
                  <div className="p-4 border rounded-xl text-center text-xs text-muted-foreground animate-pulse">
                    Fetching latest data plans and pricing for {currentServer?.serverName}...
                  </div>
                ) : filteredPlans.length === 0 ? (
                  <div className="p-4 border rounded-xl text-center text-xs text-muted-foreground bg-muted/20">
                    No plans available for this network on {currentServer?.serverName}. Try selecting another server above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                    {filteredPlans.map((plan) => {
                      const isSelected = selectedPlan?.id === plan.id
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setSelectedPlan(plan)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all text-sm ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                              : "border-border hover:border-muted-foreground/30 hover:bg-muted/20"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <p className="font-semibold text-foreground leading-tight">{plan.name}</p>
                            {plan.validity && (
                              <span className="text-[11px] text-muted-foreground">
                                {plan.validity.toLowerCase().includes("validity") ? plan.validity : `${plan.validity} Validity`}
                              </span>
                            )}
                          </div>
                          <div className="text-right font-bold text-primary text-base">
                            ₦{plan.price.toLocaleString()}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 3. Recipient Phone Numbers with Live History and Comma Separation */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  3. Recipient Numbers (Single or Bulk Comma-Separated)
                </Label>
                <BulkPhoneInputWithHistory
                  type="data"
                  rawInput={rawPhones}
                  onRawInputChange={setRawPhones}
                  selectedPhones={selectedPhones}
                  onSelectedPhonesChange={setSelectedPhones}
                  targetNetworkId={selectedNetworkId}
                  onNetworkChange={(netId) => setSelectedNetworkId(netId)}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 text-xs rounded-xl border border-red-500/20">
                  {error}
                </div>
              )}

              {/* Selected Plan and Price Breakdown */}
              {selectedPlan && selectedPhones.length > 0 && (
                <div className="bg-primary/5 p-3.5 rounded-xl border border-primary/20 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Selected Plan:</span>
                    <span className="font-bold text-foreground">{selectedPlan.name} (₦{selectedPlan.price.toLocaleString()} each)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Recipients:</span>
                    <span className="font-bold text-foreground">{selectedPhones.length} numbers</span>
                  </div>
                  <div className="border-t border-primary/20 pt-2 flex items-center justify-between">
                    <span className="font-bold text-foreground">Total to Pay ({currentServer?.serverName}):</span>
                    <span className="text-xl font-extrabold text-primary">
                      ₦{totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={
                  isProcessing ||
                  isLoadingPlans ||
                  !selectedPlan ||
                  selectedPhones.length === 0 ||
                  hasInsufficientBalance
                }
                className="w-full py-6 text-base font-bold shadow-md transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing {selectedPhones.length} Order(s) on {currentServer?.serverName}...
                  </>
                ) : (
                  `Confirm & Buy for ${selectedPhones.length || 0} Number(s) (₦${totalAmount.toLocaleString()})`
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
