import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { purchaseData } from "@/services/vtu.service"
import { getActiveServers, resolveServerAndProvider } from "@/services/providers/provider.factory"
import { DataPurchaseForm } from "./DataPurchaseForm"
import prisma from "@/lib/prisma"

export default async function DataPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { walletBalance: true },
  })
  const walletBalance = user?.walletBalance || 0

  // Fetch all active servers
  const servers = await getActiveServers()

  // Fetch initial plans for the default server
  const { server: initialServer, provider } = await resolveServerAndProvider()
  let plans: any[] = []
  try {
    plans = await provider.getDataPlans()
  } catch (error) {
    console.error("[DataPage] Failed to fetch initial data plans:", error)
  }

  async function buyDataAction(formData: FormData) {
    "use server"
    const networkId = formData.get("network") as string
    const planId = formData.get("plan") as string
    const phone = formData.get("phone") as string
    const amountStr = formData.get("amount") as string
    const serverId = (formData.get("serverId") as string) || undefined
    const amount = parseFloat(amountStr)

    if (!networkId || !planId || !phone || !amount || amount <= 0) {
      throw new Error("Invalid input. Please select a valid plan and phone number.")
    }

    let success = false
    try {
      await purchaseData(session!.user!.id!, networkId, planId, phone, amount, serverId)
      success = true
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message)
    }

    if (success) {
      redirect("/transactions")
    }
  }

  return (
    <DataPurchaseForm
      servers={servers}
      initialServerId={initialServer.id}
      initialPlans={plans}
      walletBalance={walletBalance}
    />
  )
}
