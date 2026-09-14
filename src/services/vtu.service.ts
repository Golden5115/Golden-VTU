import prisma from "@/lib/prisma"
import { resolveServerAndProvider } from "./providers/provider.factory"

// Determine the callback URL dynamically based on the active provider
function getCallbackUrl(providerIdentifier: string): string {
  const domain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  const endpoint = providerIdentifier.toLowerCase()
  if (domain) {
    return `https://${domain}/api/webhooks/${endpoint}`
  }
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  return `${baseUrl}/api/webhooks/${endpoint}`
}

export async function purchaseAirtime(
  userId: string,
  networkId: string,
  phone: string,
  amount: number,
  serverId?: string
) {
  // 1. Resolve server and provider engine first
  const { server, provider } = await resolveServerAndProvider(serverId)

  return await prisma.$transaction(async (tx: any) => {
    // 2. Check wallet balance
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user || user.walletBalance < amount) {
      throw new Error("Insufficient wallet balance")
    }

    // 3. Deduct wallet balance
    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { decrement: amount } },
    })

    // 4. Generate unique reference/request ID
    const reference = `AIR-${Date.now()}-${Math.random().toString(36).substring(7)}`

    // 5. Create Wallet Transaction record (PENDING until confirmed)
    await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        type: "DEBIT",
        reference,
        status: "PENDING",
      },
    })

    // 6. Create Airtime Purchase record (PENDING)
    const purchase = await tx.airtimePurchase.create({
      data: {
        userId,
        network: networkId,
        phone,
        amount,
        reference,
        status: "PENDING",
        providerReference: null,
        serverId: server.id,
        serverName: server.serverName,
        provider: provider.identifier,
      },
    })

    return { purchase, reference }
  }).then(async ({ purchase, reference }) => {
    // 7. Call Provider API OUTSIDE the transaction
    try {
      const response = await provider.buyAirtime(
        networkId,
        amount,
        phone,
        reference,
        getCallbackUrl(provider.identifier)
      )

      const isCompleted = response.isSuccessful

      await prisma.$transaction(async (tx: any) => {
        await tx.airtimePurchase.update({
          where: { id: purchase.id },
          data: {
            providerReference: response.providerReference,
            status: isCompleted ? "SUCCESS" : "PENDING",
          },
        })

        if (isCompleted) {
          await tx.walletTransaction.updateMany({
            where: { reference },
            data: { status: "SUCCESS" },
          })
        }
      })

      return purchase
    } catch (error: any) {
      console.error(`[VTU] ${provider.identifier} airtime API call failed:`, error.message)

      // Refund the user's wallet
      await prisma.$transaction(async (tx: any) => {
        await tx.user.update({
          where: { id: purchase.userId },
          data: { walletBalance: { increment: amount } },
        })
        await tx.airtimePurchase.update({
          where: { id: purchase.id },
          data: { status: "FAILED" },
        })
        await tx.walletTransaction.updateMany({
          where: { reference },
          data: { status: "FAILED" },
        })
      })

      throw new Error(
        `Transaction failed on ${server.serverName}. Your wallet has been automatically refunded. (${error.message})`
      )
    }
  })
}

export async function purchaseData(
  userId: string,
  networkId: string,
  dataPlanId: string,
  phone: string,
  amount: number,
  serverId?: string
) {
  // 1. Resolve server and provider engine first
  const { server, provider } = await resolveServerAndProvider(serverId)

  return await prisma.$transaction(async (tx: any) => {
    // 2. Check wallet balance
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user || user.walletBalance < amount) {
      throw new Error("Insufficient wallet balance")
    }

    // 3. Deduct wallet balance
    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { decrement: amount } },
    })

    // 4. Generate unique reference
    const reference = `DAT-${Date.now()}-${Math.random().toString(36).substring(7)}`

    // 5. Create Wallet Transaction record (PENDING)
    await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        type: "DEBIT",
        reference,
        status: "PENDING",
      },
    })

    // 6. Create Data Purchase record (PENDING)
    const purchase = await tx.dataPurchase.create({
      data: {
        userId,
        network: networkId,
        plan: dataPlanId,
        phone,
        amount,
        reference,
        status: "PENDING",
        providerReference: null,
        serverId: server.id,
        serverName: server.serverName,
        provider: provider.identifier,
      },
    })

    return { purchase, reference }
  }).then(async ({ purchase, reference }) => {
    // 7. Call Provider API OUTSIDE the transaction
    try {
      const response = await provider.buyData(
        networkId,
        dataPlanId,
        phone,
        reference,
        getCallbackUrl(provider.identifier)
      )

      const isCompleted = response.isSuccessful

      await prisma.$transaction(async (tx: any) => {
        await tx.dataPurchase.update({
          where: { id: purchase.id },
          data: {
            providerReference: response.providerReference,
            status: isCompleted ? "SUCCESS" : "PENDING",
          },
        })

        if (isCompleted) {
          await tx.walletTransaction.updateMany({
            where: { reference },
            data: { status: "SUCCESS" },
          })
        }
      })

      return purchase
    } catch (error: any) {
      console.error(`[VTU] ${provider.identifier} data API call failed:`, error.message)

      // Refund the user's wallet
      await prisma.$transaction(async (tx: any) => {
        await tx.user.update({
          where: { id: purchase.userId },
          data: { walletBalance: { increment: amount } },
        })
        await tx.dataPurchase.update({
          where: { id: purchase.id },
          data: { status: "FAILED" },
        })
        await tx.walletTransaction.updateMany({
          where: { reference },
          data: { status: "FAILED" },
        })
      })

      throw new Error(
        `Data purchase failed on ${server.serverName}. Your wallet has been automatically refunded. (${error.message})`
      )
    }
  })
}
