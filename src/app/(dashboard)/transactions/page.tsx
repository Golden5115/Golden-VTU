import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { NETWORKS } from "@/lib/phone-utils"
import { reconcilePendingTransactions } from "@/services/vtu.service"
import { TransactionsView, UnifiedTx } from "./TransactionsView"

export default async function TransactionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const isAdmin =
    (session.user as any)?.role === "ADMIN" ||
    session.user?.email?.toLowerCase() === "ayomide.ayoola6866@gmail.com"

  // Automatically reconcile any pending carrier transactions before rendering
  await reconcilePendingTransactions(session.user.id)

  const [walletTxs, airtimeTxs, dataTxs] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { userId: session.user.id, type: "CREDIT" },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    prisma.airtimePurchase.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    prisma.dataPurchase.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
  ])

  const unified: UnifiedTx[] = [
    ...walletTxs.map((tx) => ({
      id: tx.id,
      reference: tx.reference,
      type: "WALLET_CREDIT" as const,
      label: "Wallet Deposit",
      phone: undefined,
      networkId: undefined,
      networkName: undefined,
      amount: tx.amount,
      status: tx.status,
      isRefunded: false,
      date: tx.createdAt.toISOString(),
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
      date: tx.createdAt.toISOString(),
      serverName: tx.serverName || (tx.serverId ? "Server" : "Server 1"),
      provider: tx.provider || "CLUBKONNECT",
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
      date: tx.createdAt.toISOString(),
      serverName: tx.serverName || (tx.serverId ? "Server" : "Server 1"),
      provider: tx.provider || "CLUBKONNECT",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          Transaction History
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Complete log of your wallet funding, airtime top-ups, and data renewals with real-time filtering and Nigerian (WAT) timestamping.
        </p>
      </div>

      <TransactionsView initialTransactions={unified} isAdmin={isAdmin} />
    </div>
  )
}
