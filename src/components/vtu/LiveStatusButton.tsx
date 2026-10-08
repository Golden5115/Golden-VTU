"use client"

import { useState } from "react"
import { queryDirectCarrierStatus } from "@/actions/sim-history.actions"
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, XCircle } from "lucide-react"

interface LiveStatusButtonProps {
  reference: string
  currentStatus: string
  isVtuPurchase?: boolean
}

export function LiveStatusButton({ reference, currentStatus, isVtuPurchase = true }: LiveStatusButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  if (!isVtuPurchase || !reference.startsWith("DAT-") && !reference.startsWith("AIR-")) {
    return null
  }

  const handleQuery = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setLoading(true)
    setError(null)
    setIsOpen(true)
    try {
      const res = await queryDirectCarrierStatus(reference)
      setResult(res.data)
    } catch (err: any) {
      setError(err?.message || "Failed to query carrier API")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-block relative">
      <button
        type="button"
        onClick={handleQuery}
        disabled={loading}
        title="Check direct carrier delivery status on ClubKonnect API"
        className="inline-flex items-center gap-1 text-[10px] font-bold py-0.5 px-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
      >
        {loading ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : (
          <RefreshCw className="w-2.5 h-2.5 text-slate-500" />
        )}
        <span>Query Live</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border p-5 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-gray-900">Direct Carrier Query</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            {loading && (
              <div className="py-6 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                <p className="text-xs text-gray-500 font-medium">Checking ClubKonnect API live status...</p>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs flex items-start gap-2 border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Carrier Query Failed</div>
                  <div className="mt-0.5 text-red-600 leading-tight">{error}</div>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-3">
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2.5 font-bold ${
                    result.isSuccessful
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : result.isFailed
                      ? "bg-rose-50 text-rose-800 border border-rose-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  {result.isSuccessful ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : result.isFailed ? (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <div className="text-[13px] leading-tight">
                      {result.isSuccessful
                        ? "Delivered Successfully"
                        : result.isFailed
                        ? "Delivery Failed / Unresponsive"
                        : "Awaiting Carrier Response"}
                    </div>
                    <div className="text-[11px] font-normal opacity-85 mt-0.5">
                      Status Code: <span className="font-mono font-bold">{result.statusCode}</span> ({result.status})
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-gray-500">Carrier Remark:</span>
                    <span className="font-bold text-gray-900">{result.remark || "N/A"}</span>
                  </div>
                  {result.orderId && (
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-gray-500">Carrier Order ID:</span>
                      <span className="font-mono font-bold text-gray-900">{result.orderId}</span>
                    </div>
                  )}
                  {result.mobileNumber && (
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-gray-500">Recipient Phone:</span>
                      <span className="font-mono font-bold text-gray-900">{result.mobileNumber}</span>
                    </div>
                  )}
                  {result.network && (
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-gray-500">Carrier Network:</span>
                      <span className="font-bold text-gray-900">{result.network}</span>
                    </div>
                  )}
                  {typeof result.amountCharged === "number" && (
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500">Wholesale Debited:</span>
                      <span className="font-bold text-emerald-700">₦{result.amountCharged.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    window.location.reload()
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-black transition-colors"
                >
                  Done & Refresh Page
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
