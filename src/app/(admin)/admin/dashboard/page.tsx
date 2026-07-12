import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, CreditCard, Activity, ArrowUpRight } from "lucide-react"

export default async function AdminDashboardPage() {
  // Fetch High-level Metrics
  const totalUsers = await prisma.user.count()
  
  const totalWalletBalances = await prisma.user.aggregate({
    _sum: { walletBalance: true }
  })

  const totalAirtimeSales = await prisma.airtimePurchase.aggregate({
    where: { status: "SUCCESS" },
    _sum: { amount: true }
  })

  const totalDataSales = await prisma.dataPurchase.aggregate({
    where: { status: "SUCCESS" },
    _sum: { amount: true }
  })

  const totalVolume = (totalAirtimeSales._sum.amount || 0) + (totalDataSales._sum.amount || 0)

  // Recent Users
  const recentUsers = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, createdAt: true }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">System Wallet Balances</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{(totalWalletBalances._sum.walletBalance || 0).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total money currently in user wallets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Sales Volume</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦{totalVolume.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Successful Airtime & Data sales</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {recentUsers.map((user: any) => (
                <div key={user.id} className="flex items-center">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="ml-auto font-medium text-sm text-muted-foreground">
                    {user.createdAt.toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
