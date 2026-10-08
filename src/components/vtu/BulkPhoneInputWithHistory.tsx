"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  parseCommaSeparatedPhones,
  detectNetwork,
  type NetworkInfo,
} from "@/lib/phone-utils"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  ShieldAlert,
  CheckCheck,
  XCircle,
  Copy,
  Check,
  Info,
  Wifi,
  Smartphone,
} from "lucide-react"
import { SimTroubleshootCard } from "@/components/vtu/SimTroubleshootCard"

export interface PhoneHistoryItem {
  phone: string
  networkId: string | null
  networkName: string | null
  statusCategory: "ALREADY_LOADED" | "DUE_FOR_RENEWAL" | "NEVER_LOADED"
  isWithinMonth: boolean
  daysAgo: number | null
  lastData?: {
    id: string
    date: string
    formattedDate: string
    daysAgo: number
    plan: string
    amount: number
    daysUntilExpiry: number
    isExpired: boolean
    isExpiringSoon: boolean
  } | null
  lastAirtime?: {
    id: string
    date: string
    formattedDate: string
    daysAgo: number
    amount: number
    status: string
  } | null
  lastPurchase: {
    id: string
    date: string
    formattedDate: string
    daysAgo: number
    relativeText: string
    plan?: string | null
    network: string
    amount: number
    status: string
    type: "DATA" | "AIRTIME"
  } | null
}

interface BulkPhoneInputWithHistoryProps {
  type: "data" | "airtime"
  rawInput: string
  onRawInputChange: (value: string) => void
  selectedPhones: string[]
  onSelectedPhonesChange: (phones: string[]) => void
  targetNetworkId?: string
  onNetworkChange?: (networkId: string) => void
}

