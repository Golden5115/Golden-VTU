import Link from "next/link"
import { Home, CreditCard, Wifi, Smartphone, History, Settings } from "lucide-react"

export function Sidebar() {
  const links = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Fund Wallet", href: "/wallet/fund", icon: CreditCard },
    { name: "Buy Airtime", href: "/airtime", icon: Smartphone },
    { name: "Buy Data", href: "/data", icon: Wifi },
    { name: "Transactions", href: "/transactions", icon: History },
    { name: "Settings", href: "/settings", icon: Settings },
  ]

  return (
    <div className="hidden md:flex flex-col w-64 bg-white border-r h-full">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-blue-600">VTU Pay</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => (
          <Link
            key={link.name}
            href={link.href}
            className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-blue-600"
          >
            <link.icon className="w-5 h-5 mr-3" />
            {link.name}
          </Link>
        ))}
      </nav>
    </div>
  )
}
