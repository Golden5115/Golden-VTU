"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function SignOutButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    await signOut({ callbackUrl: "/login" })
  }

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleSignOut}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Logging out...
        </>
      ) : (
        "Log Out"
      )}
    </Button>
  )
}
