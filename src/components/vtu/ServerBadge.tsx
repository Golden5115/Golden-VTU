import React from "react"
import { Server } from "lucide-react"

export interface ServerBadgeProps {
  serverName?: string | null
  provider?: string | null
  className?: string
  showIcon?: boolean
  size?: "sm" | "md"
}

export function parseServerDetails(serverName?: string | null, provider?: string | null): {
  label: string
  subLabel?: string
  colorClass: string
} {
  const sName = (serverName || "").trim().toLowerCase()
  const pName = (provider || "").trim().toUpperCase()

  if (sName.includes("server 1") || sName.includes("server-1") || pName === "CLUBKONNECT") {
    return {
      label: "Server 1",
      subLabel: "ClubKonnect",
      colorClass: "bg-amber-50 text-amber-800 border-amber-200/90",
    }
  }

  if (sName.includes("server 2") || sName.includes("server-2") || pName === "PAIRGATE") {
    return {
      label: "Server 2",
      subLabel: "Pairgate",
      colorClass: "bg-purple-50 text-purple-800 border-purple-200/90",
    }
  }

  if (sName.includes("server 3") || sName.includes("server-3")) {
    return {
      label: "Server 3",
      subLabel: "Pairgate",
      colorClass: "bg-sky-50 text-sky-800 border-sky-200/90",
    }
  }

  if (sName.includes("server 4") || sName.includes("server-4")) {
    return {
      label: "Server 4",
      subLabel: "Backup",
      colorClass: "bg-teal-50 text-teal-800 border-teal-200/90",
    }
  }

  if (serverName) {
    return {
      label: serverName,
      colorClass: "bg-blue-50 text-blue-800 border-blue-200/90",
    }
  }

  if (provider) {
    return {
      label: provider,
      colorClass: "bg-indigo-50 text-indigo-800 border-indigo-200/90",
    }
  }

  return {
    label: "Server 1",
    subLabel: "Default",
    colorClass: "bg-slate-50 text-slate-700 border-slate-200",
  }
}

export function ServerBadge({
  serverName,
  provider,
  className = "",
  showIcon = false,
  size = "md",
}: ServerBadgeProps) {
  const details = parseServerDetails(serverName, provider)
  const isSm = size === "sm"

  return (
    <span
      className={`inline-flex items-center gap-1 ${
        isSm ? "px-1.5 py-0.2 text-[10px]" : "px-2 py-0.5 text-[11px]"
      } rounded font-bold border tracking-tight shrink-0 ${details.colorClass} ${className}`}
      title={details.subLabel ? `${details.label} (${details.subLabel})` : details.label}
    >
      {showIcon && <Server className={`${isSm ? "w-2.5 h-2.5" : "w-3 h-3"} opacity-70 shrink-0`} />}
      <span>{details.label}</span>
      {details.subLabel && (
        <span className={`${isSm ? "text-[8px]" : "text-[9px]"} font-semibold opacity-75 hidden sm:inline`}>
          • {details.subLabel}
        </span>
      )}
    </span>
  )
}
