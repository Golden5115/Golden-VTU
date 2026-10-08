"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Menu,
  X,
  Home,
  Zap,
  Smartphone,
  Wifi,
  CreditCard,
  History,
  Shield,
  Settings,
  LogOut,
  ChevronRight,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CtnLogo } from "@/components/ui/CtnLogo"

interface MobileNavDrawerProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string | null
  }
}

export function MobileNavDrawer({ user }: MobileNavDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const links = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Tracker SIM Station", href: "/trackers", icon: Zap, badge: "GPS Tool" },
    { name: "Buy Airtime", href: "/airtime", icon: Smartphone },
    { name: "Buy Data Bundle", href: "/data", icon: Wifi },
    { name: "Fund Wallet", href: "/wallet/fund", icon: CreditCard },
    { name: "Transaction History", href: "/transactions", icon: History },
  ]

  if (user?.role === "ADMIN") {
    links.push({
      name: "Admin Control Panel",
      href: "/admin/dashboard",
      icon: Shield,
      badge: "Admin",
    })
  }

  links.push({ name: "Settings", href: "/settings", icon: Settings })

  return (
    <>
      {/* Hamburger Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-2 -ml-1 text-gray-700 hover:text-blue-600 hover:bg-gray-100 rounded-xl md:hidden transition-colors"
        aria-label="Open mobile menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Drawer */}
      <div
        className={`fixed top-0 bottom-0 left-0 w-[290px] max-w-[85vw] z-50 bg-white shadow-2xl flex flex-col md:hidden transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b flex items-center justify-between bg-slate-50">
          <CtnLogo size="sm" subtitle="GPS SIM Station" />
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Card */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-white shadow-xs">
            <AvatarImage src={user?.image || ""} />
            <AvatarFallback className="bg-blue-600 text-white font-bold text-sm">
              {user?.name?.[0] || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs text-gray-900 truncate">{user?.name || "User"}</p>
            <p className="text-[11px] text-gray-500 truncate">{user?.email || ""}</p>
            {user?.role === "ADMIN" && (
              <span className="inline-block mt-0.5 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-600 text-white">
                Admin
              </span>
            )}
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-3 overflow-y-auto space-y-1">
          {links.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href))
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-bold"
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <link.icon
                    className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-500"}`}
                  />
                  <span>{link.name}</span>
                </div>
                {link.badge ? (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                    {link.badge}
                  </span>
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Drawer Footer / Sign Out */}
        <div className="p-3 border-t bg-slate-50">
          <button
            type="button"
            onClick={async () => {
              setIsOpen(false)
              try {
                await signOut({ redirect: false })
              } catch {}
              window.location.href = "/login"
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out of Account
          </button>
        </div>
      </div>
    </>
  )
}
