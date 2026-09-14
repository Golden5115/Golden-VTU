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
import { Plus, Server, Check } from "lucide-react"
import { addProvider } from "@/actions/admin.actions"
import { SUPPORTED_PROVIDER_TEMPLATES, ProviderTemplate } from "@/services/providers/provider.constants"

export function AddProviderModal({ nextServerNumber = 2 }: { nextServerNumber?: number }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ProviderTemplate>(
    SUPPORTED_PROVIDER_TEMPLATES[1] // Default to VTPass as top recommendation
  )

  const [formData, setFormData] = useState({
    serverName: `Server ${nextServerNumber} (${SUPPORTED_PROVIDER_TEMPLATES[1].name})`,
    serverCode: `server-${nextServerNumber}`,
    providerName: SUPPORTED_PROVIDER_TEMPLATES[1].name,
    identifier: SUPPORTED_PROVIDER_TEMPLATES[1].identifier,
    baseUrl: SUPPORTED_PROVIDER_TEMPLATES[1].defaultBaseUrl,
    apiKey: "",
    userId: "",
    secretKey: "",
    publicKey: "",
  })

  const handleTemplateSelect = (template: ProviderTemplate) => {
    setSelectedTemplate(template)
    setFormData((prev) => ({
      ...prev,
      providerName: template.name,
      identifier: template.identifier,
      baseUrl: template.defaultBaseUrl,
      serverName: `Server ${nextServerNumber} (${template.name})`,
      serverCode: `server-${nextServerNumber}`,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await addProvider({
        serverName: formData.serverName,
        serverCode: formData.serverCode,
        providerName: formData.providerName,
        identifier: formData.identifier,
        baseUrl: formData.baseUrl,
        apiKey: formData.apiKey || "mock-key",
        userId: formData.userId || undefined,
        secretKey: formData.secretKey || undefined,
        publicKey: formData.publicKey || undefined,
      })
      setIsOpen(false)
      setFormData({
        serverName: "",
        serverCode: "",
        providerName: "",
        identifier: "",
        baseUrl: "",
        apiKey: "",
        userId: "",
        secretKey: "",
        publicKey: "",
      })
    } catch (err: any) {
      console.error("Provider creation error:", err)
      alert("Failed to add provider: " + (err.message || String(err)))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="w-4 h-4 mr-2" />
        Add VTU Server
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Add New VTU API Server
          </DialogTitle>
          <DialogDescription>
            Connect an additional VTU provider API as Server 2, Server 3, etc. Users can switch to this server for different pricing tiers.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Preset Templates */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Select Provider Engine
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_PROVIDER_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate.identifier === tmpl.identifier
                return (
                  <button
                    key={tmpl.identifier}
                    type="button"
                    onClick={() => handleTemplateSelect(tmpl)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all relative ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-foreground">
                      <span>{tmpl.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                      {tmpl.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Server Display Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Server Display Name (Shown to users)</Label>
            <Input
              required
              placeholder="e.g., Server 2 (VTPass Corporate)"
              value={formData.serverName}
              onChange={(e) => setFormData({ ...formData, serverName: e.target.value })}
            />
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">API Base URL</Label>
            <Input
              required
              type="url"
              placeholder="https://api-service.vtpass.com/api"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            />
          </div>

          {/* Provider Specific Credential Fields */}
          {selectedTemplate.requiresUserId && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ClubKonnect User ID</Label>
              <Input
                required
                placeholder="e.g., CK100777437"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{selectedTemplate.apiKeyLabel}</Label>
            <Input
              required={selectedTemplate.requiresApiKey}
              type="password"
              placeholder={selectedTemplate.requiresApiKey ? "Paste API Key / Token" : "Optional for sandbox"}
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            />
          </div>

          {selectedTemplate.requiresSecretKey && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Secret Key (VTPass)</Label>
              <Input
                type="password"
                placeholder="Paste VTPass Secret Key"
                value={formData.secretKey}
                onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
              />
            </div>
          )}

          {selectedTemplate.requiresPublicKey && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Public Key (Optional)</Label>
              <Input
                placeholder="Paste VTPass Public Key"
                value={formData.publicKey}
                onChange={(e) => setFormData({ ...formData, publicKey: e.target.value })}
              />
            </div>
          )}

          <Button type="submit" className="w-full py-5 text-sm font-bold mt-2" disabled={isSubmitting}>
            {isSubmitting ? "Connecting & Saving..." : "Save and Enable Server"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
