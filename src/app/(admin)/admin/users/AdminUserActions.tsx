"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toggleUserSuspension, fundUserWallet } from "@/actions/admin.actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type UserProps = {
  id: string
  name: string | null
  isSuspended: boolean
}

export function AdminUserActions({ user }: { user: UserProps }) {
  const [isFunding, setIsFunding] = useState(false)
  const [amount, setAmount] = useState("")
  const [type, setType] = useState<"CREDIT" | "DEBIT">("CREDIT")
  const [reason, setReason] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const handleToggleSuspend = async () => {
    if (confirm(`Are you sure you want to ${user.isSuspended ? 'unsuspend' : 'suspend'} this user?`)) {
      await toggleUserSuspension(user.id, !user.isSuspended)
    }
  }

  const handleFund = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsFunding(true)
    try {
      await fundUserWallet(user.id, Number(amount), type, reason)
      setIsOpen(false)
      setAmount("")
      setReason("")
    } catch (err) {
      alert("Failed to update wallet")
    } finally {
      setIsFunding(false)
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          Adjust Wallet
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Wallet: {user.name || "User"}</DialogTitle>
            <DialogDescription>
              Manually credit or debit funds from this user's wallet.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFund} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select value={type} onValueChange={(val: "CREDIT" | "DEBIT" | null) => { if (val) setType(val) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREDIT">Add Funds (Credit)</SelectItem>
                  <SelectItem value="DEBIT">Deduct Funds (Debit)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (₦)</Label>
              <Input 
                type="number" 
                required 
                min="1" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Reason / Note</Label>
              <Input 
                type="text" 
                required 
                placeholder="e.g. Refund for failed data" 
                value={reason} 
                onChange={(e) => setReason(e.target.value)} 
              />
            </div>
            <Button type="submit" className="w-full" disabled={isFunding}>
              {isFunding ? "Processing..." : "Confirm Adjustment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Button 
        variant={user.isSuspended ? "default" : "destructive"} 
        size="sm"
        onClick={handleToggleSuspend}
      >
        {user.isSuspended ? "Unsuspend" : "Suspend"}
      </Button>
    </div>
  )
}
