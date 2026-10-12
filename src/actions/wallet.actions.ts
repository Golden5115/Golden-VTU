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
export async function verifyAutomatedDeposit(forceFullSync?: boolean, expectedInput?: number | string) {
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
            data: { 
              publicKey: liveBal.toString(),
              lastKnownBalance: liveBal,
            },
          })
        }
      })

      revalidatePath("/wallet/fund")
      revalidatePath("/dashboard")
      revalidatePath("/trackers")
      revalidatePath("/transactions")

      return {
        success: true,
        credited: liveBal,
        balance: liveBal,
        message: `Admin full sync completed. Wallet balance updated to ₦${liveBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`,
      }
    }

    // Read stored previous provider balance from publicKey
    const storedBaseline = parseFloat(String(server?.publicKey || "0").replace(/,/g, "").trim()) || 0

    // Parse input: check if user provided an Order ID (string with 8+ digits) or a monetary amount
    const rawInputStr = String(expectedInput || "").trim()
    const isOrderId = rawInputStr.length >= 8 && /^\d+$/.test(rawInputStr) && parseFloat(rawInputStr) > 1000000
    const parsedAmount = parseFloat(rawInputStr)

    // CASE 1: User provided ClubKonnect Order ID (e.g. 6721245675)
    if (isOrderId && typeof (provider as any).queryTransaction === "function") {
      try {
        const orderCheck = await (provider as any).queryTransaction(rawInputStr)
        const rawResp = orderCheck?.rawResponse || {}
        const orderType = String(rawResp.ordertype || "").toLowerCase()
        const chargedAmt = parseFloat(String(rawResp.amountcharged || orderCheck.amountCharged || "0").replace(/,/g, ""))

        if (orderType.includes("deposit") || rawResp.orderid === rawInputStr) {
          // Check if this Order ID was already credited
          const alreadyCredited = await prisma.walletTransaction.findFirst({
            where: {
              userId,
              reference: { contains: rawInputStr },
            },
          })

          if (alreadyCredited) {
            return {
              success: false,
              error: `Deposit with Order ID ${rawInputStr} has already been credited (₦${alreadyCredited.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}).`,
            }
          }

          const creditAmount = chargedAmt > 0 ? chargedAmt : parsedAmount
          if (creditAmount > 0) {
            const updatedUser = await prisma.$transaction(async (tx) => {
              const u = await tx.user.update({
                where: { id: userId },
                data: { walletBalance: { increment: creditAmount } },
              })

              await tx.walletTransaction.create({
                data: {
                  userId,
                  amount: creditAmount,
                  type: "CREDIT",
                  status: "SUCCESS",
                  reference: `DEP_CK_${rawInputStr}_${Date.now()}`,
                },
              })

              if (server?.id && server.id !== "default-mock") {
                await tx.provider.update({
                  where: { id: server.id },
                  data: { 
                    publicKey: liveBal.toString(),
                    lastKnownBalance: liveBal,
                  },
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
              credited: creditAmount,
              balance: updatedUser.walletBalance,
              message: `ClubKonnect Deposit (Order #${rawInputStr}) of ₦${creditAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} successfully verified and credited!`,
            }
          }
        }
      } catch (err: any) {
        console.warn("[VerifyAutomatedDeposit] Order ID query check warning:", err.message)
      }
    }

    // CASE 2: User specified exact transferred amount (e.g. ₦5,000 or ₦4,973.12)
    const expectedAmount = parsedAmount > 0 && !isOrderId ? parsedAmount : undefined
    if (expectedAmount && expectedAmount > 0) {
      if (liveBal < expectedAmount && liveBal < 100) {
        return {
          success: false,
          error: `Carrier balance is currently ₦${liveBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}, which is less than the transferred ₦${expectedAmount.toLocaleString()}. Please wait 1-2 minutes for your bank transfer to reflect on your virtual account and try again.`,
        }
      }

      const updatedUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: userId },
          data: { walletBalance: { increment: expectedAmount } },
        })

        await tx.walletTransaction.create({
          data: {
            userId,
            amount: expectedAmount,
            type: "CREDIT",
            status: "SUCCESS",
            reference: `DEP_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          },
        })

        if (server?.id && server.id !== "default-mock") {
          await tx.provider.update({
            where: { id: server.id },
            data: { 
              publicKey: liveBal.toString(),
              lastKnownBalance: liveBal,
            },
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
        credited: expectedAmount,
        balance: updatedUser.walletBalance,
        message: `Full transfer of ₦${expectedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} confirmed and credited to your wallet!`,
      }
    }

    // CASE 2: Auto-detect deposit delta
    // If baseline hasn't been set yet in the database:
    if (!storedBaseline || storedBaseline <= 0) {
      if (server?.id && server.id !== "default-mock") {
        await prisma.provider.update({
          where: { id: server.id },
          data: { 
            publicKey: liveBal.toString(),
            lastKnownBalance: liveBal,
          },
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

    // Guard against stale elevated baseline: if previous baseline was higher than live balance,
    // sync it down so previous purchases don't reduce future incoming deposits!
    let previousBalance = storedBaseline
    if (previousBalance > liveBal) {
      previousBalance = liveBal
      if (server?.id && server.id !== "default-mock") {
        await prisma.provider.update({
          where: { id: server.id },
          data: { 
            publicKey: liveBal.toString(),
            lastKnownBalance: liveBal,
          },
        })
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
            data: { 
              publicKey: liveBal.toString(),
              lastKnownBalance: liveBal,
            },
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
      // Sync baseline to live balance if out of sync
      if (server?.id && server.id !== "default-mock" && storedBaseline !== liveBal) {
        await prisma.provider.update({
          where: { id: server.id },
          data: { 
            publicKey: liveBal.toString(),
            lastKnownBalance: liveBal,
          },
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
