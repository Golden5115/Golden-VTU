"use server"

import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { initializePayment } from "@/services/paystack.service"

export async function adminSelfCredit(amount: number, reason: string = "Admin manual fund") {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  })

  if (user?.role !== "ADMIN") {
    throw new Error("Only admins can use instant credit.")
  }

  if (!amount || amount <= 0) {
    throw new Error("Invalid credit amount.")
  }

  await prisma.$transaction(async (tx) => {
    await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        type: "CREDIT",
        status: "SUCCESS",
        reference: `ADMIN_SELF_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      },
    })

    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { increment: amount } },
    })
  })

  revalidatePath("/wallet/fund")
  revalidatePath("/dashboard")
  revalidatePath("/trackers")
  return { success: true }
}

export async function startPaystackFunding(amount: number) {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  if (!amount || amount < 100) {
    throw new Error("Minimum funding amount is ₦100")
  }

  const { authorization_url } = await initializePayment(session.user.email, amount)
  return { authorization_url }
}

/**
 * Verify automated bank deposit by checking incoming funds on the dedicated virtual account.
 * Uses provider.publicKey to persist baseline balance safely across runtime reloads.
 * Calculates delta (newly transferred funds) so existing provider balance & profit remain intact.
 */
export async function verifyAutomatedDeposit(forceFullSync?: boolean) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, walletBalance: true },
  })

  try {
    const { resolveServerAndProvider } = await import("@/services/providers/provider.factory")
    const { server, provider } = await resolveServerAndProvider()
    const balResponse = await provider.getWalletBalance()
    const liveBal = balResponse.balance

    // If Admin explicitly requests a full provider sync (for initial capital setup)
    if (forceFullSync && user?.role === "ADMIN") {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { walletBalance: liveBal },
        })
        if (server?.id && server.id !== "default-mock") {
          await tx.provider.update({
            where: { id: server.id },
            data: { publicKey: liveBal.toString() },
          })
        }
      })

      revalidatePath("/wallet/fund")
      revalidatePath("/dashboard")
      revalidatePath("/trackers")

      return {
        success: true,
        credited: liveBal,
        balance: liveBal,
        message: `Admin full sync completed. Wallet balance updated to ₦${liveBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`,
      }
    }

    // Read stored previous provider balance from publicKey (persists reliably without schema restarts)
    const previousBalance = parseFloat(String(server?.publicKey || "0").replace(/,/g, "").trim()) || 0

    // If baseline hasn't been set yet in the database:
    if (!previousBalance || previousBalance <= 0) {
      if (server?.id && server.id !== "default-mock") {
        await prisma.provider.update({
          where: { id: server.id },
          data: { publicKey: liveBal.toString() },
        })
      }

      // If user is ADMIN and has an empty wallet, initialize with current live balance
      if (user?.role === "ADMIN" && user.walletBalance === 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { walletBalance: liveBal },
        })
        revalidatePath("/wallet/fund")
        return {
          success: true,
          credited: liveBal,
          balance: liveBal,
          message: `Baseline initialized with ₦${liveBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`,
        }
      }

      return {
        success: true,
        credited: 0,
        balance: user?.walletBalance || 0,
        message: `Baseline set to ₦${liveBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}. When you make a transfer to your dedicated virtual account, click verify again to confirm and credit your wallet.`,
      }
    }

    // Calculate delta: newly transferred money into the account
    const delta = liveBal - previousBalance

    if (delta > 0) {
      // New funds transferred into the account!
      const updatedUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: userId },
          data: { walletBalance: { increment: delta } },
        })

        await tx.walletTransaction.create({
          data: {
            userId,
            amount: delta,
            type: "CREDIT",
            status: "SUCCESS",
            reference: `DEP_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          },
        })

        if (server?.id && server.id !== "default-mock") {
          await tx.provider.update({
            where: { id: server.id },
            data: { publicKey: liveBal.toString() },
          })
        }

        return u
      })

      revalidatePath("/wallet/fund")
      revalidatePath("/dashboard")
      revalidatePath("/trackers")
      revalidatePath("/transactions")

      return {
        success: true,
        credited: delta,
        balance: updatedUser.walletBalance,
        message: `New transfer of ₦${delta.toLocaleString(undefined, { minimumFractionDigits: 2 })} confirmed and credited to your wallet!`,
      }
    } else {
      // If balance decreased because of airtime/data purchases, update baseline
      if (delta < 0 && server?.id && server.id !== "default-mock") {
        await prisma.provider.update({
          where: { id: server.id },
          data: { publicKey: liveBal.toString() },
        })
      }

      return {
        success: true,
        credited: 0,
        balance: user?.walletBalance || 0,
        message: "No new incoming transfer detected yet. Please ensure your bank transfer is completed, then click verify again.",
      }
    }
  } catch (err: any) {
    console.error("[VerifyAutomatedDeposit] Error:", err)
    return { success: false, error: err.message || "Failed to verify automated bank deposit." }
  }
}

// Backwards compatibility alias
export async function syncClubKonnectBalance() {
  return await verifyAutomatedDeposit()
}
