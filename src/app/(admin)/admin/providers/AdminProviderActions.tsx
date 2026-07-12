"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { updateProviderStatus } from "@/actions/admin.actions"

type ProviderProps = {
  id: string
  status: boolean
}

export function AdminProviderActions({ provider }: { provider: ProviderProps }) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleToggle = async () => {
    setIsUpdating(true)
    try {
      await updateProviderStatus(provider.id, !provider.status)
    } catch (err) {
      alert("Failed to update provider status")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Button 
      variant={provider.status ? "outline" : "default"} 
      size="sm"
      className="w-full"
      onClick={handleToggle}
      disabled={isUpdating}
    >
      {provider.status ? "Disable Provider" : "Enable Provider"}
    </Button>
  )
}
