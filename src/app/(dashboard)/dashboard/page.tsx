import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CreditCard } from "lucide-react"
import { verifyPayment } from "@/services/paystack.service"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { reference?: string };
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  
  const userId = session.user.id;

  // Fallback for local testing: If we redirected back with a reference, verify it directly
  if (searchParams.reference) {
    const reference = Array.isArray(searchParams.reference) ? searchParams.reference[0] : searchParams.reference;
    try {
      const paymentData = await verifyPayment(reference);
      if (paymentData.status === "success") {
        // Check if we already processed it
        const existingTx = await prisma.walletTransaction.findUnique({
          where: { reference: reference },
        });

        if (!existingTx) {
          // Process it
          await prisma.$transaction(async (tx) => {
            const amountInNaira = paymentData.amount / 100;
            
            await tx.walletTransaction.create({
              data: {
                userId: userId,
                amount: amountInNaira,
                type: "CREDIT",
                status: "SUCCESS",
                reference: reference,
              },
            });

            await tx.user.update({
              where: { id: userId },
              data: { walletBalance: { increment: amountInNaira } },
            });
          });
        }
      }
      // Clean up URL to avoid repeating on refresh
      redirect("/dashboard");
    } catch (error) {
      console.error("Verification error:", error);
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { walletBalance: true },
  })

  const transactions = await prisma.walletTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{user?.walletBalance.toFixed(2) || "0.00"}</div>
            <p className="text-xs text-muted-foreground">Available for top-up</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your most recent wallet activity.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-[100px] text-muted-foreground">
                      No recent transactions
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.type === 'CREDIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {tx.type}
                        </span>
                      </TableCell>
                      <TableCell>₦{tx.amount.toFixed(2)}</TableCell>
                      <TableCell>{tx.status}</TableCell>
                      <TableCell className="text-right">{tx.createdAt.toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
