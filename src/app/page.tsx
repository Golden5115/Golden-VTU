import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // @ts-ignore
  if (session.user.role === "ADMIN") {
    redirect("/admin/dashboard")
  }

  redirect("/dashboard")
}
