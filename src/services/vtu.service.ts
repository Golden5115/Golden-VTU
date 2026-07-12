import prisma from "@/lib/prisma"
import { ckBuyAirtime, ckBuyData } from "@/services/clubkonnect.service"

// Determine the callback URL dynamically
function getCallbackUrl(): string {
  const domain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
  if (domain) {
    return `https://${domain}/api/webhooks/clubkonnect`
  }
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  return `${baseUrl}/api/webhooks/clubkonnect`
}

// Map network names to ClubKonnect IDs
const NETWORK_TO_CK_ID: Record<string, string> = {
  MTN: "01",
  GLO: "02",
  "9MOBILE": "03",
  AIRTEL: "04",
}

export async function purchaseAirtime(userId: string, networkId: string, phone: string, amount: number) {
  return await prisma.$transaction(async (tx: any) => {
    // 1. Check wallet balance
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user || user.walletBalance < amount) {
      throw new Error("Insufficient wallet balance")
    }

    // 2. Deduct wallet balance
    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { decrement: amount } },
    })

    // 3. Generate unique reference/request ID
    const reference = `AIR-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    // 4. Create Wallet Transaction record (PENDING until confirmed)
    await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        type: "DEBIT",
        reference,
        status: "PENDING",
      },
    })

    // 5. Create Airtime Purchase record (PENDING)
    const purchase = await tx.airtimePurchase.create({
      data: {
        userId,
        network: networkId,
        phone,
        amount,
        reference,
        status: "PENDING",
        providerReference: null,
      },
    })

    return { purchase, reference }
  }).then(async ({ purchase, reference }) => {
    // 6. Call ClubKonnect API OUTSIDE the transaction
    // (so if it fails, we can handle the refund separately)
    try {
      const ckResponse = await ckBuyAirtime(
        networkId, // Already a CK network ID like "01"
        amount,
        phone,
        reference,
        getCallbackUrl()
      )

      // Update purchase with provider order ID
      const isCompleted = ckResponse.statuscode === "200"
      
      await prisma.$transaction(async (tx: any) => {
        await tx.airtimePurchase.update({
          where: { id: purchase.id },
          data: { 
            providerReference: ckResponse.orderid,
            status: isCompleted ? "SUCCESS" : "PENDING"
          },
        })

        if (isCompleted) {
          await tx.walletTransaction.updateMany({
            where: { reference },
            data: { status: "SUCCESS" }
          })
        }
      })

      return purchase
    } catch (error: any) {
      console.error("[VTU] ClubKonnect airtime API call failed:", error.message)

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

      throw new Error(`Airtime purchase failed: ${error.message}. Your wallet has been refunded.`)
    }
  })
}

export async function purchaseData(userId: string, networkId: string, dataPlanId: string, phone: string, amount: number) {
  return await prisma.$transaction(async (tx: any) => {
    // 1. Check wallet balance
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user || user.walletBalance < amount) {
      throw new Error("Insufficient wallet balance")
    }

    // 2. Deduct wallet balance
    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { decrement: amount } },
    })

    // 3. Generate unique reference
    const reference = `DAT-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    // 4. Create Wallet Transaction record (PENDING)
    await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        type: "DEBIT",
        reference,
        status: "PENDING",
      },
    })

    // 5. Create Data Purchase record (PENDING)
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
      },
    })

    return { purchase, reference }
  }).then(async ({ purchase, reference }) => {
    // 6. Call ClubKonnect API OUTSIDE the transaction
    try {
      const ckResponse = await ckBuyData(
        networkId,
        dataPlanId,
        phone,
        reference,
        getCallbackUrl()
      )

      // Update purchase with provider order ID
      const isCompleted = ckResponse.statuscode === "200"

      await prisma.$transaction(async (tx: any) => {
        await tx.dataPurchase.update({
          where: { id: purchase.id },
          data: { 
            providerReference: ckResponse.orderid,
            status: isCompleted ? "SUCCESS" : "PENDING"
          },
        })

        if (isCompleted) {
          await tx.walletTransaction.updateMany({
            where: { reference },
            data: { status: "SUCCESS" }
          })
        }
      })

      return purchase
    } catch (error: any) {
      console.error("[VTU] ClubKonnect data API call failed:", error.message)

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

      throw new Error(`Data purchase failed: ${error.message}. Your wallet has been refunded.`)
    }
  })
}
