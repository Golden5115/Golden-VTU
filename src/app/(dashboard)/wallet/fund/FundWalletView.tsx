"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CreditCard,
  Building2,
  Zap,
  CheckCircle2,
  Copy,
  AlertTriangle,
  Loader2,
  HelpCircle,
  ShieldCheck,
  Server,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { adminSelfCredit, startPaystackFunding, verifyAutomatedDeposit } from "@/actions/wallet.actions"

interface FundWalletViewProps {
  walletBalance: number
  userEmail: string
  userRole: string
  virtualBankName?: string
  virtualAccountNo?: string
  virtualAccountName?: string
}

export function FundWalletView({
  walletBalance: initialBalance,
  userEmail,
  userRole,
  virtualBankName = "MONIEPOINT MICROFINANCE BANK",
  virtualAccountNo = "6990056172",
  virtualAccountName = "NELLOBYTE-AYOMIDE ABIODUN AYOOLA",
}: FundWalletViewProps) {
  const router = useRouter()
  const [balance, setBalance] = useState(initialBalance)
  const [activeTab, setActiveTab] = useState<"automated" | "admin" | "transfer" | "paystack">(
    "automated"
  )

  // Automated Deposit Verification state
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyFeedback, setVerifyFeedback] = useState<string | null>(null)

  // Admin Instant Credit State
  const [adminAmount, setAdminAmount] = useState("10000")
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false)
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null)

  // Paystack State
  const [paystackAmount, setPaystackAmount] = useState("5000")
  const [isPaystackSubmitting, setIsPaystackSubmitting] = useState(false)
  const [paystackError, setPaystackError] = useState<string | null>(null)

  // Copy feedback
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Handle Admin Instant Credit
  const handleAdminCredit = async () => {
    const amt = parseFloat(adminAmount)
    if (!amt || amt <= 0) return

    setIsAdminSubmitting(true)
    setAdminFeedback(null)
    try {
      await adminSelfCredit(amt, "Admin quick wallet recharge")
      setBalance((prev) => prev + amt)
      setAdminFeedback(`Successfully credited ₦${amt.toLocaleString()} to your wallet!`)
      router.refresh()
    } catch (e: any) {
      setAdminFeedback(`Failed: ${e.message}`)
    } finally {
      setIsAdminSubmitting(false)
    }
  }

  // Handle Paystack Checkout
  const handlePaystackPay = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(paystackAmount)
    if (!amt || amt < 100) {
      setPaystackError("Minimum funding amount is ₦100")
      return
    }

    setIsPaystackSubmitting(true)
    setPaystackError(null)
    try {
      const res = await startPaystackFunding(amt)
      if (res?.authorization_url) {
        window.location.href = res.authorization_url
      } else {
        throw new Error("Could not initialize Paystack payment")
      }
    } catch (e: any) {
      setPaystackError(e.message || "Failed to initialize payment")
      setIsPaystackSubmitting(false)
    }
  }

  // Handle Automated Deposit Verification
  const handleVerifyDeposit = async (forceFullSync: boolean = false) => {
    setIsVerifying(true)
    setVerifyFeedback(null)
    try {
      const res = await verifyAutomatedDeposit(forceFullSync)
      if (res?.success) {
        if (typeof res.balance === "number") {
          setBalance(res.balance)
        }
        setVerifyFeedback(res.message || "Deposit verified successfully!")
        router.refresh()
      } else {
        setVerifyFeedback(res?.error || "Failed to verify deposit.")
      }
    } catch (e: any) {
      setVerifyFeedback(e.message || "Failed to verify deposit.")
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Fund Wallet</h1>
        <p className="text-sm text-gray-500 mt-1">
          Add funds to your wallet to recharge tracker SIMs with airtime and high-speed data.
        </p>
      </div>

      {/* Balance Banner with Automated Deposit Verification */}
      <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border border-blue-200 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-900">
              Current Available Balance
            </span>
            <div className="text-3xl font-black text-blue-700 mt-0.5">
              ₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => handleVerifyDeposit(false)}
              disabled={isVerifying}
              variant="outline"
              size="sm"
              className="bg-white hover:bg-blue-50 text-blue-700 border-blue-300 shadow-xs font-semibold text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isVerifying ? "animate-spin text-blue-600" : ""}`} />
              {isVerifying ? "Verifying Deposit..." : "Verify Bank Deposit"}
            </Button>
          </div>
        </div>

        {verifyFeedback && (
          <div
            className={`p-2.5 rounded-lg text-xs font-medium flex items-center justify-between ${
              verifyFeedback.includes("confirmed") ||
              verifyFeedback.includes("credited") ||
              verifyFeedback.includes("initialized") ||
              verifyFeedback.includes("completed")
                ? "bg-green-100/80 text-green-800 border border-green-300"
                : "bg-amber-100/80 text-amber-900 border border-amber-300"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>{verifyFeedback}</span>
            </div>
            <button onClick={() => setVerifyFeedback(null)} className="underline text-[11px] ml-2">
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="grid grid-cols-2 sm:flex p-1 bg-gray-100 rounded-xl gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("automated")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "automated"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-blue-600" />
          Virtual Bank Account
        </button>
        {userRole === "ADMIN" && (
          <button
            type="button"
            onClick={() => setActiveTab("admin")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "admin"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Admin Top-up
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab("transfer")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "transfer"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
          Manual Transfer
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("paystack")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "paystack"
              ? "bg-white text-blue-700 shadow-xs"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
          Paystack (Test)
        </button>
      </div>

      {/* TAB 0: AUTOMATED DEDICATED VIRTUAL ACCOUNT DEPOSIT */}
      {activeTab === "automated" && (
        <Card className="border-2 border-emerald-300 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-900">
                <Building2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Dedicated Virtual Bank Account</span>
              </CardTitle>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 w-fit">
                INSTANT AUTOMATED DEPOSIT &bull; 24/7
              </span>
            </div>
            <CardDescription className="text-xs">
              Transfer funds from any Nigerian bank app or USSD (OPay, PalmPay, GTBank, Kuda, Zenith, etc.) to your dedicated virtual account below. Once transferred, click &quot;Verify Bank Deposit&quot; and your funds reflect immediately!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-50 border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs border-b pb-2">
                <span className="text-gray-500 font-medium">Bank Name</span>
                <span className="font-bold text-gray-900">{virtualBankName}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b pb-2">
                <span className="text-gray-500 font-medium">Virtual Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-gray-900">{virtualAccountNo}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(virtualAccountNo, "vk")}
                    className="p-1 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copiedField === "vk" && <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Account Name</span>
                <span className="font-semibold text-gray-900">{virtualAccountName}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 gap-3">
              <div className="space-y-0.5">
                <span className="font-bold block">Transferred Already?</span>
                <span className="text-[11px] opacity-90">
                  Click the button to confirm your incoming transfer and credit your wallet balance immediately.
                </span>
              </div>
              <Button
                type="button"
                onClick={() => handleVerifyDeposit(false)}
                disabled={isVerifying}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isVerifying ? "animate-spin" : ""}`} />
                {isVerifying ? "Verifying..." : "Verify Bank Deposit Now"}
              </Button>
            </div>

            {/* Admin Baseline Tools */}
            {userRole === "ADMIN" && (
              <div className="pt-2 border-t flex items-center justify-between text-[11px] text-gray-400">
                <span>Admin Diagnostics</span>
                <button
                  type="button"
                  onClick={() => handleVerifyDeposit(true)}
                  disabled={isVerifying}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Sync Full Gateway Baseline
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 1: ADMIN INSTANT CREDIT */}
      {activeTab === "admin" && userRole === "ADMIN" && (
        <Card className="border-2 border-blue-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                Admin Instant Wallet Credit
              </CardTitle>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                ZERO GATEWAY FEES
              </span>
            </div>
            <CardDescription className="text-xs">
              As the Administrator, you can instantly credit your wallet here with any amount to test or operate the tracker recharge station.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {adminFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  adminFeedback.startsWith("Success")
                    ? "bg-green-50 border border-green-200 text-green-800"
                    : "bg-red-50 border border-red-200 text-red-800"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span>{adminFeedback}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-amount" className="text-xs font-semibold text-gray-700">
                Amount to Credit (₦)
              </Label>
              <Input
                id="admin-amount"
                type="number"
                min="100"
                step="100"
                value={adminAmount}
                onChange={(e) => setAdminAmount(e.target.value)}
                className="font-mono text-lg font-bold"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex flex-wrap gap-2">
              {[2000, 5000, 10000, 20000, 50000].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => setAdminAmount(quick.toString())}
                  className={`text-xs px-3 py-1 rounded-lg border font-semibold transition-colors ${
                    adminAmount === quick.toString()
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
                  }`}
                >
                  ₦{quick.toLocaleString()}
                </button>
              ))}
            </div>

            <Button
              type="button"
              onClick={handleAdminCredit}
              disabled={isAdminSubmitting || !adminAmount}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5"
            >
              {isAdminSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Crediting Wallet...
                </>
              ) : (
                `Credit ₦${Number(adminAmount || 0).toLocaleString()} Instantly`
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: MANUAL BANK TRANSFER */}
      {activeTab === "transfer" && (
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Direct Bank Transfer
            </CardTitle>
            <CardDescription className="text-xs">
              Transfer funds from any Nigerian banking app or USSD to the dedicated account below. Your wallet will be credited upon receipt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-50 border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs border-b pb-2">
                <span className="text-gray-500 font-medium">Bank Name</span>
                <span className="font-bold text-gray-900">{virtualBankName}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-b pb-2">
                <span className="text-gray-500 font-medium">Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-gray-900">{virtualAccountNo}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(virtualAccountNo, "acc")}
                    className="p-1 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {copiedField === "acc" && <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs border-b pb-2">
                <span className="text-gray-500 font-medium">Account Name</span>
                <span className="font-semibold text-gray-900">{virtualAccountName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Payment Reference</span>
                <span className="font-mono font-bold text-blue-700">{userEmail}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Important Payment Note
              </div>
              <p className="opacity-90 leading-relaxed">
                Always include your email (<code>{userEmail}</code>) as the payment description/narration so our system can automatically identify your payment.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: PAYSTACK GATEWAY (SANDBOX / TEST MODE NOTICE) */}
      {activeTab === "paystack" && (
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                Paystack Payment Gateway
              </CardTitle>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                SANDBOX / TEST MODE
              </span>
            </div>
            <CardDescription className="text-xs">
              Automated card, USSD, and bank transfer payments via Paystack.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-blue-800">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                Paystack Account Activation Status
              </div>
              <p className="opacity-90 leading-relaxed">
                Your Paystack account is currently in <strong>Test Mode</strong> pending activation of your business documents by Paystack. Real cards cannot be charged yet, but you can test the full automated flow using Paystack's official test credentials:
              </p>
              <div className="bg-white/80 p-2.5 rounded-lg border border-blue-200/60 font-mono text-[11px] space-y-0.5 text-gray-800">
                <div>Test Card: <strong>4084 0840 0840 0840</strong></div>
                <div>Expiry: <strong>12/30</strong> | CVV: <strong>408</strong> | OTP: <strong>123456</strong></div>
              </div>
            </div>

            {paystackError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                {paystackError}
              </div>
            )}

            <form onSubmit={handlePaystackPay} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paystack-amount" className="text-xs font-semibold text-gray-700">
                  Amount to Fund (₦)
                </Label>
                <Input
                  id="paystack-amount"
                  type="number"
                  min="100"
                  step="100"
                  value={paystackAmount}
                  onChange={(e) => setPaystackAmount(e.target.value)}
                  className="font-mono text-base font-semibold"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={isPaystackSubmitting || !paystackAmount}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5"
              >
                {isPaystackSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Connecting to Paystack...
                  </>
                ) : (
                  `Proceed to Paystack (₦${Number(paystackAmount || 0).toLocaleString()})`
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Admin Delivery Notice */}
      {userRole === "ADMIN" && (
        <Card className="border bg-slate-50/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600 shrink-0" />
              <h3 className="text-xs font-bold text-gray-900">
                Admin Diagnostic: Telecom Gateway Status
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              When users recharge tracker SIMs, orders are automatically routed via your dedicated enterprise telecom gateway. Funds transferred to the virtual account replenish your gateway balance, and your ₦100 profit markup per data bundle is automatically retained.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
