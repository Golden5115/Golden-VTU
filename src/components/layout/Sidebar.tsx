import Link from "next/link"
import { Home, CreditCard, Wifi, Smartphone, History, Settings, Zap, Shield } from "lucide-react"
import { auth } from "@/auth"

import { CtnLogo } from "@/components/ui/CtnLogo"

export async function Sidebar() {
  const session = await auth()
  // @ts-ignore
  const isAdmin = session?.user?.role === "ADMIN"

  const links = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Tracker SIM Station", href: "/trackers", icon: Zap },
    { name: "Fund Wallet", href: "/wallet/fund", icon: CreditCard },
    { name: "Buy Airtime", href: "/airtime", icon: Smartphone },
    { name: "Buy Data", href: "/data", icon: Wifi },
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
    <div className="hidden md:flex flex-col w-64 bg-white border-r h-full">
      <div className="p-5 border-b flex items-center">
        <CtnLogo size="sm" subtitle="GPS SIM Station" />
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const isSpecialAdmin = link.name === "Admin Control Panel"
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isSpecialAdmin
                  ? "text-blue-700 bg-blue-50/80 hover:bg-blue-100 font-bold border border-blue-200/60 my-1.5"
                  : "text-gray-700 hover:bg-gray-100 hover:text-blue-600"
              }`}
            >
              <link.icon className={`w-5 h-5 mr-3 ${isSpecialAdmin ? "text-blue-600" : ""}`} />
              <span className="flex-1">{link.name}</span>
              {isSpecialAdmin && (
                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-blue-600 text-white">
                  Admin
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
