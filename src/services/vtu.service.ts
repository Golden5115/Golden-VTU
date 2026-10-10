import prisma from "@/lib/prisma"
import { resolveServerAndProvider } from "./providers/provider.factory"
import { detectNetwork, NETWORKS } from "@/lib/phone-utils"

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

  // Validate carrier network prefix to prevent cross-carrier delivery failures
  const detectedNet = detectNetwork(phone)
  if (detectedNet && detectedNet.id !== networkId) {
    const expectedName = NETWORKS[networkId]?.name || "the selected network"
    throw new Error(`Carrier Mismatch: Phone ${phone} is on ${detectedNet.name}, but you selected ${expectedName}. Please select ${expectedName} SIM.`)
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

      let isCompleted = Boolean(response.isSuccessful && !response.isPending)
      let providerReference = response.providerReference

      // If carrier queued it as pending (e.g. ClubKonnect code 100 / ORDER_RECEIVED),
      // perform a fast-poll after 2.5s since telecom delivery is usually completed in 2-3s
      if (!isCompleted && typeof (provider as any).queryTransaction === "function") {
        try {
          await new Promise((r) => setTimeout(r, 2500))
          const check = await (provider as any).queryTransaction(providerReference || reference)
          if (check.isSuccessful) {
            isCompleted = true
            providerReference = check.orderId || providerReference
          } else if (check.isFailed) {
            throw new Error(`Carrier Rejected: ${check.remark || "Failed to process airtime"}`)
          }
        } catch (pollErr: any) {
          if (pollErr.message?.includes("Carrier Rejected")) throw pollErr
          console.warn("[VTU Airtime FastPoll] Pending check inconclusive:", pollErr.message)
        }
      }

      await prisma.$transaction(async (tx: any) => {
        await tx.airtimePurchase.update({
          where: { id: purchase.id },
          data: {
            providerReference,
            status: isCompleted ? "SUCCESS" : "PENDING",
          },
        })

        if (isCompleted) {
          await tx.walletTransaction.updateMany({
            where: { reference },
            data: { status: "SUCCESS" },
          })

          if (server?.id && server.id !== "default-mock") {
            const currentBaseline = parseFloat(String(server.publicKey || "0").replace(/,/g, "").trim()) || 0
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

      return {
        ...purchase,
        status: isCompleted ? "SUCCESS" : "PENDING",
        providerReference,
      }
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

      const cleanErrorMsg = String(error?.message || "Carrier processing error")
        .replace(/clubkonnect/gi, "Telecom Carrier")
        .replace(/nellobyte/gi, "Network Gateway")

      throw new Error(
        `Transaction failed on ${server.serverName}. Your wallet has been automatically refunded. (${cleanErrorMsg})`
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

  // Validate carrier network prefix to prevent cross-carrier delivery failures
  const detectedNet = detectNetwork(phone)
  if (detectedNet && detectedNet.id !== networkId) {
    const expectedName = NETWORKS[networkId]?.name || "the selected network"
    throw new Error(`Carrier Mismatch: Phone ${phone} is on ${detectedNet.name}, but you selected ${expectedName}. Please select ${expectedName} SIM.`)
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

      let isCompleted = Boolean(response.isSuccessful && !response.isPending)
      let providerReference = response.providerReference

      // If carrier queued it as pending (e.g. ClubKonnect code 100 / ORDER_RECEIVED),
      // perform a fast-poll after 2.5s since telecom delivery is usually completed in 2-3s
      if (!isCompleted && typeof (provider as any).queryTransaction === "function") {
        try {
          await new Promise((r) => setTimeout(r, 2500))
          const check = await (provider as any).queryTransaction(providerReference || reference)
          if (check.isSuccessful) {
            isCompleted = true
            providerReference = check.orderId || providerReference
          } else if (check.isFailed) {
            throw new Error(`Carrier Rejected: ${check.remark || "Failed to process data bundle"}`)
          }
        } catch (pollErr: any) {
          if (pollErr.message?.includes("Carrier Rejected")) throw pollErr
          console.warn("[VTU Data FastPoll] Pending check inconclusive:", pollErr.message)
        }
      }

      await prisma.$transaction(async (tx: any) => {
        await tx.dataPurchase.update({
          where: { id: purchase.id },
          data: {
            providerReference,
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
            const currentBaseline = parseFloat(String(server.publicKey || "0").replace(/,/g, "").trim()) || 0
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

      return {
        ...purchase,
        status: isCompleted ? "SUCCESS" : "PENDING",
        providerReference,
      }
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

      const cleanErrorMsg = String(error?.message || "Carrier processing error")
        .replace(/clubkonnect/gi, "Telecom Carrier")
        .replace(/nellobyte/gi, "Network Gateway")

      throw new Error(
        `Data purchase failed on ${server.serverName}. Your wallet has been automatically refunded. (${cleanErrorMsg})`
      )
    }
  })
}

/**
 * Automatically reconcile all PENDING transactions for a user (or globally) by querying
 * the telecom provider directly. If carrier marked it completed, updates DB to SUCCESS
 * and activates vehicle tracker telemetry. If carrier cancelled/refunded, refunds wallet.
 */
export async function reconcilePendingTransactions(userId?: string) {
  try {
    const whereClause: any = { status: "PENDING" }
    if (userId) whereClause.userId = userId

    // Only inspect orders from the last 48 hours to avoid stale checks
    const recentWindow = new Date(Date.now() - 48 * 60 * 60 * 1000)
    whereClause.createdAt = { gte: recentWindow }

    const [pendingData, pendingAirtime] = await Promise.all([
      prisma.dataPurchase.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.airtimePurchase.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ])

    if (pendingData.length === 0 && pendingAirtime.length === 0) {
      return { reconciled: 0 }
    }

    const { provider } = await resolveServerAndProvider()
    if (typeof (provider as any).queryTransaction !== "function") {
      return { reconciled: 0 }
    }

    let reconciledCount = 0

    // 1. Reconcile Data Purchases
    for (const d of pendingData) {
      const orderId = d.providerReference || d.reference
      if (!orderId) continue
      try {
        const queryRes = await (provider as any).queryTransaction(orderId)
        if (queryRes.isSuccessful) {
          await prisma.$transaction(async (tx: any) => {
            await tx.dataPurchase.update({
              where: { id: d.id },
              data: {
                status: "SUCCESS",
                providerReference: queryRes.orderId || d.providerReference,
              },
            })
            await tx.walletTransaction.updateMany({
              where: { reference: d.reference },
              data: { status: "SUCCESS" },
            })

            // Update associated tracker SIM if exists
            const cleanPhone = d.phone.replace(/[^0-9]/g, "")
            const localPhone = cleanPhone.startsWith("234") ? "0" + cleanPhone.slice(3) : cleanPhone
            const tracker = await tx.vehicleTracker.findFirst({
              where: {
                userId: d.userId,
                OR: [{ id: d.trackerId || "" }, { simNumber: localPhone }, { simNumber: cleanPhone }],
              },
            })

            if (tracker) {
              const validityDays = 30
              const expiryDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
              await tx.vehicleTracker.update({
                where: { id: tracker.id },
                data: {
                  lastDataDate: d.createdAt,
                  lastDataPlan: d.plan,
                  lastDataAmount: d.amount,
                  lastDataRef: d.reference,
                  dataValidityDays: validityDays,
                  dataExpiryDate: expiryDate,
                  status: "ACTIVE",
                },
              })
            }
          })
          reconciledCount++
        } else if (queryRes.isFailed) {
          await prisma.$transaction(async (tx: any) => {
            await tx.dataPurchase.update({
              where: { id: d.id },
              data: { status: "FAILED" },
            })
            await tx.walletTransaction.updateMany({
              where: { reference: d.reference },
              data: { status: "FAILED" },
            })
            await tx.user.update({
              where: { id: d.userId },
              data: { walletBalance: { increment: d.amount } },
            })
          })
          reconciledCount++
        }
      } catch (err: any) {
        console.warn(`[Reconcile] Error checking data order ${orderId}:`, err.message)
      }
    }

    // 2. Reconcile Airtime Purchases
    for (const a of pendingAirtime) {
      const orderId = a.providerReference || a.reference
      if (!orderId) continue
      try {
        const queryRes = await (provider as any).queryTransaction(orderId)
        if (queryRes.isSuccessful) {
          await prisma.$transaction(async (tx: any) => {
            await tx.airtimePurchase.update({
              where: { id: a.id },
              data: {
                status: "SUCCESS",
                providerReference: queryRes.orderId || a.providerReference,
              },
            })
            await tx.walletTransaction.updateMany({
              where: { reference: a.reference },
              data: { status: "SUCCESS" },
            })

            const cleanPhone = a.phone.replace(/[^0-9]/g, "")
            const localPhone = cleanPhone.startsWith("234") ? "0" + cleanPhone.slice(3) : cleanPhone
            const tracker = await tx.vehicleTracker.findFirst({
              where: {
                userId: a.userId,
                OR: [{ id: a.trackerId || "" }, { simNumber: localPhone }, { simNumber: cleanPhone }],
              },
            })

            if (tracker) {
              await tx.vehicleTracker.update({
                where: { id: tracker.id },
                data: {
                  lastAirtimeDate: a.createdAt,
                  lastAirtimeAmount: a.amount,
                  lastAirtimeRef: a.reference,
                },
              })
            }
          })
          reconciledCount++
        } else if (queryRes.isFailed) {
          await prisma.$transaction(async (tx: any) => {
            await tx.airtimePurchase.update({
              where: { id: a.id },
              data: { status: "FAILED" },
            })
            await tx.walletTransaction.updateMany({
              where: { reference: a.reference },
              data: { status: "FAILED" },
            })
            await tx.user.update({
              where: { id: a.userId },
              data: { walletBalance: { increment: a.amount } },
            })
          })
          reconciledCount++
        }
      } catch (err: any) {
        console.warn(`[Reconcile] Error checking airtime order ${orderId}:`, err.message)
      }
    }

    return { reconciled: reconciledCount }
  } catch (err: any) {
    console.error("[ReconcilePending] Global error:", err.message)
    return { reconciled: 0 }
  }
}
