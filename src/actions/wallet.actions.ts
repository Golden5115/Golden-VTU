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
        const orderStatus = String(rawResp.status || "").toUpperCase()
        const isDeposit = orderType.includes("deposit") || rawResp.orderid === rawInputStr

        if (isDeposit && (orderStatus === "ORDER_COMPLETED" || rawResp.statuscode === "200" || rawResp.statuscode === "299")) {
          // Check if this Order ID was already credited (across any user)
          const alreadyCredited = await prisma.walletTransaction.findFirst({
            where: {
              reference: { contains: rawInputStr },
            },
          })

          if (alreadyCredited) {
            return {
              success: false,
              error: `Deposit with Order ID ${rawInputStr} has already been credited (₦${alreadyCredited.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}).`,
            }
          }

          const creditAmount = chargedAmt > 0 ? chargedAmt : 0
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
        } else {
          return {
            success: false,
            error: `Order ID ${rawInputStr} is not a valid completed fund deposit on ClubKonnect (Status: ${orderStatus || "Incomplete"}).`,
          }
        }
      } catch (err: any) {
        console.warn("[VerifyAutomatedDeposit] Order ID query check warning:", err.message)
        return {
          success: false,
          error: `Could not verify Order ID ${rawInputStr}: ${err.message || "Failed to query carrier"}`,
        }
      }
    }

    // CASE 2: Automated Bank Transfer Delta Verification
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
        success: false,
        credited: 0,
        balance: user?.walletBalance || 0,
        error: `Dedicated account baseline synchronized at ₦${liveBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}. When your bank transfer completes, click verify to credit your wallet.`,
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

    // Calculate delta: newly transferred money into the carrier account
    const delta = Math.round((liveBal - previousBalance) * 100) / 100

    if (delta > 0) {
      // New funds genuinely transferred into the carrier account!
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

      const expectedAmount = parsedAmount > 0 && !isOrderId ? parsedAmount : undefined
      const confirmationMsg = expectedAmount
        ? `Transfer confirmed! ₦${delta.toLocaleString(undefined, { minimumFractionDigits: 2 })} received and credited to your wallet (Amount sent: ₦${expectedAmount.toLocaleString()})!`
        : `New transfer of ₦${delta.toLocaleString(undefined, { minimumFractionDigits: 2 })} confirmed and credited to your wallet!`

      return {
        success: true,
        credited: delta,
        balance: updatedUser.walletBalance,
        message: confirmationMsg,
      }
    } else {
      // Delta is <= 0: NO funds have arrived. NEVER credit anything!
      if (server?.id && server.id !== "default-mock" && storedBaseline !== liveBal) {
        await prisma.provider.update({
          where: { id: server.id },
          data: { 
            publicKey: liveBal.toString(),
            lastKnownBalance: liveBal,
          },
        })
      }

      const expectedAmount = parsedAmount > 0 && !isOrderId ? parsedAmount : undefined
      const errorMessage = expectedAmount
        ? `No incoming transfer of ₦${expectedAmount.toLocaleString()} detected on your dedicated virtual account yet. If you just transferred from your bank app, please allow 1 to 2 minutes for the payment to reflect, then click Verify again.`
        : `No new incoming transfer detected on your dedicated virtual account yet. Please ensure your bank transfer is completed, then click Verify again.`

      return {
        success: false,
        credited: 0,
        balance: user?.walletBalance || 0,
        error: errorMessage,
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
