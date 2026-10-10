import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowDownLeft, Wifi, Smartphone, CreditCard, AlertCircle } from "lucide-react"
import { LiveStatusButton } from "@/components/vtu/LiveStatusButton"
import { NETWORKS, format12HourDateTime } from "@/lib/phone-utils"

export default async function TransactionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const isAdmin = (session.user as any)?.role === "ADMIN" || session.user?.email?.toLowerCase() === "ayomide.ayoola6866@gmail.com"

  const [walletTxs, airtimeTxs, dataTxs] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.airtimePurchase.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.dataPurchase.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ])

  type UnifiedTx = {
    id: string
    reference: string
    type: "WALLET_CREDIT" | "WALLET_DEBIT" | "AIRTIME" | "DATA"
    label: string
    phone?: string
    networkId?: string
    networkName?: string
    amount: number
    status: string
    isRefunded: boolean
    date: Date
  }

  const unified: UnifiedTx[] = [
    ...walletTxs.map((tx) => ({
      id: tx.id,
      reference: tx.reference,
      type: (tx.type === "CREDIT" ? "WALLET_CREDIT" : "WALLET_DEBIT") as UnifiedTx["type"],
      label: tx.type === "CREDIT" ? "Wallet Deposit / Credit" : "Wallet Debit",
      phone: undefined,
      networkId: undefined,
      networkName: undefined,
      amount: tx.amount,
      status: tx.status,
      isRefunded: tx.status === "FAILED",
      date: tx.createdAt,
    })),
    ...airtimeTxs.map((tx) => ({
      id: tx.id,
      reference: tx.reference,
      type: "AIRTIME" as const,
      label: `Airtime Top-up`,
      phone: tx.phone,
      networkId: tx.network,
      networkName: NETWORKS[tx.network]?.name || tx.network,
      amount: tx.amount,
      status: tx.status,
      isRefunded: tx.status === "FAILED",
      date: tx.createdAt,
    })),
    ...dataTxs.map((tx) => ({
      id: tx.id,
      reference: tx.reference,
      type: "DATA" as const,
      label: `Data Bundle (${tx.plan})`,
      phone: tx.phone,
      networkId: tx.network,
      networkName: NETWORKS[tx.network]?.name || tx.network,
      amount: tx.amount,
      status: tx.status,
      isRefunded: tx.status === "FAILED",
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
          Complete log of your wallet funding, airtime top-ups, and data renewals with network and delivery status
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
                {unified.map((tx) => {
                  const dt = format12HourDateTime(tx.date)
                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-xl border bg-slate-50/60 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {tx.type === "WALLET_CREDIT" ? (
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                              <ArrowDownLeft className="w-4 h-4" />
                            </div>
                          ) : tx.type === "DATA" ? (
                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                              <Wifi className="w-4 h-4" />
                            </div>
                          ) : tx.type === "AIRTIME" ? (
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                              <Smartphone className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                              <CreditCard className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-xs text-gray-900 leading-tight">
                              {tx.label}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {tx.networkName && (
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                    tx.networkId === "01"
                                      ? "bg-amber-100 text-amber-900"
                                      : tx.networkId === "04"
                                      ? "bg-red-100 text-red-900"
                                      : tx.networkId === "02"
                                      ? "bg-emerald-100 text-emerald-900"
                                      : tx.networkId === "03"
                                      ? "bg-teal-100 text-teal-900"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {tx.networkName}
                                </span>
                              )}
                              {tx.phone && (
                                <span className="text-[11px] font-mono font-bold text-gray-700">
                                  {tx.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`font-black text-sm ${
                              tx.type === "WALLET_CREDIT" ? "text-emerald-700" : "text-gray-900"
                            }`}
                          >
                            {tx.type === "WALLET_CREDIT" ? "+" : "-"}₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <div className="flex items-center gap-1.5 justify-end mt-0.5">
                            {tx.status === "SUCCESS" ? (
                              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-800">
                                SUCCESS
                              </span>
                            ) : tx.isRefunded || tx.status === "FAILED" ? (
                              <span
                                className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200"
                                title="Transaction was not completed and funds were refunded"
                              >
                                REFUNDED
                              </span>
                            ) : (
                              <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                PROCESSING
                              </span>
                            )}
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
                        <span className="font-mono truncate max-w-[150px]">{tx.reference}</span>
                        <span className="font-medium text-gray-600">{dt.full}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop Table View (Visible on md and above) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Network</TableHead>
                      <TableHead>Phone / Recipient</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Date & Time (12h)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unified.map((tx) => {
                      const dt = format12HourDateTime(tx.date)
                      return (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                tx.type === "WALLET_CREDIT"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : tx.type === "DATA"
                                  ? "bg-blue-100 text-blue-800"
                                  : tx.type === "AIRTIME"
                                  ? "bg-indigo-100 text-indigo-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {tx.type}
                            </span>
                            <div className="text-[11px] text-gray-600 font-medium mt-0.5 truncate max-w-[180px]">
                              {tx.label}
                            </div>
                          </TableCell>

                          <TableCell>
                            {tx.networkName ? (
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  tx.networkId === "01"
                                    ? "bg-amber-100 text-amber-900 border border-amber-200"
                                    : tx.networkId === "04"
                                    ? "bg-red-100 text-red-900 border border-red-200"
                                    : tx.networkId === "02"
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                                    : tx.networkId === "03"
                                    ? "bg-teal-100 text-teal-900 border border-teal-200"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {tx.networkName}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {tx.phone ? (
                              <span className="font-mono text-xs font-bold text-gray-900">
                                {tx.phone}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </TableCell>

                          <TableCell className="font-mono text-xs text-gray-600">
                            {tx.reference}
                          </TableCell>

                          <TableCell className="font-bold text-xs">
                            {tx.type === "WALLET_CREDIT" ? "+" : "-"}₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {tx.status === "SUCCESS" ? (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
                                  SUCCESS
                                </span>
                              ) : tx.isRefunded || tx.status === "FAILED" ? (
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1"
                                  title="Transaction failed & funds were refunded to your wallet"
                                >
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  <span>REFUNDED</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  PROCESSING
                                </span>
                              )}
                              {isAdmin && (
                                <LiveStatusButton
                                  reference={tx.reference}
                                  currentStatus={tx.status}
                                  isVtuPurchase={tx.type === "DATA" || tx.type === "AIRTIME"}
                                />
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="text-xs font-medium text-gray-900">{dt.dateStr}</div>
                            <div className="text-[11px] font-mono text-gray-500">{dt.timeStr}</div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
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
