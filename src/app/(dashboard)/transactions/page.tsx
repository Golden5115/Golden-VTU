import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowDownLeft, Wifi, Smartphone, CreditCard } from "lucide-react"
import { LiveStatusButton } from "@/components/vtu/LiveStatusButton"

export default async function TransactionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const isAdmin = (session.user as any)?.role === "ADMIN" || session.user?.email?.toLowerCase() === "ayomide.ayoola6866@gmail.com"

  const [walletTxs, airtimeTxs, dataTxs] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.airtimePurchase.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.dataPurchase.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ])

  type UnifiedTx = {
    id: string
    reference: string
    type: "WALLET_CREDIT" | "WALLET_DEBIT" | "AIRTIME" | "DATA"
    label: string
    sublabel: string
    amount: number
    status: string
    date: Date
  }

  const unified: UnifiedTx[] = [
    ...walletTxs.map((tx) => ({
      id: tx.id,
      reference: tx.reference,
      type: (tx.type === "CREDIT" ? "WALLET_CREDIT" : "WALLET_DEBIT") as UnifiedTx["type"],
      label: tx.type === "CREDIT" ? "Wallet Top-up" : "Wallet Debit",
      sublabel: `Ref: ${tx.reference.slice(0, 16)}...`,
      amount: tx.amount,
      status: tx.status,
      date: tx.createdAt,
    })),
    ...airtimeTxs.map((tx) => ({
      id: tx.id,
      reference: tx.reference,
      type: "AIRTIME" as const,
      label: `Airtime Top-up`,
      sublabel: `To: ${tx.phone}`,
      amount: tx.amount,
      status: tx.status,
      date: tx.createdAt,
    })),
    ...dataTxs.map((tx) => ({
      id: tx.id,
      reference: tx.reference,
      type: "DATA" as const,
      label: `Data Bundle (${tx.plan})`,
      sublabel: `To: ${tx.phone}`,
      amount: tx.amount,
      status: tx.status,
      date: tx.createdAt,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          Transaction History
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Complete log of your wallet funding, airtime top-ups, and data renewals
        </p>
      </div>

      <Card className="border shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold">All Records</CardTitle>
            <span className="text-xs font-semibold text-gray-500">
              {unified.length} transaction{unified.length === 1 ? "" : "s"}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {unified.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              No transactions recorded yet.
            </div>
          ) : (
            <>
              {/* Mobile Card List View (Visible on phones < 768px) */}
              <div className="space-y-3 md:hidden">
                {unified.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-xl border bg-slate-50/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {tx.type === "WALLET_CREDIT" ? (
                          <div className="w-7 h-7 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                            <ArrowDownLeft className="w-4 h-4" />
                          </div>
                        ) : tx.type === "DATA" ? (
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                            <Wifi className="w-4 h-4" />
                          </div>
                        ) : tx.type === "AIRTIME" ? (
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <Smartphone className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-xs text-gray-900 leading-tight">
                            {tx.label}
                          </div>
                          <div className="text-[11px] text-gray-500 font-mono">
                            {tx.sublabel}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-black text-sm ${
                            tx.type === "WALLET_CREDIT" ? "text-emerald-700" : "text-gray-900"
                          }`}
                        >
                          {tx.type === "WALLET_CREDIT" ? "+" : "-"}₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div className="flex items-center gap-1.5 justify-end">
                          <span
                            className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              tx.status === "SUCCESS"
                                ? "bg-green-100 text-green-800"
                                : tx.status === "FAILED"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {tx.status}
                          </span>
                          {isAdmin && (
                            <LiveStatusButton
                              reference={tx.reference}
                              currentStatus={tx.status}
                              isVtuPurchase={tx.type === "DATA" || tx.type === "AIRTIME"}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-100">
                      <span className="font-mono truncate max-w-[170px]">{tx.reference}</span>
                      <span>{new Date(tx.date).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (Visible on md and above) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unified.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              tx.type === "WALLET_CREDIT"
                                ? "bg-green-100 text-green-800"
                                : tx.type === "DATA"
                                ? "bg-blue-100 text-blue-800"
                                : tx.type === "AIRTIME"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-xs text-gray-900">{tx.label}</div>
                          <div className="text-[11px] text-gray-500 font-mono">{tx.sublabel}</div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-600">
                          {tx.reference}
                        </TableCell>
                        <TableCell className="font-bold text-xs">
                          {tx.type === "WALLET_CREDIT" ? "+" : "-"}₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                tx.status === "SUCCESS"
                                  ? "bg-green-100 text-green-800"
                                  : tx.status === "FAILED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {tx.status}
                            </span>
                            {isAdmin && (
                              <LiveStatusButton
                                reference={tx.reference}
                                currentStatus={tx.status}
                                isVtuPurchase={tx.type === "DATA" || tx.type === "AIRTIME"}
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs text-gray-500">
                          {new Date(tx.date).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
