import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SignOutButton } from "@/components/auth/SignOutButton"
import { auth } from "@/auth"
import { Zap } from "lucide-react"
import { MobileNavDrawer } from "./MobileNavDrawer"

export async function Header() {
  const session = await auth()

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white border-b sticky top-0 z-30">
      {/* Mobile Menu & Logo */}
      <div className="flex items-center gap-2 md:hidden">
        <MobileNavDrawer
          user={{
            name: session?.user?.name,
            email: session?.user?.email,
            image: session?.user?.image,
            // @ts-ignore
            role: session?.user?.role,
          }}
        />
        <div className="flex items-center gap-1.5 font-black text-base text-gray-900 tracking-tight">
          <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <span>Golden VTU</span>
        </div>
      </div>

      <div className="hidden md:flex flex-1" />

      {/* User Actions */}
      <div className="flex items-center space-x-2.5 sm:space-x-3">
        <span className="hidden sm:inline text-xs font-semibold text-gray-700">
          {session?.user?.name || "User"}
        </span>
        <Avatar className="w-8 h-8 sm:w-9 sm:h-9 border border-gray-200">
          <AvatarImage src={session?.user?.image || ""} />
          <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
            {session?.user?.name?.[0] || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="hidden sm:block">
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}

