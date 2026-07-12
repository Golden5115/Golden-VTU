import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AdminUserActions } from "./AdminUserActions"

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      walletBalance: true,
      role: true,
      isSuspended: true,
      createdAt: true,
    }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name || "N/A"}
                    {user.role === "ADMIN" && <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">ADMIN</span>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{user.email}</div>
                    <div className="text-xs text-muted-foreground">{user.phone || "No phone"}</div>
                  </TableCell>
                  <TableCell>₦{user.walletBalance.toFixed(2)}</TableCell>
                  <TableCell>
                    {user.isSuspended ? (
                      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Suspended</span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>
                    )}
                  </TableCell>
                  <TableCell>{user.createdAt.toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <AdminUserActions user={user} />
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
