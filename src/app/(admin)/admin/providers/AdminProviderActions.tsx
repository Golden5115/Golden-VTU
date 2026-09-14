"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { updateProviderStatus, deleteProvider, testProviderConnection } from "@/actions/admin.actions"
import { Loader2, RefreshCw, Trash2, CheckCircle2, AlertCircle } from "lucide-react"

type ProviderProps = {
  id: string
  status: boolean
  serverName: string
}

export function AdminProviderActions({ provider }: { provider: ProviderProps }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success?: boolean
    message?: string
  } | null>(null)

  const handleToggle = async () => {
    setIsUpdating(true)
    try {
      await updateProviderStatus(provider.id, !provider.status)
    } catch {
      alert("Failed to update server status")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await testProviderConnection(provider.id)
      setTestResult(res)
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Test failed" })
    } finally {
      setIsTesting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${provider.serverName}?`)) {
      return
    }
    setIsDeleting(true)
    try {
      await deleteProvider(provider.id)
    } catch (err: any) {
      alert("Failed to delete provider: " + err.message)
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-3 pt-2">
      {/* Test Connection Output */}
      {testResult && (
        <div
          className={`p-2.5 rounded-lg text-xs flex items-start gap-2 border ${
            testResult.success
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <span className="break-all">{testResult.message}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={handleTestConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
          )}
          {isTesting ? "Testing..." : "Test Balance"}
        </Button>

        <Button
          variant={provider.status ? "outline" : "default"}
          size="sm"
          className="flex-1 text-xs"
          onClick={handleToggle}
          disabled={isUpdating}
        >
          {isUpdating ? "Updating..." : provider.status ? "Disable" : "Enable"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
          onClick={handleDelete}
          disabled={isDeleting}
          title="Delete Server"
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}
