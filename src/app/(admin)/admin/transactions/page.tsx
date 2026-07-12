import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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
              {transactions.map((tx) => (
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
                  <TableCell>{tx.status}</TableCell>
                  <TableCell className="text-right">{tx.createdAt.toLocaleDateString()} {tx.createdAt.toLocaleTimeString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