export function BulkPhoneInputWithHistory({
  type,
  rawInput,
  onRawInputChange,
  selectedPhones,
  onSelectedPhonesChange,
  targetNetworkId,
  onNetworkChange,
}: BulkPhoneInputWithHistoryProps) {
  const [historyMap, setHistoryMap] = useState<Record<string, PhoneHistoryItem>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Parse all unique numbers from raw text
  const parsedPhones = parseCommaSeparatedPhones(rawInput)

  const copySingleReport = (phone: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const history = historyMap[phone]
    let reportLine = ""
    if (history?.lastData) {
      const days = history.lastData.daysAgo === 0 ? "today" : `${history.lastData.daysAgo} days ago`
      const plan = history.lastData.plan ? ` (${history.lastData.plan})` : ""
      reportLine = `${phone} - Data: Last loaded ${days}${plan}`
    } else {
      reportLine = `${phone} - Data: Never loaded`
    }
    navigator.clipboard.writeText(reportLine)
    setCopiedPhone(phone)
    setTimeout(() => setCopiedPhone(null), 2000)
  }

  const copyAllReports = () => {
    const lines = parsedPhones.map((phone) => {
      const history = historyMap[phone]
      if (history?.lastData) {
        const days = history.lastData.daysAgo === 0 ? "today" : `${history.lastData.daysAgo} days ago`
        const plan = history.lastData.plan ? ` (${history.lastData.plan})` : ""
        return `${phone} - Data: Last loaded ${days}${plan}`
      }
      return `${phone} - Data: Never loaded`
    })
    navigator.clipboard.writeText(lines.join("\n"))
    setCopiedPhone("ALL")
    setTimeout(() => setCopiedPhone(null), 2500)
  }

  // Fetch history for phone numbers
  const checkHistory = useCallback(async (phonesToCheck: string[]) => {
    if (phonesToCheck.length === 0) return

    setIsLoading(true)
    try {
      const res = await fetch("/api/vtu/check-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones: phonesToCheck, type }),
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.results)) {
        setHistoryMap((prev) => {
          const next = { ...prev }
          for (const item of data.results) {
            next[item.phone] = item
          }
          return next
        })
      }
    } catch (err) {
      console.error("[BulkPhoneInput] Failed to check history:", err)
    } finally {
      setIsLoading(false)
    }
  }, [type])

  // Detect when parsed phones change, debounce history check, and sync selected phones
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (parsedPhones.length === 0) {
      onSelectedPhonesChange([])
      return
    }

    // Default select newly added phones
    const newSelected = parsedPhones.filter((p) =>
      selectedPhones.includes(p) || !selectedPhones.length
    )
    if (newSelected.length > 0 && selectedPhones.length === 0) {
      onSelectedPhonesChange(parsedPhones)
    } else {
      // Keep only selected phones that still exist in parsed list
      const validSelected = selectedPhones.filter((p) => parsedPhones.includes(p))
      if (validSelected.length !== selectedPhones.length) {
        onSelectedPhonesChange(validSelected)
      }
    }

    // Find phones not yet fetched in historyMap
    const missingPhones = parsedPhones.filter((p) => !historyMap[p])
    if (missingPhones.length > 0) {
      debounceTimerRef.current = setTimeout(() => {
        checkHistory(missingPhones)
      }, 400)
    }
  }, [rawInput, checkHistory])

  // Handle immediate paste event
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text")
    if (!pastedText) return
    const newlyPasted = parseCommaSeparatedPhones(pastedText)
    if (newlyPasted.length > 0) {
      // Immediately trigger check for pasted numbers without waiting for debounce
      checkHistory(newlyPasted)
    }
  }

  // Toggle selection for a specific phone
  const togglePhone = (phone: string) => {
    if (selectedPhones.includes(phone)) {
      onSelectedPhonesChange(selectedPhones.filter((p) => p !== phone))
    } else {
      onSelectedPhonesChange([...selectedPhones, phone])
    }
  }

  // Quick action: Deselect all numbers loaded within the past 30 days
  const deselectRecent = () => {
    const dueOrNew = parsedPhones.filter((phone) => {
      const item = historyMap[phone]
      return !item || item.statusCategory !== "ALREADY_LOADED"
    })
    onSelectedPhonesChange(dueOrNew)
  }

  // Quick action: Select All
  const selectAll = () => {
    onSelectedPhonesChange(parsedPhones)
  }

  // Quick action: Deselect All
  const deselectAll = () => {
    onSelectedPhonesChange([])
  }

  // Counts
  const recentCount = parsedPhones.filter(
    (p) => historyMap[p]?.statusCategory === "ALREADY_LOADED"
  ).length
  const dueCount = parsedPhones.filter(
    (p) => historyMap[p]?.statusCategory === "DUE_FOR_RENEWAL"
  ).length
  const newCount = parsedPhones.filter(
    (p) => historyMap[p]?.statusCategory === "NEVER_LOADED"
  ).length

  return (
    <div className="space-y-4">
      {/* Input Field Area */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            Recipient Numbers (Comma-Differentiated)
          </Label>
          <span className="text-[11px] text-muted-foreground">
            {parsedPhones.length} {parsedPhones.length === 1 ? "number" : "numbers"} detected
          </span>
        </div>

        <div className="relative">
          <Textarea
            value={rawInput}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onRawInputChange(e.target.value)}
            onPaste={handlePaste}
            placeholder="e.g. 08031234567, 08023456789, 07011223344 &#10;Or paste a whole column directly from Excel"
            className="min-h-[90px] text-sm font-mono tracking-wide resize-y pr-10"
            required
          />
          {isLoading && (
            <div className="absolute right-3 top-3 text-primary animate-spin">
              <Loader2 className="w-4 h-4" />
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Info className="w-3 h-3 text-muted-foreground shrink-0" />
          Separate numbers with a comma <code>,</code>. Spaces, newlines and international prefixes (<code>+234</code>) are handled automatically.
        </p>

        {/* Live Instant SIM Diagnostic Card when a single tracker SIM is entered or pasted */}
        {parsedPhones.length === 1 && (
          <div className="pt-2">
            <SimTroubleshootCard
              phone={parsedPhones[0]}
              onNetworkDetected={onNetworkChange}
            />
          </div>
        )}
      </div>

      {/* Summary Chips & Quick Filter Buttons */}
      {parsedPhones.length > 0 && (
        <div className="bg-muted/40 p-3 rounded-xl border space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span>Status Overview:</span>
              {recentCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {recentCount} loaded &le; 30d
                </span>
              )}
              {dueCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {dueCount} due for top-up
                </span>
              )}
              {newCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground border flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {newCount} new
                </span>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyAllReports}
                className="h-7 text-[11px] font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100 border-blue-200"
                title="Copy all SIM numbers and their data status for reporting"
              >
                {copiedPhone === "ALL" ? (
                  <>
                    <Check className="w-3 h-3 mr-1 text-emerald-600" />
                    Copied Report!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1 text-blue-600" />
                    Copy Report
                  </>
                )}
              </Button>
              {recentCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={deselectRecent}
                  className="h-7 text-[11px] font-semibold border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                >
                  <ShieldAlert className="w-3 h-3 mr-1 text-amber-500" />
                  Deselect Recent (&le; 30 Days)
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Number Breakdown List */}
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/40">
            {parsedPhones.map((phone) => {
              const isSelected = selectedPhones.includes(phone)
              const history = historyMap[phone]
              const net = detectNetwork(phone)
              const isNetworkMismatch =
                targetNetworkId && net && net.id !== targetNetworkId

              const isRecent = history?.statusCategory === "ALREADY_LOADED"
              const isDue = history?.statusCategory === "DUE_FOR_RENEWAL"
              const isNever = history?.statusCategory === "NEVER_LOADED"

              return (
                <div
                  key={phone}
                  onClick={() => togglePhone(phone)}
                  className={`pt-2 first:pt-0 flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                    isSelected
                      ? isRecent
                        ? "bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/30"
                        : "bg-primary/5 hover:bg-primary/10 border border-primary/20"
                      : "opacity-60 hover:opacity-90 hover:bg-muted/30"
                  }`}
                >
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => togglePhone(phone)}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                  />

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs tracking-wider text-foreground">
                        {phone}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => copySingleReport(phone, e)}
                        title="Copy status line for report"
                        className="inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors border border-gray-200/60 hover:border-blue-300"
                      >
                        {copiedPhone === phone ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-gray-400" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {/* Network Badge */}
                      {net ? (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            net.id === "01"
                              ? "bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 border border-yellow-400/40"
                              : net.id === "04"
                              ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
                              : net.id === "02"
                              ? "bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          }`}
                        >
                          {net.name}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          Unknown
                        </span>
                      )}

                      {/* Network mismatch alert */}
                      {isNetworkMismatch && (
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          Mismatch ({net?.name})
                        </span>
                      )}
                    </div>

                    {/* Live History Message: Data & Airtime Dual Diagnostics */}
                    <div className="mt-1 text-[11px] leading-snug">
                      {!history ? (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin inline" /> Checking SIM history...
                        </span>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {/* 1. GPRS Data Telemetry Status */}
                          <div
                            className={`p-1.5 rounded-md border text-[11px] ${
                              history.lastData?.isExpired
                                ? "bg-rose-50 border-rose-200 text-rose-900"
                                : history.lastData?.isExpiringSoon
                                ? "bg-amber-50 border-amber-200 text-amber-900"
                                : history.lastData
                                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                : "bg-gray-50 border-gray-200 text-gray-600"
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span className="flex items-center gap-1">
                                <Wifi className="w-3 h-3 text-blue-600 shrink-0" /> Data:
                              </span>
                              {history.lastData ? (
                                <span className="font-bold text-[10px]">
                                  {history.lastData.isExpired
                                    ? "EXPIRED"
                                    : `${history.lastData.daysUntilExpiry}d left`}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-500 font-normal">Never bought</span>
                              )}
                            </div>
                            {history.lastData && (
                              <div className="text-[10px] opacity-90 mt-0.5 truncate">
                                {history.lastData.plan} • {history.lastData.daysAgo}d ago
                              </div>
                            )}
                          </div>

                          {/* 2. SMS Airtime Status */}
                          <div
                            className={`p-1.5 rounded-md border text-[11px] ${
                              history.lastAirtime
                                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                : "bg-gray-50 border-gray-200 text-gray-600"
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span className="flex items-center gap-1">
                                <Smartphone className="w-3 h-3 text-indigo-600 shrink-0" /> Airtime:
                              </span>
                              {history.lastAirtime ? (
                                <span className="font-bold text-[10px]">
                                  {history.lastAirtime.daysAgo}d ago
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-500 font-normal">Never bought</span>
                              )}
                            </div>
                            {history.lastAirtime && (
                              <div className="text-[10px] opacity-90 mt-0.5 truncate">
                                ₦{history.lastAirtime.amount.toLocaleString()} • {history.lastAirtime.formattedDate}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom active count banner */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50 text-muted-foreground">
            <span>
              <strong>{selectedPhones.length}</strong> of <strong>{parsedPhones.length}</strong> numbers selected
            </span>
            {selectedPhones.length < parsedPhones.length && (
              <span className="text-amber-600 font-medium">
                {parsedPhones.length - selectedPhones.length} excluded
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
