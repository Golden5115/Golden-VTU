"use client"

import { useEffect, useState } from "react"
import {
  Wifi,
  Smartphone,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  Info,
  Calendar,
} from "lucide-react"
import { checkSimHistory, SimDiagnosticHistory } from "@/actions/sim-history.actions"

interface SimTroubleshootCardProps {
  phone: string
  onNetworkDetected?: (networkId: string) => void
  onQuickSelectAction?: (action: "data" | "airtime") => void
}

const NETWORK_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  "01": { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300", label: "MTN" },
  "02": { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300", label: "GLO" },
  "03": { bg: "bg-green-100", text: "text-green-800", border: "border-green-300", label: "9MOBILE" },
  "04": { bg: "bg-rose-100", text: "text-rose-800", border: "border-rose-300", label: "AIRTEL" },
}

export function SimTroubleshootCard({
  phone,
  onNetworkDetected,
  onQuickSelectAction,
}: SimTroubleshootCardProps) {
  const [data, setData] = useState<SimDiagnosticHistory | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const clean = phone.replace(/[^0-9]/g, "")
  const isCompleteNumber = clean.length >= 10

  useEffect(() => {
    if (!isCompleteNumber) {
      setData(null)
      return
    }

    let active = true
    setIsLoading(true)

    const timer = setTimeout(async () => {
      try {
        const res = await checkSimHistory(clean)
        if (active && res) {
          setData(res)
          if (res.network?.id && onNetworkDetected) {
            onNetworkDetected(res.network.id)
          }
        }
      } catch (e) {
        console.error("SIM history lookup error:", e)
      } finally {
        if (active) setIsLoading(false)
      }
    }, 250) // fast debounce for instant response when pasted

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [clean, isCompleteNumber])

  if (!isCompleteNumber) return null

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-50 border rounded-xl flex items-center justify-center gap-2 text-xs text-gray-500 animate-pulse my-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        Checking previous recharge history for {clean}...
      </div>
    )
  }

  if (!data) return null

  const net = data.network?.id ? NETWORK_COLORS[data.network.id] : null

  return (
    <div className="rounded-xl border shadow-xs overflow-hidden my-3 bg-white">
      {/* Top Diagnostic Banner */}
      <div
        className={`px-4 py-3 flex items-start gap-2.5 border-b ${
          data.summary.verdictType === "CRITICAL_EXPIRED"
            ? "bg-rose-50 border-rose-200 text-rose-900"
            : data.summary.verdictType === "WARNING_EXPIRING"
            ? "bg-amber-50 border-amber-200 text-amber-900"
            : data.summary.verdictType === "HEALTHY_ACTIVE"
            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
            : "bg-slate-50 border-slate-200 text-slate-800"
        }`}
      >
        <div className="shrink-0 mt-0.5">
          {data.summary.verdictType === "CRITICAL_EXPIRED" ? (
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          ) : data.summary.verdictType === "WARNING_EXPIRING" ? (
            <Clock className="w-5 h-5 text-amber-600" />
          ) : data.summary.verdictType === "HEALTHY_ACTIVE" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <Info className="w-5 h-5 text-slate-500" />
          )}
        </div>
        <div className="flex-1 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{data.summary.verdictTitle}</span>
            {net && (
              <span className={`px-2 py-0.2 rounded-sm text-[10px] font-bold border ${net.bg} ${net.text} ${net.border}`}>
                {net.label}
              </span>
            )}
            <span className="font-mono font-semibold text-gray-700">{data.phone}</span>
          </div>
          <p className="mt-0.5 opacity-90 leading-relaxed">{data.summary.verdictMessage}</p>
        </div>
      </div>

      {/* Two Column History Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 p-3 bg-slate-50/50 text-xs">
        {/* Left: GPRS Data Telemetry History */}
        <div className="p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-blue-600" />
              Last Data Bundle
            </span>
            {data.lastData ? (
              data.lastData.isExpired ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  EXPIRED
                </span>
              ) : data.lastData.isExpiringSoon ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {data.lastData.daysUntilExpiry}d left
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {data.lastData.daysUntilExpiry}d left
                </span>
              )
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                Never Bought
              </span>
            )}
          </div>

          {data.lastData ? (
            <div className="space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">Plan:</span>
                <span className="font-semibold text-gray-900">{data.lastData.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date Bought:</span>
                <span className="font-medium text-gray-800">
                  {data.lastData.formattedDate} ({data.lastData.daysAgo}d ago)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Amount:</span>
                <span className="font-medium text-gray-800">₦{data.lastData.amount.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">No previous data purchases found for this SIM.</p>
          )}

          {onQuickSelectAction && (
            <button
              type="button"
              onClick={() => onQuickSelectAction("data")}
              className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Wifi className="w-3 h-3" />
              Proceed with Buying Data
            </button>
          )}
        </div>

        {/* Right: SMS Airtime History */}
        <div className="p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
              Last Airtime Top-up
            </span>
            {data.lastAirtime ? (
              data.lastAirtime.needsAirtime ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {data.lastAirtime.daysAgo}d ago
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {data.lastAirtime.daysAgo}d ago
                </span>
              )
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                Never Bought
              </span>
            )}
          </div>

          {data.lastAirtime ? (
            <div className="space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">Amount:</span>
                <span className="font-semibold text-gray-900">₦{data.lastAirtime.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Date Bought:</span>
                <span className="font-medium text-gray-800">
                  {data.lastAirtime.formattedDate} ({data.lastAirtime.daysAgo}d ago)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="font-semibold text-emerald-600">{data.lastAirtime.status}</span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">No airtime purchases recorded for this SIM.</p>
          )}

          {onQuickSelectAction && (
            <button
              type="button"
              onClick={() => onQuickSelectAction("airtime")}
              className="w-full mt-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Smartphone className="w-3 h-3" />
              Proceed with Buying Airtime
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
