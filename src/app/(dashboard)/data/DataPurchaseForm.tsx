"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { ClubKonnectDataPlan } from "@/services/clubkonnect.service"

interface DataPurchaseFormProps {
  plans: ClubKonnectDataPlan[]
  buyDataAction: (formData: FormData) => Promise<void>
}

export function DataPurchaseForm({ plans, buyDataAction }: DataPurchaseFormProps) {
  const [selectedNetwork, setSelectedNetwork] = useState("01") // Default to MTN
  const [selectedPlan, setSelectedPlan] = useState<ClubKonnectDataPlan | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Filter plans by selected network
  const filteredPlans = plans.filter((p) => p.network === selectedNetwork)

  const handleSubmit = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      try {
        await buyDataAction(formData)
      } catch (e: any) {
        setError(e.message || "Something went wrong")
      }
    })
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <Card>
        <CardHeader>
          <CardTitle>Buy Data</CardTitle>
          <CardDescription>Select your network and data plan for instant delivery.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            {/* Network Selection */}
            <div className="space-y-2">
              <Label htmlFor="network">Network</Label>
              <select
                name="network"
                id="network"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                required
                value={selectedNetwork}
                onChange={(e) => {
                  setSelectedNetwork(e.target.value)
                  setSelectedPlan(null) // Reset plan when network changes
                }}
              >
                <option value="01">MTN</option>
                <option value="04">Airtel</option>
                <option value="02">Glo</option>
                <option value="03">9Mobile</option>
              </select>
            </div>

            {/* Data Plan Selection */}
            <div className="space-y-2">
              <Label htmlFor="plan">Data Plan</Label>
              {filteredPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No plans available for this network.</p>
              ) : (
                <select
                  name="plan"
                  id="plan"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                  required
                  value={selectedPlan?.id || ""}
                  onChange={(e) => {
                    const plan = filteredPlans.find((p) => p.id === e.target.value)
                    setSelectedPlan(plan || null)
                  }}
                >
                  <option value="" disabled>Select a data plan</option>
                  {filteredPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — ₦{plan.price.toLocaleString()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Hidden field for amount */}
            <input type="hidden" name="amount" value={selectedPlan?.price || 0} />

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" name="phone" type="tel" placeholder="08012345678" required />
            </div>

            {/* Price Display */}
            {selectedPlan && (
              <div className="p-3 bg-blue-50 rounded-md text-sm text-blue-800 border border-blue-200">
                <strong>Price:</strong> ₦{selectedPlan.price.toLocaleString()}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending || !selectedPlan}>
              {isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                "Buy Data"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
