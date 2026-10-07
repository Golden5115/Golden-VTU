import { ReactNode } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import { MobileBottomNav } from "@/components/layout/MobileBottomNav"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 lg:p-8 pb-24 md:pb-8">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
