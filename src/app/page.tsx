import Link from "next/link"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import {
  Smartphone,
  Wifi,
  Server,
  ShieldCheck,
  Zap,
  CreditCard,
  ArrowRight,
  Settings,
  UserCheck,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function Home() {
  const session = await auth()
  let isAdmin = false

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    })
    isAdmin = user?.role === "ADMIN"
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-foreground font-sans">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
              V
            </div>
            <span className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              VTU Pay
            </span>
          </Link>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/data" className="hover:text-blue-600 transition-colors">
              Buy Data
            </Link>
            <Link href="/airtime" className="hover:text-blue-600 transition-colors">
              Buy Airtime
            </Link>
            <Link href="/dashboard" className="hover:text-blue-600 transition-colors">
              User Dashboard
            </Link>
            {isAdmin && (
              <Link
                href="/admin/providers"
                className="flex items-center gap-1.5 text-blue-600 font-semibold hover:underline"
              >
                <Server className="w-4 h-4" />
                Admin Servers
              </Link>
            )}
          </nav>

          {/* Auth / Action Button */}
          <div className="flex items-center gap-3">
            {session?.user ? (
              <div className="flex items-center gap-2">
                <Link href="/dashboard">
                  <Button size="sm" className="font-semibold shadow-sm">
                    Dashboard
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </Link>
                {isAdmin && (
                  <Link href="/admin/dashboard" className="hidden sm:inline-block">
                    <Button size="sm" variant="outline" className="font-medium">
                      Admin Panel
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <Link href="/login">
                <Button size="sm" className="font-semibold shadow-sm">
                  Sign In / Register
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden py-16 sm:py-24 px-4 sm:px-6">
          <div className="container mx-auto max-w-5xl text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Zap className="w-3.5 h-3.5" />
              Multi-Server VTU Routing Enabled (Server 1, Server 2...)
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white max-w-3xl mx-auto leading-tight sm:leading-none">
              Instant Airtime &amp; Cheap SME Data on Your Terms.
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Switch effortlessly between multiple VTU backend servers with live dynamic prices. Enjoy wholesale rates, zero downtime, and instant delivery across MTN, Airtel, Glo, and 9Mobile.
            </p>

            {/* Quick Action Navigation Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link href="/data">
                <Button size="lg" className="h-12 px-6 text-base font-bold shadow-md bg-blue-600 hover:bg-blue-700">
                  <Wifi className="w-5 h-5 mr-2" />
                  Buy Data Bundles
                </Button>
              </Link>

              <Link href="/airtime">
                <Button size="lg" variant="outline" className="h-12 px-6 text-base font-bold border-2">
                  <Smartphone className="w-5 h-5 mr-2 text-blue-600" />
                  Buy Airtime Top-up
                </Button>
              </Link>

              <Link href="/admin/providers">
                <Button size="lg" variant="secondary" className="h-12 px-5 text-sm font-semibold">
                  <Server className="w-4 h-4 mr-2 text-slate-600 dark:text-slate-300" />
                  Manage VTU Servers
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Feature Grid & Direct Navigation Links */}
        <section className="py-12 bg-white dark:bg-zinc-900 border-y">
          <div className="container mx-auto max-w-5xl px-4 sm:px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Everything You Need in One VTU Portal
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Explore key sections and navigate directly to any feature.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1 */}
              <Link
                href="/data"
                className="group p-6 rounded-2xl border bg-slate-50 dark:bg-zinc-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:border-blue-300 transition-all space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <Wifi className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold group-hover:text-blue-600 transition-colors">
                  Data Bundles (/data)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Choose between Server 1 (ClubKonnect), Server 2 (Sandbox), or custom SME servers with live pricing updates.
                </p>
                <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                  Open Data Page <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>

              {/* Card 2 */}
              <Link
                href="/airtime"
                className="group p-6 rounded-2xl border bg-slate-50 dark:bg-zinc-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:border-blue-300 transition-all space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold group-hover:text-emerald-600 transition-colors">
                  Airtime Recharge (/airtime)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Instant airtime recharge with auto-detected phone network verification and multi-server routing.
                </p>
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  Recharge Airtime <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>

              {/* Card 3 */}
              <Link
                href="/wallet/fund"
                className="group p-6 rounded-2xl border bg-slate-50 dark:bg-zinc-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:border-blue-300 transition-all space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold group-hover:text-purple-600 transition-colors">
                  Fund Wallet (/wallet/fund)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Fund your wallet balance securely via Paystack debit card, USSD, or instant bank transfer.
                </p>
                <span className="text-xs font-semibold text-purple-600 flex items-center gap-1">
                  Fund Wallet <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>

              {/* Card 4 */}
              <Link
                href="/transactions"
                className="group p-6 rounded-2xl border bg-slate-50 dark:bg-zinc-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:border-blue-300 transition-all space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold group-hover:text-amber-600 transition-colors">
                  Transaction History (/transactions)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Review all successful, pending, and refunded transactions with real-time status and provider order references.
                </p>
                <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                  View Transactions <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>

              {/* Card 5 */}
              <Link
                href="/admin/providers"
                className="group p-6 rounded-2xl border bg-slate-50 dark:bg-zinc-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:border-blue-300 transition-all space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Server className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold group-hover:text-indigo-600 transition-colors">
                  VTU API Servers (/admin/providers)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Add and connect new VTU provider APIs (ClubKonnect, VTPass, Husmodata), test balances, and toggle servers.
                </p>
                <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
                  Configure Servers <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>

              {/* Card 6 */}
              <Link
                href="/admin/dashboard"
                className="group p-6 rounded-2xl border bg-slate-50 dark:bg-zinc-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 hover:border-blue-300 transition-all space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-sm">
                  <Settings className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold group-hover:text-blue-600 transition-colors">
                  Admin Overview (/admin/dashboard)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Monitor total users, sales volumes, system wallet balances, and live upstream vendor balances.
                </p>
                <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                  Open Admin Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-white dark:bg-zinc-950 text-xs text-muted-foreground">
        <div className="container mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} VTU Pay. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hover:underline">
              User Dashboard
            </Link>
            <Link href="/data" className="hover:underline">
              Buy Data
            </Link>
            <Link href="/airtime" className="hover:underline">
              Buy Airtime
            </Link>
            <Link href="/admin/providers" className="hover:underline">
              Admin Providers
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
