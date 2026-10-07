"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import {
  User,
  Mail,
  Phone,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Zap,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { signUpUser } from "@/actions/auth.actions"

export function SignUpForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Please enter your full name.")
      return
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please provide a valid email address.")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsLoading(true)

    try {
      const res = await signUpUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      })

      if (!res.success) {
        setError(res.error || "Failed to create account.")
        setIsLoading(false)
        return
      }

      setSuccess(true)

      // Auto sign-in with the new credentials
      const signInRes = await signIn("credentials", {
        identifier: email.trim(),
        password,
        redirect: false,
      })

      if (!signInRes?.error) {
        router.push("/dashboard")
        router.refresh()
      } else {
        router.push("/login")
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.")
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8">
      <Card className="border shadow-lg rounded-2xl overflow-hidden bg-white">
        <CardHeader className="text-center pb-4 pt-6">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white shadow-md">
            <Zap className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-black text-gray-900 tracking-tight">
            Create an Account
          </CardTitle>
          <CardDescription className="text-xs text-gray-500 mt-1">
            Join Golden VTU to recharge and troubleshoot tracker SIMs
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>Account created successfully! Logging you in...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Full Name */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-gray-700">Full Name</Label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="e.g. Ayomide Ayoola"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9 text-base md:text-sm py-2.5 font-medium"
                  required
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-gray-700">Email Address</Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-base md:text-sm py-2.5 font-medium"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Phone Number */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold text-gray-700">Phone Number</Label>
                <span className="text-[10px] text-gray-400">Optional</span>
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="tel"
                  placeholder="08031234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-9 text-base md:text-sm py-2.5 font-medium"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-gray-700">Password</Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 text-base md:text-sm py-2.5 font-medium"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-gray-700">Confirm Password</Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 text-base md:text-sm py-2.5 font-medium"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || success}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 text-sm rounded-xl shadow-md transition-all mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {/* Footer Link */}
          <div className="text-center pt-3 border-t">
            <p className="text-xs text-gray-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-bold text-blue-600 hover:text-blue-700 underline inline-flex items-center gap-0.5"
              >
                Sign In Here <ArrowRight className="w-3 h-3" />
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
