"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { BulkPhoneInputWithHistory } from "@/components/vtu/BulkPhoneInputWithHistory"
import {
  AlertTriangle,
  Server,
  Loader2,
  Zap,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react"

export interface ServerOption {
  id: string
  serverName: string
  serverCode?: string | null
  providerName: string
  identifier: string
  isDefault?: boolean
}

interface AirtimeFormProps {
  servers: ServerOption[]
  initialServerId: string
  walletBalance: number
}

const NETWORK_OPTIONS = [
  { id: "01", name: "MTN", color: "bg-yellow-500 text-black border-yellow-400" },
  { id: "04", name: "Airtel", color: "bg-red-600 text-white border-red-500" },
  { id: "02", name: "Glo", color: "bg-green-600 text-white border-green-500" },
  { id: "03", name: "9Mobile", color: "bg-emerald-800 text-white border-emerald-700" },
]

export function AirtimeForm({
  servers,
  initialServerId,
  walletBalance: initialWalletBalance,
}: AirtimeFormProps) {
  const router = useRouter()
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance)
  const [selectedServerId, setSelectedServerId] = useState(initialServerId)
  const [selectedNetworkId, setSelectedNetworkId] = useState("01")
  const [amount, setAmount] = useState("")

  // Bulk / Comma-separated Phone Input State
  const [rawPhones, setRawPhones] = useState("")
  const [selectedPhones, setSelectedPhones] = useState<string[]>([])
  const [bypassSimCheck, setBypassSimCheck] = useState(false)

  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batchResults, setBatchResults] = useState<{
    totalProcessed: number
    successCount: number
    failureCount: number
    results: Array<{ phone: string; success: boolean; error?: string; reference?: string }>
  } | null>(null)

  const currentServer = servers.find((s) => s.id === selectedServerId)

  const amountNum = parseFloat(amount) || 0
  const totalAmount = amountNum * selectedPhones.length
  const hasInsufficientBalance = walletBalance < totalAmount

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (selectedPhones.length === 0) {
      setError("Please enter or select at least one recipient phone number.")
      return
    }

    if (!amountNum || amountNum < 50) {
      setError("Minimum airtime amount is ₦50 per number.")
      return
    }

    if (amountNum > 200000) {
      setError("Maximum airtime amount is ₦200,000 per number.")
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
          type: "airtime",
          networkId: selectedNetworkId,
          amount: amountNum,
          serverId: selectedServerId,
          phones: selectedPhones,
          bypassSimCheck,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Bulk airtime purchase failed")
      }

      setBatchResults(data)
      setWalletBalance((prev) => Math.max(0, prev - amountNum * data.successCount))
    } catch (err: any) {
      setError(err.message || "Failed to process airtime order")
    } finally {
      setIsProcessing(false)
    }
  }

  const resetForm = () => {
    setBatchResults(null)
    setRawPhones("")
    setSelectedPhones([])
    setAmount("")
    setBypassSimCheck(false)
    setError(null)
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto mt-6 space-y-6">
      {/* Multi-Server Selector */}
      {servers.length > 0 && (
        <div className="bg-muted/40 p-3 rounded-2xl border backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Server className="w-3.5 h-3.5" />
              Select VTU Server
            </div>
            <span className="text-xs text-primary font-medium flex items-center gap-1">
              <Zap className="w-3 h-3" /> High-speed Delivery
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {servers.map((srv) => {
              const isActive = srv.id === selectedServerId
              return (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => setSelectedServerId(srv.id)}
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

      {/* Main Airtime Card */}
      <Card className="shadow-lg border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4">
          <div>
            <CardTitle className="text-xl sm:text-2xl font-bold">
              Buy Airtime Top-up (Single or Bulk)
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Routing via:{" "}
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
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Buy More Airtime
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
                        onClick={() => setSelectedNetworkId(net.id)}
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

              {/* 2. Amount Input */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  2. Airtime Amount per Number (₦)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                    ₦
                  </span>
                  <Input
                    type="number"
                    placeholder="1000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-8 text-base font-semibold"
                    min="50"
                    max="200000"
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[50, 100, 200, 500, 1000, 2000, 5000].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setAmount(quick.toString())}
                      className={`text-xs py-1 px-2.5 rounded-lg border font-medium transition-all ${
                        amount === quick.toString()
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/30 hover:bg-muted text-foreground"
                      }`}
                    >
                      ₦{quick.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Recipient Phone Numbers with Live History and Comma Separation */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">
                  3. Recipient Numbers (Single or Bulk Comma-Separated)
                </Label>
                <BulkPhoneInputWithHistory
                  type="airtime"
                  rawInput={rawPhones}
                  onRawInputChange={setRawPhones}
                  selectedPhones={selectedPhones}
                  onSelectedPhonesChange={setSelectedPhones}
                  targetNetworkId={selectedNetworkId}
                  onNetworkChange={(netId) => setSelectedNetworkId(netId)}
                  bypassSimCheck={bypassSimCheck}
                  onBypassSimCheckChange={setBypassSimCheck}
                />
              </div>

              {/* 4. Bypass number validator (ClubKonnect Ported SIM Support) */}
              <div
                className={`p-3.5 rounded-xl border transition-all duration-200 ${
                  bypassSimCheck
                    ? "bg-amber-500/10 border-amber-500/40 shadow-sm"
                    : "bg-muted/30 border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`p-2 rounded-xl shrink-0 mt-0.5 transition-colors ${
                        bypassSimCheck
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground">
                          Bypass number validator
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider transition-colors ${
                            bypassSimCheck
                              ? "bg-amber-500 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {bypassSimCheck ? "Validator Bypassed" : "Off"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Enable this if any recipient number was ported to{" "}
                        <strong className="text-foreground font-semibold">
                          {NETWORK_OPTIONS.find((n) => n.id === selectedNetworkId)?.name || "Selected Network"}
                        </strong>{" "}
                        from another network (e.g. Glo <span className="font-mono">0805</span> line ported to MTN). This bypasses automated prefix validation so the top-up goes through irrespective of the network.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={bypassSimCheck}
                      onChange={(e) => setBypassSimCheck(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted-foreground/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                  </label>
                </div>

                {bypassSimCheck && (
                  <div className="mt-2.5 pt-2.5 border-t border-amber-500/20 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      Number validator bypassed: Airtime will go through as{" "}
                      <strong>
                        {NETWORK_OPTIONS.find((n) => n.id === selectedNetworkId)?.name}
                      </strong>{" "}
                      irrespective of number prefix.
                    </span>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3.5 bg-red-500/10 text-red-600 dark:text-red-400 text-xs rounded-xl border border-red-500/20 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="leading-snug">{error}</span>
                  </div>
                  {error.includes("Bypass number validator") && !bypassSimCheck && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setBypassSimCheck(true)
                        setError(null)
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 shadow-sm"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Click 'Bypass number validator' & Continue
                    </Button>
                  )}
                </div>
              )}

              {/* Selected Breakdown */}
              {amountNum > 0 && selectedPhones.length > 0 && (
                <div className="bg-primary/5 p-3.5 rounded-xl border border-primary/20 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount per Number:</span>
                    <span className="font-bold text-foreground">₦{amountNum.toLocaleString()}</span>
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
                  !amountNum ||
                  amountNum < 50 ||
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
