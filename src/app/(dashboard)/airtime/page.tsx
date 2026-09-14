import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { purchaseAirtime } from "@/services/vtu.service"
import { getActiveServers, resolveServerAndProvider } from "@/services/providers/provider.factory"
import { AirtimeForm } from "./AirtimeForm"
import prisma from "@/lib/prisma"

export default async function AirtimePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { walletBalance: true },
  })
  const walletBalance = user?.walletBalance || 0

  const servers = await getActiveServers()
  const { server: initialServer } = await resolveServerAndProvider()

  async function buyAirtimeAction(formData: FormData) {
    "use server"
    const networkId = formData.get("network") as string
    const phone = formData.get("phone") as string
    const amount = parseFloat(formData.get("amount") as string)
    const serverId = (formData.get("serverId") as string) || undefined

    if (!networkId || !phone || !amount || amount < 50) {
      throw new Error("Invalid input. Minimum airtime amount is ₦50.")
    }

    let success = false
    try {
      await purchaseAirtime(session!.user!.id!, networkId, phone, amount, serverId)
      success = true
    } catch (e: any) {
      throw new Error(e.message)
    }

    if (success) {
      redirect("/transactions")
    }
  }

  return (
    <AirtimeForm
      servers={servers}
      initialServerId={initialServer.id}
      walletBalance={walletBalance}
    />
  )
}
