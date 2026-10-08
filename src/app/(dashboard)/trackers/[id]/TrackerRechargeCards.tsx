"use client"

import { useState } from "react"
import { Wifi, Smartphone, CheckCircle2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { rechargeTrackerData, rechargeTrackerAirtime } from "@/actions/tracker.actions"

interface TrackerRechargeCardsProps {
  trackerId: string
  plateNumber: string
  vehicleName: string
  simNumber: string
  network: string
  walletBalance: number
  servers: any[]
  availablePlans: any[]
}

export function TrackerRechargeCards({
  trackerId,
  plateNumber,
  simNumber,
  network,
  walletBalance,
  servers,
  availablePlans,
}: TrackerRechargeCardsProps) {
  const [dataLoading, setDataLoading] = useState(false)
  const [airtimeLoading, setAirtimeLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const networkPlans = availablePlans.filter((p) => p.network === network)

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline ml-4 hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Direct Data Top-up */}
        <Card className="border-blue-200 bg-gradient-to-b from-blue-50/30 to-white shadow-xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base text-gray-900">Direct Data Bundle Top-up</CardTitle>
                <CardDescription className="text-xs">
                  Sends GPRS data to SIM <span className="font-mono font-semibold">{simNumber}</span> & auto-calculates 30-day expiry
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setDataLoading(true)
                setFeedback(null)
                const fd = new FormData(e.currentTarget)
                const planValue = fd.get("plan") as string
                if (!planValue) {
                  setFeedback({ type: "error", message: "Please select a data plan." })
                  setDataLoading(false)
                  return
                }

                const [planId, priceStr, planName, validityStr] = planValue.split("::")
                const amount = parseFloat(priceStr)
                const validity = parseInt(validityStr) || 30
                const serverId = (fd.get("serverId") as string) || undefined

                try {
                  await rechargeTrackerData(trackerId, planId, amount, planName, validity, serverId)
                  setFeedback({
                    type: "success",
                    message: `Successfully loaded ${planName} onto ${plateNumber}! Data expiry updated.`,
                  })
                  window.location.reload()
                } catch (err: any) {
                  setFeedback({ type: "error", message: err.message })
                } finally {
                  setDataLoading(false)
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-gray-700">Choose Tracker Bundle</label>
                <select
                  name="plan"
                  required
                  className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-white"
                >
                  <option value="">-- Select Data Plan --</option>
                  {networkPlans.map((p) => {
                    const hasDuration = /day|month|week|daily|weekly|monthly|\(\d+/i.test(p.name)
                    const validityLabel = !hasDuration && p.validity ? ` (${p.validity})` : ""
                    return (
                      <option key={p.id} value={`${p.id}::${p.price}::${p.name}::30`}>
                        {p.name} — ₦{p.price.toLocaleString()}{validityLabel}
                      </option>
                    )
                  })}
                  {networkPlans.length === 0 && (
                    <>
                      <option value="8::280::1.0GB SME (30 Days)::30">1.0GB — ₦280 (Recommended for Trackers, 30 Days)</option>
                      <option value="7::145::500MB SME (30 Days)::30">500MB — ₦145 (Budget Plan, 30 Days)</option>
                      <option value="9::560::2.0GB SME (30 Days)::30">2.0GB — ₦560 (30 Days)</option>
                    </>
                  )}
                </select>
              </div>

              {servers && servers.length > 1 && (
                <div>
                  <label className="text-xs font-semibold text-gray-700">Dispensing Server</label>
                  <select
                    name="serverId"
                    defaultValue={servers[0]?.id}
                    className="w-full border rounded-md px-3 py-2 text-xs mt-1 bg-white"
                  >
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.serverName} ({s.providerName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-gray-500">
                  Wallet: <span className="font-bold text-gray-800">₦{walletBalance.toLocaleString()}</span>
                </span>
                <Button
                  type="submit"
                  disabled={dataLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                  {dataLoading ? "Processing..." : "Recharge Data & Renew"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Card 2: Direct Airtime Top-up */}
        <Card className="border-indigo-200 bg-gradient-to-b from-indigo-50/30 to-white shadow-xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base text-gray-900">Direct Airtime Top-up</CardTitle>
                <CardDescription className="text-xs">
                  Loads credit on <span className="font-mono font-semibold">{simNumber}</span> for SMS alerts & cut-off commands
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setAirtimeLoading(true)
                setFeedback(null)
                const fd = new FormData(e.currentTarget)
                const amount = parseFloat(fd.get("amount") as string)
                const serverId = (fd.get("serverId") as string) || undefined

                try {
                  await rechargeTrackerAirtime(trackerId, amount, serverId)
                  setFeedback({
                    type: "success",
                    message: `Successfully loaded ₦${amount.toLocaleString()} airtime to ${plateNumber}!`,
                  })
                  window.location.reload()
                } catch (err: any) {
                  setFeedback({ type: "error", message: err.message })
                } finally {
                  setAirtimeLoading(false)
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-gray-700">Airtime Amount (₦)</label>
                <Input
                  name="amount"
                  type="number"
                  min="50"
                  step="50"
                  defaultValue="200"
                  required
                  className="mt-1"
                />
                <div className="flex gap-2 mt-2">
                  {[100, 200, 500, 1000].map((quickAmt) => (
                    <button
                      key={quickAmt}
                      type="button"
                      onClick={(e) => {
                        const input = e.currentTarget.form?.querySelector('input[name="amount"]') as HTMLInputElement
                        if (input) input.value = quickAmt.toString()
                      }}
                      className="px-2.5 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                    >
                      ₦{quickAmt}
                    </button>
                  ))}
                </div>
              </div>

              {servers && servers.length > 1 && (
                <div>
                  <label className="text-xs font-semibold text-gray-700">Dispensing Server</label>
                  <select
                    name="serverId"
                    defaultValue={servers[0]?.id}
                    className="w-full border rounded-md px-3 py-2 text-xs mt-1 bg-white"
                  >
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.serverName} ({s.providerName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-gray-500">
                  Wallet: <span className="font-bold text-gray-800">₦{walletBalance.toLocaleString()}</span>
                </span>
                <Button
                  type="submit"
                  disabled={airtimeLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                >
                  {airtimeLoading ? "Dispensing..." : "Recharge Airtime"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
