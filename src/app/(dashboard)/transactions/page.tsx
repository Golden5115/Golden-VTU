import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { NETWORKS, formatPlanDisplayName } from "@/lib/phone-utils"
import { reconcilePendingTransactions } from "@/services/vtu.service"
import { TransactionsView, UnifiedTx } from "./TransactionsView"

interface PageProps {
  searchParams?: Promise<{
    startDate?: string
    endDate?: string
    preset?: string
  }>
}

export default async function TransactionsPage(props: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const searchParams = props.searchParams ? await props.searchParams : {}
  const { startDate, endDate, preset } = searchParams

  const isAdmin =
    (session.user as any)?.role === "ADMIN" ||
    session.user?.email?.toLowerCase() === "ayomide.ayoola6866@gmail.com"

  // Automatically reconcile any pending carrier transactions before rendering (safe fallback)
  try {
    await reconcilePendingTransactions(session.user.id)
  } catch (err: any) {
    console.error("[TransactionsPage] Reconcile warning:", err?.message || err)
  }

  // Parse Nigerian date strings (YYYY-MM-DD in WAT / UTC+1) into UTC Date boundaries
  const dateFilter: any = {}
  if (startDate && typeof startDate === "string") {
    const [y, m, d] = startDate.split("-").map(Number)
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      // 00:00:00 WAT = 23:00:00 UTC previous day (UTC-1)
      dateFilter.gte = new Date(Date.UTC(y, m - 1, d, -1, 0, 0, 0))
    }
  }
  if (endDate && typeof endDate === "string") {
    const [y, m, d] = endDate.split("-").map(Number)
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      // 23:59:59.999 WAT = 22:59:59.999 UTC same day
      dateFilter.lte = new Date(Date.UTC(y, m - 1, d, 22, 59, 59, 999))
    }
  }

  const hasDateFilter = Boolean(dateFilter.gte || dateFilter.lte)

  const [walletTxs, airtimeTxs, dataTxs] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: {
        userId: session.user.id,
        type: "CREDIT",
        ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: hasDateFilter ? 1000 : 500,
    }),
    prisma.airtimePurchase.findMany({
      where: {
        userId: session.user.id,
        ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: hasDateFilter ? 1500 : 1500,
    }),
    prisma.dataPurchase.findMany({
      where: {
        userId: session.user.id,
        ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: hasDateFilter ? 2500 : 2500,
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
      label: `Data Bundle (${formatPlanDisplayName(tx.plan, tx.network)})`,
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

      <TransactionsView
        initialTransactions={unified}
        isAdmin={isAdmin}
        initialStartDate={typeof startDate === "string" ? startDate : undefined}
        initialEndDate={typeof endDate === "string" ? endDate : undefined}
        initialPreset={typeof preset === "string" ? (preset as any) : undefined}
      />
    </div>
  )
}
