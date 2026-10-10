import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LiveStatusButton } from "@/components/vtu/LiveStatusButton"
import { format12HourDateTime } from "@/lib/phone-utils"

export const dynamic = "force-dynamic"

export default async function AdminTransactionsPage() {
  const transactions = await prisma.walletTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 100, // Limit to recent 100 for performance
    include: {
      user: {
        select: { email: true, name: true }
      }
    }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Global Transactions</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Recent Wallet Activity (Top 100)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx: any) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <div className="font-medium">{tx.user.name || "N/A"}</div>
                    <div className="text-xs text-muted-foreground">{tx.user.email}</div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.type === 'CREDIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {tx.type}
                    </span>
                  </TableCell>
                  <TableCell>₦{tx.amount.toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{tx.reference}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {tx.status === "SUCCESS" ? (
                        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                          SUCCESS
                        </span>
                      ) : tx.status === "FAILED" ? (
                        <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                          REFUNDED
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                          {tx.status}
                        </span>
                      )}
                      <LiveStatusButton
                        reference={tx.reference}
                        currentStatus={tx.status}
                        isVtuPurchase={tx.reference?.startsWith("DAT-") || tx.reference?.startsWith("AIR-")}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <span className="font-medium text-gray-800">{format12HourDateTime(tx.createdAt).full}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
