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
  serverIdOrOptions?: string | { serverId?: string; trackerId?: string }
) {
  const options = typeof serverIdOrOptions === "object" ? serverIdOrOptions : { serverId: serverIdOrOptions }
  const serverId = options.serverId
  let trackerId = options.trackerId

  // If no explicit trackerId passed, auto-detect if this phone number belongs to a registered tracker
  if (!trackerId) {
    const cleanPhone = phone.replace(/[^0-9]/g, "")
    const localPhone = cleanPhone.startsWith("234") ? "0" + cleanPhone.slice(3) : cleanPhone
    const matched = await prisma.vehicleTracker.findFirst({
      where: {
        userId,
        OR: [{ simNumber: localPhone }, { simNumber: cleanPhone }],
      },
      select: { id: true },
    })
    if (matched) trackerId = matched.id
  }

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
        trackerId: trackerId || null,
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

          if (server?.id && server.id !== "default-mock") {
            const currentBaseline = parseFloat(server.publicKey || "0")
            if (currentBaseline > 0) {
              const updatedBaseline = Math.max(0, currentBaseline - amount)
              await tx.provider.update({
                where: { id: server.id },
                data: { publicKey: updatedBaseline.toString() },
              })
            }
          }

          // Update Vehicle Tracker last airtime top-up details
          if (trackerId) {
            await tx.vehicleTracker.update({
              where: { id: trackerId },
              data: {
                lastAirtimeDate: new Date(),
                lastAirtimeAmount: amount,
                lastAirtimeRef: reference,
              },
            })
          }
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
  serverIdOrOptions?: string | {
    serverId?: string
    trackerId?: string
    planName?: string
    validityDays?: number
  }
) {
  const options =
    typeof serverIdOrOptions === "object"
      ? serverIdOrOptions
      : { serverId: serverIdOrOptions, trackerId: undefined, planName: undefined, validityDays: 30 }
  const serverId = options.serverId
  let trackerId = options.trackerId
  const planName = options.planName
  const validityDays = options.validityDays || 30

  // If no explicit trackerId passed, auto-detect if this phone number belongs to a registered tracker
  if (!trackerId) {
    const cleanPhone = phone.replace(/[^0-9]/g, "")
    const localPhone = cleanPhone.startsWith("234") ? "0" + cleanPhone.slice(3) : cleanPhone
    const matched = await prisma.vehicleTracker.findFirst({
      where: {
        userId,
        OR: [{ simNumber: localPhone }, { simNumber: cleanPhone }],
      },
      select: { id: true },
    })
    if (matched) trackerId = matched.id
  }

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
        trackerId: trackerId || null,
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

          if (server?.id && server.id !== "default-mock") {
            const wholesaleCost = Math.max(0, amount - 100)
            const currentBaseline = parseFloat(server.publicKey || "0")
            if (currentBaseline > 0) {
              const updatedBaseline = Math.max(0, currentBaseline - wholesaleCost)
              await tx.provider.update({
                where: { id: server.id },
                data: { publicKey: updatedBaseline.toString() },
              })
            }
          }

          // Update Vehicle Tracker last data top-up details and calculate expiry
          if (trackerId) {
            const expiryDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
            await tx.vehicleTracker.update({
              where: { id: trackerId },
              data: {
                lastDataDate: new Date(),
                lastDataPlan: planName || dataPlanId,
                lastDataAmount: amount,
                lastDataRef: reference,
                dataValidityDays: validityDays,
                dataExpiryDate: expiryDate,
                status: "ACTIVE",
              },
            })
          }
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
