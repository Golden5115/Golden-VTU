"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { Plus } from "lucide-react"
import { addProvider } from "@/actions/admin.actions"

export function AddProviderModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    providerName: "",
    baseUrl: "",
    apiKey: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      await addProvider(formData)
      setIsOpen(false)
      setFormData({ providerName: "", baseUrl: "", apiKey: "" })
    } catch (err) {
      alert("Failed to add provider. The name might already exist.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="w-4 h-4 mr-2" />
        Add Provider
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New API Provider</DialogTitle>
          <DialogDescription>
            Add details for a new VTU provider API (e.g. VTPass, SmePlug).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Provider Name</Label>
            <Input 
              required
              placeholder="e.g., VTPass"
              value={formData.providerName}
              onChange={e => setFormData({...formData, providerName: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input 
              required
              type="url"
              placeholder="https://api.vtpass.com/v1"
              value={formData.baseUrl}
              onChange={e => setFormData({...formData, baseUrl: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input 
              required
              type="password"
              placeholder="Your secret API key"
              value={formData.apiKey}
              onChange={e => setFormData({...formData, apiKey: e.target.value})}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Provider"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
