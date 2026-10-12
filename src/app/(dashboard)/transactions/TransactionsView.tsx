"use client"

import React, { useState, useMemo, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowDownLeft,
  Wifi,
  Smartphone,
  CreditCard,
  AlertCircle,
  Search,
  Calendar,
  Filter,
  X,
  RotateCcw,
  Loader2,
} from "lucide-react"
import { LiveStatusButton } from "@/components/vtu/LiveStatusButton"
import { format12HourDateTime } from "@/lib/phone-utils"

export type UnifiedTx = {
  id: string
  reference: string
  type: "WALLET_CREDIT" | "AIRTIME" | "DATA"
  label: string
  phone?: string
  networkId?: string
  networkName?: string
  amount: number
  status: string
  isRefunded: boolean
  date: string // ISO string or serializable timestamp
}

interface TransactionsViewProps {
  initialTransactions: UnifiedTx[]
  isAdmin: boolean
}

type TypeFilter = "ALL" | "DEPOSIT" | "AIRTIME" | "DATA"
type DatePreset = "ALL" | "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "CUSTOM"

/**
 * Returns YYYY-MM-DD representation of any timestamp strictly in Nigerian Timezone (Africa/Lagos).
 */
function getLagosDateString(d: Date | string): string {
  try {
    const dateObj = new Date(d)
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    return formatter.format(dateObj)
  } catch {
    return ""
  }
}

