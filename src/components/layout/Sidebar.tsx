import { auth } from "@/auth"
import { CtnLogo } from "@/components/ui/CtnLogo"
import { SidebarNav } from "./SidebarNav"

export async function Sidebar() {
  const session = await auth()
  // @ts-ignore
  const isAdmin = session?.user?.role === "ADMIN"

  return (
    <div className="hidden md:flex flex-col w-64 bg-white border-r h-full">
      <div className="p-5 border-b flex items-center">
        <CtnLogo size="sm" subtitle="GPS SIM Station" />
      </div>
      <SidebarNav isAdmin={isAdmin} />
    </div>
  )
}
