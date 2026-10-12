"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Zap, CreditCard, History, Shield, Settings, Loader2 } from "lucide-react"

interface SidebarNavProps {
  isAdmin: boolean
}

export function SidebarNav({ isAdmin }: SidebarNavProps) {
  const pathname = usePathname()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  const links = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Tracker SIM Station", href: "/trackers", icon: Zap },
    { name: "Fund Wallet", href: "/wallet/fund", icon: CreditCard },
    { name: "Transactions", href: "/transactions", icon: History },
  ]

  if (isAdmin) {
    links.push({
      name: "Admin Control Panel",
      href: "/admin/dashboard",
      icon: Shield,
    })
  }

  links.push({ name: "Settings", href: "/settings", icon: Settings })

  return (
    <nav className="flex-1 p-4 space-y-1">
      {links.map((link) => {
        const isSpecialAdmin = link.name === "Admin Control Panel"
        const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href))
        const isPending = pendingHref === link.href

        return (
          <Link
            key={link.name}
            href={link.href}
            onClick={() => {
              if (!isActive) {
                setPendingHref(link.href)
              }
            }}
            className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all ${
              isActive
                ? "bg-blue-50 text-blue-700 font-bold shadow-xs border border-blue-200/50"
                : isSpecialAdmin
                ? "text-blue-700 bg-blue-50/80 hover:bg-blue-100 font-bold border border-blue-200/60 my-1.5"
                : "text-gray-700 hover:bg-gray-100 hover:text-blue-600"
            }`}
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 mr-3 animate-spin text-blue-600 shrink-0" />
            ) : (
              <link.icon
                className={`w-5 h-5 mr-3 shrink-0 ${
                  isActive || isSpecialAdmin ? "text-blue-600" : "text-gray-500"
                }`}
              />
            )}
            <span className="flex-1 truncate">{link.name}</span>
            {isPending && (
              <span className="text-[10px] text-blue-600 font-semibold animate-pulse">
                Loading...
              </span>
            )}
            {isSpecialAdmin && !isPending && (
              <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-blue-600 text-white">
                Admin
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
