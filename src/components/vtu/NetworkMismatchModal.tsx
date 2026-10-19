"use client"

import React, { useEffect } from "react"
import { AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface NetworkMismatchModalProps {
  isOpen: boolean
  onClose: () => void
  phone?: string
  phones?: string[]
  detectedNetworkId?: string | null
  detectedNetworkName?: string | null
  selectedNetworkId: string
  selectedNetworkName: string
  onProceed: () => void
  onSwitchToDetected?: (targetNetworkId: string) => void
  isBulk?: boolean
  mismatchedCount?: number
  totalCount?: number
}

export function NetworkMismatchModal({
  isOpen,
  onClose,
  phone,
  phones = [],
  detectedNetworkId,
  detectedNetworkName,
  selectedNetworkId,
  selectedNetworkName,
  onProceed,
  onSwitchToDetected,
  isBulk = false,
  mismatchedCount = 0,
  totalCount = 0,
}: NetworkMismatchModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const displayDetectedName = detectedNetworkName || "another carrier"
  const displaySelectedName = selectedNetworkName || "the selected network"

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border-2 border-amber-300 dark:border-amber-600/50 shadow-2xl overflow-hidden p-6 space-y-4 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 ring-4 ring-amber-50 dark:ring-amber-900/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-0.5 pr-6">
            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
              Carrier Network Mismatch
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              Review destination carrier before continuing
            </p>
          </div>
        </div>

        {/* Visual Comparison Box */}
        {!isBulk && phone && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-300">Recipient Phone:</span>
              <span className="font-mono font-bold text-gray-900 dark:text-gray-100 text-sm">
                {phone}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-800/40 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                  Detected Line
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {displayDetectedName}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                  Selected Network
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {displaySelectedName}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Comparison Box */}
        {isBulk && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-300">Total SIMs in Batch:</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{totalCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-800 dark:text-amber-400 font-semibold">
                Mismatched Numbers:
              </span>
              <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-200/50 dark:bg-amber-900/50 px-2 py-0.5 rounded-full text-[11px]">
                {mismatchedCount} of {totalCount}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 dark:border-amber-800/40">
              <span className="text-gray-600 dark:text-gray-300">Selected Carrier for Batch:</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{displaySelectedName}</span>
            </div>
          </div>
        )}

        {/* Explanatory Message */}
        <div className="text-xs text-gray-600 dark:text-gray-300 space-y-2 leading-relaxed">
          {!isBulk ? (
            <p>
              This phone number is identified as an{" "}
              <strong className="text-gray-900 dark:text-white">{displayDetectedName}</strong> line,
              not <strong className="text-gray-900 dark:text-white">{displaySelectedName}</strong>.
            </p>
          ) : (
            <p>
              <strong className="text-gray-900 dark:text-white">{mismatchedCount}</strong> number(s)
              in this batch do not match your selected carrier (
              <strong className="text-gray-900 dark:text-white">{displaySelectedName}</strong>).
            </p>
          )}

          <p className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-[11px] text-gray-500 dark:text-gray-400">
            <strong>Ported SIM or Special Routing:</strong> If this number was ported between
            networks or you intentionally want to route this transaction through{" "}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {displaySelectedName}
            </span>
            , you can proceed.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          {/* Option 1: Switch to detected network (recommended) */}
          {!isBulk && detectedNetworkId && onSwitchToDetected && (
            <Button
              type="button"
              onClick={() => onSwitchToDetected(detectedNetworkId)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 min-h-[42px] rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>Switch to {displayDetectedName} (Recommended)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}

          {/* Option 2: Proceed with selected network anyway */}
          <Button
            type="button"
            onClick={onProceed}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2.5 min-h-[42px] rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
          >
            <span>Proceed with {displaySelectedName}</span>
          </Button>

          {/* Option 3: Cancel / Review */}
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="w-full text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 py-2 rounded-xl"
          >
            Cancel & Review Selection
          </Button>
        </div>
      </div>
    </div>
  )
}
