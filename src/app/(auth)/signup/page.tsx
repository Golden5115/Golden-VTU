import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SignUpForm } from "./SignUpForm"

export default async function SignUpPage() {
  const session = await auth()
  if (session?.user) {
    redirect("/dashboard")
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50/60 p-4">
      <SignUpForm />
    </div>
  )
}
