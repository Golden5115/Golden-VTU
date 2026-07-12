import Link from "next/link"
import { Home, Users, History, Settings, LogOut, ArrowLeft } from "lucide-react"

export function AdminSidebar() {
  const links = [
    { name: "Admin Dashboard", href: "/admin/dashboard", icon: Home },
    { name: "Manage Users", href: "/admin/users", icon: Users },
    { name: "All Transactions", href: "/admin/transactions", icon: History },
    { name: "Providers", href: "/admin/providers", icon: Settings },
  ]

  return (
    <div className="hidden md:flex flex-col w-64 bg-slate-900 text-white border-r border-slate-800 h-full">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-blue-400">VTU Admin</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => (
          <Link
            key={link.name}
            href={link.href}
            className="flex items-center px-4 py-3 text-sm font-medium text-slate-300 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
          >
            <link.icon className="w-5 h-5 mr-3" />
            {link.name}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <Link
          href="/dashboard"
          className="flex items-center px-4 py-3 text-sm font-medium text-slate-300 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-3" />
          Exit Admin
        </Link>
      </div>
    </div>
  )
}
