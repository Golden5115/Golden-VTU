import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SignOutButton } from "@/components/auth/SignOutButton"
import { auth } from "@/auth"

export async function Header() {
  const session = await auth()
  
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b">
      <div className="flex items-center md:hidden">
        <h1 className="text-xl font-bold text-blue-600">VTU Pay</h1>
      </div>
      <div className="flex-1" />
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium text-gray-700">
          Welcome, {session?.user?.name || "User"}
        </span>
        <Avatar>
          <AvatarImage src={session?.user?.image || ""} />
          <AvatarFallback>{session?.user?.name?.[0] || "U"}</AvatarFallback>
        </Avatar>
        <SignOutButton />
      </div>
    </header>
  )
}
