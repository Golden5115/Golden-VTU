"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Zap, Wifi, CreditCard, History, Smartphone } from "lucide-react"

export function MobileBottomNav() {
  const pathname = usePathname()

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
    },
    {
      name: "SIM Station",
      href: "/trackers",
      icon: Zap,
      highlight: true,
    },
    {
      name: "Fund Wallet",
      href: "/wallet/fund",
      icon: CreditCard,
    },
    {
      name: "History",
      href: "/transactions",
      icon: History,
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="grid grid-cols-4 h-16 items-center px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 transition-all relative ${
                isActive ? "text-blue-600 font-bold" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {item.highlight ? (
                <div
                  className={`p-1.5 rounded-xl transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md scale-105"
                      : "bg-blue-50 text-blue-600"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                </div>
              ) : (
                <div className={`p-1 rounded-lg ${isActive ? "bg-blue-50" : ""}`}>
                  <item.icon className={`w-5 h-5 ${isActive ? "text-blue-600" : "text-gray-500"}`} />
                </div>
              )}
              <span
                className={`text-[10px] tracking-tight mt-0.5 truncate max-w-[64px] ${
                  isActive ? "font-bold text-blue-600" : "font-medium"
                }`}
              >
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
