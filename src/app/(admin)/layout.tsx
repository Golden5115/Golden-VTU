import { ReactNode } from "react"
import { AdminSidebar } from "@/components/layout/AdminSidebar"
import { Header } from "@/components/layout/Header"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  
  if (!session?.user?.email) {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  })

  if (user?.role !== "ADMIN") {
    redirect("/dashboard")
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