export function TransactionsView({ initialTransactions, isAdmin }: TransactionsViewProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [datePreset, setDatePreset] = useState<DatePreset>("ALL")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")

  // Calculate today's Nigerian date string: "YYYY-MM-DD"
  const todayLagos = useMemo(() => getLagosDateString(new Date()), [])

  // Calculate yesterday's Nigerian date string
  const yesterdayLagos = useMemo(() => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return getLagosDateString(yesterday)
  }, [])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const nowMs = Date.now()

    return initialTransactions.filter((tx) => {
      // 1. Type Filter (Deposits only, Airtime only, Data only, All)
      if (typeFilter === "DEPOSIT" && tx.type !== "WALLET_CREDIT") return false
      if (typeFilter === "AIRTIME" && tx.type !== "AIRTIME") return false
      if (typeFilter === "DATA" && tx.type !== "DATA") return false

      // 2. Search Query (Number, reference, plan label)
      if (query) {
        const matchesPhone = tx.phone?.toLowerCase().includes(query)
        const matchesRef = tx.reference?.toLowerCase().includes(query)
        const matchesLabel = tx.label?.toLowerCase().includes(query)
        const matchesNetwork = tx.networkName?.toLowerCase().includes(query)

        if (!matchesPhone && !matchesRef && !matchesLabel && !matchesNetwork) {
          return false
        }
      }

      // 3. Date Filter (Nigerian timezone aware)
      if (datePreset !== "ALL") {
        const txLagosDate = getLagosDateString(tx.date)
        const txMs = new Date(tx.date).getTime()
        const diffDays = Math.floor((nowMs - txMs) / (1000 * 60 * 60 * 24))

        if (datePreset === "TODAY") {
          if (txLagosDate !== todayLagos) return false
        } else if (datePreset === "YESTERDAY") {
          if (txLagosDate !== yesterdayLagos) return false
        } else if (datePreset === "LAST_7_DAYS") {
          if (diffDays > 7) return false
        } else if (datePreset === "LAST_30_DAYS") {
          if (diffDays > 30) return false
        } else if (datePreset === "THIS_MONTH") {
          const currentMonth = todayLagos.substring(0, 7)
          if (!txLagosDate.startsWith(currentMonth)) return false
        } else if (datePreset === "CUSTOM") {
          if (customStartDate && txLagosDate < customStartDate) return false
          if (customEndDate && txLagosDate > customEndDate) return false
        }
      }

      return true
    })
  }, [initialTransactions, typeFilter, searchQuery, datePreset, customStartDate, customEndDate, todayLagos, yesterdayLagos])

  const [isPending, startTransition] = useTransition()
  const isAnyFilterActive = typeFilter !== "ALL" || Boolean(searchQuery.trim()) || datePreset !== "ALL"

  const handleTabClick = (type: TypeFilter) => {
    startTransition(() => {
      setTypeFilter(type)
    })
  }

  const handleResetFilters = () => {
    startTransition(() => {
      setTypeFilter("ALL")
      setSearchQuery("")
      setDatePreset("ALL")
      setCustomStartDate("")
      setCustomEndDate("")
    })
  }

  return (
    <div className="space-y-4">
      {/* FILTER CONTROLS TOOLBAR */}
      <Card className="border shadow-xs bg-white">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Row 1: Type Tabs (Quick switch: All, Deposits Only, Airtime, Data) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none border-b border-gray-100 pb-3">
            <button
              type="button"
              onClick={() => handleTabClick("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                typeFilter === "ALL"
                  ? "bg-gray-900 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {isPending && typeFilter === "ALL" && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              )}
              <span>All Records</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabClick("DEPOSIT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                typeFilter === "DEPOSIT"
                  ? "bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/20"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              {isPending && typeFilter === "DEPOSIT" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <ArrowDownLeft className="w-3.5 h-3.5" />
              )}
              <span>Deposits Only</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabClick("DATA")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                typeFilter === "DATA"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200"
              }`}
            >
              {isPending && typeFilter === "DATA" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Wifi className="w-3.5 h-3.5" />
              )}
              <span>Data Only</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabClick("AIRTIME")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                typeFilter === "AIRTIME"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200"
              }`}
            >
              {isPending && typeFilter === "AIRTIME" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Smartphone className="w-3.5 h-3.5" />
              )}
              <span>Airtime Only</span>
            </button>

            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="ml-auto px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1 transition-colors shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Row 2: Search Input + Date Filter Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Search Input: Number / Reference */}
            <div className="sm:col-span-7 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phone number (e.g. 0905...) or reference..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-gray-900 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Preset Dropdown */}
            <div className="sm:col-span-5 relative">
              <div className="flex items-center gap-2">
                <div className="relative w-full">
                  <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
                  <select
                    value={datePreset}
                    onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 font-medium"
                  >
                    <option value="ALL">All Dates</option>
                    <option value="TODAY">Today (Nigerian Time)</option>
                    <option value="YESTERDAY">Yesterday</option>
                    <option value="LAST_7_DAYS">Last 7 Days</option>
                    <option value="LAST_30_DAYS">Last 30 Days</option>
                    <option value="THIS_MONTH">This Month</option>
                    <option value="CUSTOM">Custom Date Range...</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Custom Date Range Pickers (shown when Custom is selected) */}
          {datePreset === "CUSTOM" && (
            <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-3 text-xs bg-amber-50/50 p-2.5 rounded-lg border border-amber-200">
              <span className="font-bold text-amber-900 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Custom Range:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-medium">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 font-medium">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate("")
                    setCustomEndDate("")
                  }}
                  className="text-[11px] text-rose-600 font-semibold hover:underline"
                >
                  Clear dates
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* TRANSACTIONS DISPLAY */}
      <Card className="border shadow-xs bg-white">
        <CardHeader className="pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-gray-900">
              <Filter className="w-4 h-4 text-gray-500" />
              <span>
                {typeFilter === "DEPOSIT"
                  ? "Wallet Deposits History"
                  : typeFilter === "AIRTIME"
                  ? "Airtime Purchases"
                  : typeFilter === "DATA"
                  ? "Data Bundle Purchases"
                  : "All Transaction History"}
              </span>
            </CardTitle>
            {isPending && (
              <span className="text-xs font-semibold text-blue-600 flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating...</span>
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <div className="text-sm font-semibold text-gray-700">No matching transactions found</div>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                {isAnyFilterActive
                  ? "Try loosening your search query, switching filter tabs, or clearing your date filters."
                  : "No transactions recorded in your account yet."}
              </p>
              {isAnyFilterActive && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card List View (Visible on phones < 768px) */}
              <div className="space-y-3 md:hidden">
                {filteredTransactions.map((tx) => {
                  const dt = format12HourDateTime(tx.date)
                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-xl border bg-slate-50/70 hover:bg-white transition-colors space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {tx.type === "WALLET_CREDIT" ? (
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                              <ArrowDownLeft className="w-4 h-4" />
                            </div>
                          ) : tx.type === "DATA" ? (
                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                              <Wifi className="w-4 h-4" />
                            </div>
                          ) : tx.type === "AIRTIME" ? (
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                              <Smartphone className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                              <CreditCard className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-xs text-gray-900 leading-tight">
                              {tx.label}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {tx.networkName && (
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                    tx.networkId === "01"
                                      ? "bg-amber-100 text-amber-900"
                                      : tx.networkId === "04"
                                      ? "bg-red-100 text-red-900"
                                      : tx.networkId === "02"
                                      ? "bg-emerald-100 text-emerald-900"
                                      : tx.networkId === "03"
                                      ? "bg-teal-100 text-teal-900"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {tx.networkName}
                                </span>
                              )}
                              {tx.phone && (
                                <span className="text-[11px] font-mono font-bold text-gray-700">
                                  {tx.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`font-black text-sm ${
                              tx.type === "WALLET_CREDIT" ? "text-emerald-700" : "text-gray-900"
                            }`}
                          >
                            {tx.type === "WALLET_CREDIT" ? "+" : "-"}₦
                            {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <div className="flex items-center gap-1.5 justify-end mt-0.5">
                            {tx.status === "SUCCESS" ? (
                              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-800">
                                SUCCESS
                              </span>
                            ) : tx.isRefunded || tx.status === "FAILED" ? (
                              <span
                                className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200"
                                title="Transaction was not completed and funds were refunded"
                              >
                                REFUNDED
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                PROCESSING
                              </span>
                            )}
                            {isAdmin && (
                              <LiveStatusButton
                                reference={tx.reference}
                                currentStatus={tx.status}
                                isVtuPurchase={tx.type === "DATA" || tx.type === "AIRTIME"}
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                        <span className="font-mono truncate max-w-[150px]">{tx.reference}</span>
                        <span className="font-medium text-gray-600">{dt.full}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop Table View (Visible on md and above) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Network</TableHead>
                      <TableHead>Phone / Recipient</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Date & Time (Nigerian 12h)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx) => {
                      const dt = format12HourDateTime(tx.date)
                      return (
                        <TableRow key={tx.id} className="hover:bg-slate-50/70">
                          <TableCell>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                tx.type === "WALLET_CREDIT"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : tx.type === "DATA"
                                  ? "bg-blue-100 text-blue-800"
                                  : tx.type === "AIRTIME"
                                  ? "bg-indigo-100 text-indigo-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {tx.type === "WALLET_CREDIT" ? "DEPOSIT" : tx.type}
                            </span>
                            <div className="text-[11px] text-gray-600 font-medium mt-0.5 truncate max-w-[180px]">
                              {tx.label}
                            </div>
                          </TableCell>

                          <TableCell>
                            {tx.networkName ? (
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  tx.networkId === "01"
                                    ? "bg-amber-100 text-amber-900 border border-amber-200"
                                    : tx.networkId === "04"
                                    ? "bg-red-100 text-red-900 border border-red-200"
                                    : tx.networkId === "02"
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                                    : tx.networkId === "03"
                                    ? "bg-teal-100 text-teal-900 border border-teal-200"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {tx.networkName}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {tx.phone ? (
                              <span className="font-mono text-xs font-bold text-gray-900">
                                {tx.phone}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </TableCell>

                          <TableCell className="font-mono text-xs text-gray-600">
                            {tx.reference}
                          </TableCell>

                          <TableCell className="font-bold text-xs">
                            <span className={tx.type === "WALLET_CREDIT" ? "text-emerald-700" : "text-gray-900"}>
                              {tx.type === "WALLET_CREDIT" ? "+" : "-"}₦
                              {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {tx.status === "SUCCESS" ? (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
                                  SUCCESS
                                </span>
                              ) : tx.isRefunded || tx.status === "FAILED" ? (
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1"
                                  title="Transaction failed & funds were refunded to your wallet"
                                >
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  <span>REFUNDED</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  PROCESSING
                                </span>
                              )}
                              {isAdmin && (
                                <LiveStatusButton
                                  reference={tx.reference}
                                  currentStatus={tx.status}
                                  isVtuPurchase={tx.type === "DATA" || tx.type === "AIRTIME"}
                                />
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="text-xs font-medium text-gray-900">{dt.dateStr}</div>
                            <div className="text-[11px] font-mono text-gray-500">{dt.timeStr}</div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
