import prisma from "@/lib/prisma"
import { purchaseData } from "@/services/vtu.service"
import { detectNetwork, normalizePhoneNumber } from "@/lib/phone-utils"
import { revalidatePath } from "next/cache"

export interface AutoRenewalConfig {
  enabled: boolean
  userId: string | null
  hoursBeforeExpiry: number
  batchLimit: number
  mtnPlanId: string
  gloPlanId: string
  airtelPlanId: string
  nineMobilePlanId: string
  lastRun: string | null
  lastSummary: {
    timestamp: string
    totalProcessed: number
    succeeded: number
    failed: number
    totalSpent: number
    remainingDue: number
    walletBalanceAfter: number
    message?: string
  } | null
}

export interface RenewalResultItem {
  cartrackerId?: number
  vehicleName: string
  phone: string
  network: string
  planName: string
  amount: number
  success: boolean
  reference?: string
  error?: string
}

export interface AutoRenewalBatchResult {
  success: boolean
  totalProcessed: number
  succeeded: number
  failed: number
  totalSpent: number
  remainingDue: number
  walletBalanceBefore: number
  walletBalanceAfter: number
  items: RenewalResultItem[]
  message: string
}

/**
 * Retrieves the current auto-renewal system configuration
 */
export async function getAutoRenewalConfig(): Promise<AutoRenewalConfig> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          "auto_renew_enabled",
          "auto_renew_user_id",
          "auto_renew_hours_before_expiry",
          "auto_renew_batch_limit",
          "auto_renew_mtn_plan_id",
          "auto_renew_glo_plan_id",
          "auto_renew_airtel_plan_id",
          "auto_renew_9mobile_plan_id",
          "auto_renew_last_run",
          "auto_renew_last_summary",
        ],
      },
    },
  })

  const settingMap = new Map(settings.map((s) => [s.key, s.value]))

  let lastSummary: any = null
  try {
    const rawSum = settingMap.get("auto_renew_last_summary")
    if (rawSum) lastSummary = JSON.parse(rawSum)
  } catch (e) {
    lastSummary = null
  }

  return {
    enabled: settingMap.get("auto_renew_enabled") !== "false",
    userId: settingMap.get("auto_renew_user_id") || null,
    hoursBeforeExpiry: parseInt(settingMap.get("auto_renew_hours_before_expiry") || "24", 10),
    batchLimit: parseInt(settingMap.get("auto_renew_batch_limit") || "25", 10),
    mtnPlanId: settingMap.get("auto_renew_mtn_plan_id") || "6403",
    gloPlanId: settingMap.get("auto_renew_glo_plan_id") || "964",
    airtelPlanId: settingMap.get("auto_renew_airtel_plan_id") || "89",
    nineMobilePlanId: settingMap.get("auto_renew_9mobile_plan_id") || "66",
    lastRun: settingMap.get("auto_renew_last_run") || null,
    lastSummary,
  }
}

/**
 * Updates auto-renewal system settings
 */
export async function updateAutoRenewalConfig(
  updates: Partial<Omit<AutoRenewalConfig, "lastRun" | "lastSummary">>
): Promise<void> {
  const entries: [string, string][] = []

  if (updates.enabled !== undefined) {
    entries.push(["auto_renew_enabled", updates.enabled ? "true" : "false"])
  }
  if (updates.userId !== undefined) {
    entries.push(["auto_renew_user_id", updates.userId || ""])
  }
  if (updates.hoursBeforeExpiry !== undefined) {
    entries.push(["auto_renew_hours_before_expiry", updates.hoursBeforeExpiry.toString()])
  }
  if (updates.batchLimit !== undefined) {
    entries.push(["auto_renew_batch_limit", updates.batchLimit.toString()])
  }
  if (updates.mtnPlanId !== undefined) {
    entries.push(["auto_renew_mtn_plan_id", updates.mtnPlanId])
  }
  if (updates.gloPlanId !== undefined) {
    entries.push(["auto_renew_glo_plan_id", updates.gloPlanId])
  }
  if (updates.airtelPlanId !== undefined) {
    entries.push(["auto_renew_airtel_plan_id", updates.airtelPlanId])
  }
  if (updates.nineMobilePlanId !== undefined) {
    entries.push(["auto_renew_9mobile_plan_id", updates.nineMobilePlanId])
  }

  for (const [key, value] of entries) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    })
  }
}

/**
 * Resolves the paying user account for automated fleet renewals
 */
async function resolvePayerUser(configuredUserId: string | null) {
  if (configuredUserId) {
    const user = await prisma.user.findUnique({
      where: { id: configuredUserId },
      select: { id: true, name: true, email: true, walletBalance: true },
    })
    if (user) return user
  }

  // Look for Cartracker Nigeria fleet owner account
  const ctnUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: "ctnwallet@gmail.com" },
        { name: { contains: "Cartracker", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true, walletBalance: true },
  })
  if (ctnUser) return ctnUser

  // Fallback to highest balance admin user
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { walletBalance: "desc" },
    select: { id: true, name: true, email: true, walletBalance: true },
  })
  if (adminUser) return adminUser

  // Fallback to any user with wallet balance
  return await prisma.user.findFirst({
    orderBy: { walletBalance: "desc" },
    select: { id: true, name: true, email: true, walletBalance: true },
  })
}

/**
 * Resolves active providers for each network
 */
async function resolveProviderServers() {
  const providers = await prisma.provider.findMany({
    where: { status: true },
    orderBy: { sortOrder: "asc" },
  })

  // Find Server 3 (SMECloud), Server 2 (Pairgate), Server 1 (ClubKonnect)
  const server3 = providers.find(
    (p) =>
      p.serverCode === "server-3" ||
      p.serverName?.toLowerCase().includes("server 3") ||
      p.identifier?.toUpperCase().includes("SMECLOUD")
  )

  const server2 = providers.find(
    (p) =>
      p.serverCode === "server-2" ||
      p.serverName?.toLowerCase().includes("server 2") ||
      p.identifier?.toUpperCase().includes("PAIRGATE")
  )

  const server1 = providers.find(
    (p) =>
      p.serverCode === "server-1" ||
      p.serverName?.toLowerCase().includes("server 1") ||
      p.identifier?.toUpperCase().includes("CLUBKONNECT")
  )

  return { server1, server2, server3 }
}

/**
 * Determines plan details and provider server for a given network
 */
function resolvePlanForNetwork(
  networkId: string,
  servers: { server1?: any; server2?: any; server3?: any },
  config: AutoRenewalConfig
) {
  // 01: MTN
  if (networkId === "01") {
    // Primary: Server 3 (Plan 6403 - 100MB Monthly @ ₦250 selling price)
    if (servers.server3) {
      return {
        serverId: servers.server3.id,
        planId: config.mtnPlanId || "6403",
        planName: "MTN 100MB Monthly (Tracker Auto-Renew)",
        amount: 250,
        validityDays: 30,
      }
    }
    // Fallback: Server 2 (Plan 14 - 500MB CG @ ₦380)
    if (servers.server2) {
      return {
        serverId: servers.server2.id,
        planId: "14",
        planName: "500MB (CG) (7 Days)",
        amount: 380,
        validityDays: 7,
      }
    }
  }

  // 02: Glo
  if (networkId === "02") {
    // Primary: Server 3 Glo Corporate Gifting (Plan 964 - 500MB @ ₦350)
    if (servers.server3) {
      return {
        serverId: servers.server3.id,
        planId: config.gloPlanId || "964",
        planName: "Glo 500MB Monthly (Corporate Gifting)",
        amount: 350,
        validityDays: 30,
      }
    }
    // Fallback: Server 2
    if (servers.server2) {
      return {
        serverId: servers.server2.id,
        planId: "glo-500",
        planName: "500MB (Gifting) (7 Days)",
        amount: 380,
        validityDays: 7,
      }
    }
  }

  // 04: Airtel
  if (networkId === "04") {
    // Airtel is fulfilled via Server 2 (Plan 89 - 500MB CG @ ₦380)
    if (servers.server2) {
      return {
        serverId: servers.server2.id,
        planId: config.airtelPlanId || "89",
        planName: "500MB (CG) (7 Days)",
        amount: 380,
        validityDays: 7,
      }
    }
  }

  // 03: 9Mobile
  if (networkId === "03") {
    // 9mobile is fulfilled via Server 2 (Plan 66 - 500MB CG @ ₦380)
    if (servers.server2) {
      return {
        serverId: servers.server2.id,
        planId: config.nineMobilePlanId || "66",
        planName: "500MB (CG) (7 Days)",
        amount: 380,
        validityDays: 7,
      }
    }
  }

  // Default fallback if no specific server resolved
  const fallbackServer = servers.server3 || servers.server2 || servers.server1
  return {
    serverId: fallbackServer?.id,
    planId: "6403",
    planName: "100MB Monthly (Tracker Plan)",
    amount: 250,
    validityDays: 30,
  }
}

/**
 * Counts vehicles currently due for auto-renewal
 */
export async function getDueVehiclesCount(): Promise<{
  expiredCount: number
  expiringSoonCount: number
  totalDue: number
}> {
  const config = await getAutoRenewalConfig()
  const thresholdDate = new Date(Date.now() + config.hoursBeforeExpiry * 3600000)

  const [expiredCount, expiringSoonCount] = await Promise.all([
    prisma.offlineVehicle.count({
      where: {
        hasVtuRecord: true,
        autoRenew: true,
        vtuStatus: "EXPIRED",
      },
    }),
    prisma.offlineVehicle.count({
      where: {
        hasVtuRecord: true,
        autoRenew: true,
        OR: [
          { vtuStatus: "EXPIRING_SOON" },
          { dataExpiryDate: { lte: thresholdDate, gt: new Date() } },
        ],
      },
    }),
  ])

  return {
    expiredCount,
    expiringSoonCount,
    totalDue: expiredCount + expiringSoonCount,
  }
}

/**
 * Executes an automated renewal batch for due fleet vehicles
 */
export async function runAutoRenewalBatch(options?: {
  batchLimit?: number
  forceVehicleId?: number
  requestedByUserId?: string
}): Promise<AutoRenewalBatchResult> {
  const config = await getAutoRenewalConfig()

  if (!config.enabled && !options?.forceVehicleId) {
    return {
      success: false,
      totalProcessed: 0,
      succeeded: 0,
      failed: 0,
      totalSpent: 0,
      remainingDue: 0,
      walletBalanceBefore: 0,
      walletBalanceAfter: 0,
      items: [],
      message: "Automated renewal engine is currently disabled in system settings.",
    }
  }

  const payer = await resolvePayerUser(options?.requestedByUserId || config.userId)
  if (!payer) {
    return {
      success: false,
      totalProcessed: 0,
      succeeded: 0,
      failed: 0,
      totalSpent: 0,
      remainingDue: 0,
      walletBalanceBefore: 0,
      walletBalanceAfter: 0,
      items: [],
      message: "No funding wallet found to cover auto-renewal purchases.",
    }
  }

  const initialBalance = payer.walletBalance || 0
  if (initialBalance < 200 && !options?.forceVehicleId) {
    return {
      success: false,
      totalProcessed: 0,
      succeeded: 0,
      failed: 0,
      totalSpent: 0,
      remainingDue: 0,
      walletBalanceBefore: initialBalance,
      walletBalanceAfter: initialBalance,
      items: [],
      message: `Insufficient wallet balance to run auto-renewal batch. Current balance: ₦${initialBalance.toLocaleString()}. Please fund your wallet.`,
    }
  }

  const limit = options?.batchLimit || config.batchLimit || 25
  const thresholdDate = new Date(Date.now() + config.hoursBeforeExpiry * 3600000)

  // Find candidate vehicles from OfflineVehicle
  let candidates: any[] = []
  if (options?.forceVehicleId) {
    candidates = await prisma.offlineVehicle.findMany({
      where: { cartrackerId: options.forceVehicleId },
      take: 1,
    })
  } else {
    candidates = await prisma.offlineVehicle.findMany({
      where: {
        hasVtuRecord: true,
        autoRenew: true,
        OR: [
          { vtuStatus: { in: ["EXPIRED", "EXPIRING_SOON"] } },
          { dataExpiryDate: { lte: thresholdDate } },
          { dataExpiryDate: null },
        ],
      },
      orderBy: [
        { dataExpiryDate: "asc" }, // Most urgently expired first
        { updatedAt: "asc" },
      ],
      take: limit,
    })
  }

  if (candidates.length === 0) {
    return {
      success: true,
      totalProcessed: 0,
      succeeded: 0,
      failed: 0,
      totalSpent: 0,
      remainingDue: 0,
      walletBalanceBefore: initialBalance,
      walletBalanceAfter: initialBalance,
      items: [],
      message: "All fleet vehicle data bundles are currently active and up to date.",
    }
  }

  const servers = await resolveProviderServers()
  const results: RenewalResultItem[] = []
  let succeededCount = 0
  let failedCount = 0
  let totalSpent = 0
  const processedPhones = new Set<string>()
  const startTime = Date.now()

  for (const vehicle of candidates) {
    // Timeout safeguard: Prevent exceeding serverless invocation limits (45s max)
    if (Date.now() - startTime > 45000) {
      console.warn("[AutoRenewService] Reached 45s execution limit. Halting batch gracefully.")
      break
    }

    const cleanPhone = normalizePhoneNumber(vehicle.normalizedPhone || vehicle.rawSimNumber || "")
    if (cleanPhone.length < 10) {
      failedCount++
      results.push({
        cartrackerId: vehicle.cartrackerId,
        vehicleName: vehicle.name,
        phone: cleanPhone || "No SIM",
        network: vehicle.network || "Unknown",
        planName: "N/A",
        amount: 0,
        success: false,
        error: "Invalid or missing SIM phone number.",
      })
      continue
    }

    // Deduplication check
    if (processedPhones.has(cleanPhone)) {
      continue
    }
    processedPhones.add(cleanPhone)

    // Determine carrier network ID
    let networkId = "01"
    const netUpper = (vehicle.network || "").toUpperCase()
    if (netUpper === "MTN" || netUpper === "01") networkId = "01"
    else if (netUpper === "GLO" || netUpper === "02") networkId = "02"
    else if (netUpper === "AIRTEL" || netUpper === "04") networkId = "04"
    else if (netUpper === "9MOBILE" || netUpper === "03" || netUpper === "ETISALAT") networkId = "03"
    else {
      const detected = detectNetwork(cleanPhone)
      networkId = detected?.id || "01"
    }

    const planConfig = resolvePlanForNetwork(networkId, servers, config)

    // Refresh payer balance check
    const currentPayer = await prisma.user.findUnique({
      where: { id: payer.id },
      select: { walletBalance: true },
    })
    const currentBal = currentPayer?.walletBalance || 0
    if (currentBal < planConfig.amount) {
      console.warn(`[AutoRenewService] Wallet balance depleted (₦${currentBal} < ₦${planConfig.amount}). Halting.`)
      results.push({
        cartrackerId: vehicle.cartrackerId,
        vehicleName: vehicle.name,
        phone: cleanPhone,
        network: vehicle.network || networkId,
        planName: planConfig.planName,
        amount: planConfig.amount,
        success: false,
        error: `Insufficient wallet balance (₦${currentBal.toLocaleString()} < ₦${planConfig.amount}).`,
      })
      failedCount++
      break // Stop batch when wallet is empty
    }

    try {
      const purchaseRes = await purchaseData(
        payer.id,
        networkId,
        planConfig.planId,
        cleanPhone,
        planConfig.amount,
        {
          serverId: planConfig.serverId,
          planName: planConfig.planName,
          validityDays: planConfig.validityDays,
          bypassSimCheck: true,
        }
      )

      // Calculate new expiry date (+30 days)
      const newExpiry = new Date(Date.now() + planConfig.validityDays * 86400000)

      // Update local OfflineVehicle cached status
      await prisma.offlineVehicle.updateMany({
        where: {
          OR: [
            { cartrackerId: vehicle.cartrackerId },
            { normalizedPhone: cleanPhone },
          ],
        },
        data: {
          vtuStatus: "ACTIVE",
          lastDataPlan: planConfig.planName,
          lastDataAmount: planConfig.amount,
          lastDataDate: new Date(),
          dataExpiryDate: newExpiry,
          hasVtuRecord: true,
        },
      })

      // Update VehicleTracker if exists
      await prisma.vehicleTracker.updateMany({
        where: {
          OR: [
            { simNumber: cleanPhone },
            { simNumber: cleanPhone.startsWith("0") ? cleanPhone.slice(1) : cleanPhone },
          ],
        },
        data: {
          status: "ACTIVE",
          lastDataPlan: planConfig.planName,
          lastDataAmount: planConfig.amount,
          lastDataDate: new Date(),
          dataExpiryDate: newExpiry,
        },
      })

      succeededCount++
      totalSpent += planConfig.amount
      results.push({
        cartrackerId: vehicle.cartrackerId,
        vehicleName: vehicle.name,
        phone: cleanPhone,
        network: vehicle.network || networkId,
        planName: planConfig.planName,
        amount: planConfig.amount,
        success: true,
        reference: purchaseRes.reference,
      })
    } catch (err: any) {
      failedCount++
      const cleanErrMsg = (err?.message || "Recharge failed")
        .replace(/clubkonnect|pairgate|smecloud|sme\s*cloud|nellobyte|autobiz|demopaysub/gi, "Telecom Gateway")
      results.push({
        cartrackerId: vehicle.cartrackerId,
        vehicleName: vehicle.name,
        phone: cleanPhone,
        network: vehicle.network || networkId,
        planName: planConfig.planName,
        amount: planConfig.amount,
        success: false,
        error: cleanErrMsg,
      })
    }
  }

  const finalPayer = await prisma.user.findUnique({
    where: { id: payer.id },
    select: { walletBalance: true },
  })
  const finalBalance = finalPayer?.walletBalance || 0

  const remainingDue = await prisma.offlineVehicle.count({
    where: {
      hasVtuRecord: true,
      autoRenew: true,
      OR: [
        { vtuStatus: { in: ["EXPIRED", "EXPIRING_SOON"] } },
        { dataExpiryDate: { lte: thresholdDate } },
      ],
    },
  })

  // Store audit summary in SystemSetting
  const summaryPayload = {
    timestamp: new Date().toISOString(),
    totalProcessed: results.length,
    succeeded: succeededCount,
    failed: failedCount,
    totalSpent,
    remainingDue,
    walletBalanceAfter: finalBalance,
    message: `Auto-renewed ${succeededCount} vehicle${succeededCount === 1 ? "" : "s"} successfully (₦${totalSpent.toLocaleString()} spent).`,
  }

  await Promise.all([
    prisma.systemSetting.upsert({
      where: { key: "auto_renew_last_run" },
      create: { key: "auto_renew_last_run", value: summaryPayload.timestamp },
      update: { value: summaryPayload.timestamp },
    }),
    prisma.systemSetting.upsert({
      where: { key: "auto_renew_last_summary" },
      create: { key: "auto_renew_last_summary", value: JSON.stringify(summaryPayload) },
      update: { value: JSON.stringify(summaryPayload) },
    }),
  ])

  // Revalidate cache paths
  revalidatePath("/fleet")
  revalidatePath("/trackers")
  revalidatePath("/transactions")
  revalidatePath("/dashboard")

  return {
    success: succeededCount > 0 || failedCount === 0,
    totalProcessed: results.length,
    succeeded: succeededCount,
    failed: failedCount,
    totalSpent,
    remainingDue,
    walletBalanceBefore: initialBalance,
    walletBalanceAfter: finalBalance,
    items: results,
    message: summaryPayload.message,
  }
}

/**
 * Retrieves Server 3 minimum balance reserve settings and live wallet balance
 */
export async function getServer3ReserveTelemetry() {
  const [reserveSetting, server3Record] = await Promise.all([
    prisma.systemSetting.findUnique({
      where: { key: "server3_min_reserve_balance" },
    }),
    prisma.provider.findFirst({
      where: {
        OR: [
          { serverCode: "server-3" },
          { serverName: { contains: "Server 3" } },
          { identifier: "SMECLOUD" },
        ],
      },
    }),
  ])

  const minReserve = parseFloat(reserveSetting?.value || "3000") || 3000
  let liveBalance = server3Record?.lastKnownBalance || 0

  if (server3Record) {
    try {
      const { resolveServerAndProvider } = await import("@/services/providers/provider.factory")
      const { provider } = await resolveServerAndProvider(server3Record.id)
      if (typeof (provider as any).getWalletBalance === "function") {
        const timeoutPromise = new Promise<{ balance?: number }>((resolve) =>
          setTimeout(() => resolve({}), 2500)
        )
        const balRes: any = await Promise.race([
          (provider as any).getWalletBalance().catch(() => ({})),
          timeoutPromise,
        ])
        if (typeof balRes?.balance === "number") {
          liveBalance = balRes.balance
          await prisma.provider.update({
            where: { id: server3Record.id },
            data: { lastKnownBalance: liveBalance },
          })
        }
      }
    } catch (e: any) {
      console.warn("[getServer3ReserveTelemetry] Live balance query fallback:", e?.message)
    }
  }

  let pendingCount = 0
  try {
    if ((prisma as any).scheduledRenewal?.count) {
      pendingCount = await (prisma as any).scheduledRenewal.count({
        where: { status: "PENDING" },
      })
    } else {
      const rawRes: any = await prisma.$queryRawUnsafe(`SELECT count(*)::int as count FROM "ScheduledRenewal" WHERE status = 'PENDING'`)
      pendingCount = Number(rawRes?.[0]?.count || 0)
    }
  } catch (err) {
    console.warn("[getServer3ReserveTelemetry] Pending count fallback:", err)
  }

  const availableForRenewals = Math.max(0, liveBalance - minReserve)
  const renewalsCovered = Math.floor(availableForRenewals / 150)
  const totalScheduledCost = pendingCount * 150
  const requiredTotalBalance = minReserve + totalScheduledCost

  // Fetch recent scheduled renewals to display SIM numbers and scheduled dates to admin
  let scheduledList: Array<{
    id: string
    phone: string
    network: string
    planName: string
    cycle: number
    scheduledDate: string
    status: string
    vehicleName: string
    plateNumber: string | null
    daysLeft: number
    error: string | null
  }> = []

  try {
    let rows: any[] = []
    if ((prisma as any).scheduledRenewal?.findMany) {
      rows = await (prisma as any).scheduledRenewal.findMany({
        orderBy: [{ status: "asc" }, { scheduledDate: "asc" }],
        take: 100,
      })
    } else {
      rows = (await prisma.$queryRawUnsafe(
        `SELECT * FROM "ScheduledRenewal" ORDER BY status ASC, "scheduledDate" ASC LIMIT 100`
      )) as any[]
    }

    const phones = rows.map((r: any) => r.phone).filter(Boolean)
    const vehicleMatches = await prisma.offlineVehicle.findMany({
      where: {
        OR: [
          { normalizedPhone: { in: phones } },
          { rawSimNumber: { in: phones } },
        ],
      },
      select: {
        name: true,
        plateNumber: true,
        normalizedPhone: true,
        rawSimNumber: true,
      },
    })

    const phoneToVehicle = new Map<string, { name: string; plate: string }>()
    for (const v of vehicleMatches) {
      if (v.normalizedPhone) phoneToVehicle.set(v.normalizedPhone, { name: v.name, plate: v.plateNumber })
      if (v.rawSimNumber) phoneToVehicle.set(v.rawSimNumber, { name: v.name, plate: v.plateNumber })
    }

    scheduledList = rows.map((r: any) => {
      const veh = phoneToVehicle.get(r.phone)
      const targetTime = new Date(r.scheduledDate).getTime()
      const diffMs = targetTime - Date.now()
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      return {
        id: r.id,
        phone: r.phone,
        network: r.network,
        planName: r.planName,
        cycle: r.cycle || 2,
        scheduledDate: r.scheduledDate ? new Date(r.scheduledDate).toISOString() : "",
        status: r.status,
        vehicleName: r.vehicleName || veh?.name || "Vehicle Tracker",
        plateNumber: veh?.plate || null,
        daysLeft,
        error: r.error || null,
      }
    })
  } catch (err) {
    console.warn("[getServer3ReserveTelemetry] Error loading scheduled list:", err)
  }

  return {
    liveBalance,
    minReserve,
    availableForRenewals,
    renewalsCovered,
    pendingCount,
    totalScheduledCost,
    requiredTotalBalance,
    isHealthy: liveBalance >= minReserve,
    scheduledList,
  }
}

/**
 * Updates the minimum reserve balance for Server 3
 */
export async function updateServer3MinReserve(amount: number) {
  const safeAmount = Math.max(0, amount)
  await prisma.systemSetting.upsert({
    where: { key: "server3_min_reserve_balance" },
    create: { key: "server3_min_reserve_balance", value: safeAmount.toString() },
    update: { value: safeAmount.toString() },
  })
  revalidatePath("/admin/providers")
  return { success: true, minReserve: safeAmount }
}

/**
 * Processes automated second-cycle bi-weekly renewals (prepaid upfront, 0 wallet deduction).
 * Strictly enforces that Server 3 wallet balance must remain above the configured minimum reserve threshold.
 */
export async function processScheduledBiWeeklyRenewals(): Promise<{
  processed: number
  succeeded: number
  failed: number
  pausedDueToReserve: boolean
  message: string
  items: Array<{
    phone: string
    cycle: number
    success: boolean
    reference?: string
    error?: string
  }>
}> {
  const reserveTelemetry = await getServer3ReserveTelemetry()
  const { liveBalance, minReserve } = reserveTelemetry

  // If live balance is already at or below the minimum reserve threshold, halt execution
  if (liveBalance <= minReserve) {
    console.warn(`[BiWeeklyAutoRenew] Server 3 wallet balance (₦${liveBalance}) is at or below the required reserve threshold (₦${minReserve}). Halting execution.`)
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      pausedDueToReserve: true,
      message: `Automated 2-week renewal paused: Server 3 balance (₦${liveBalance.toLocaleString()}) is below the required reserve threshold of ₦${minReserve.toLocaleString()}. Please fund Server 3 wallet.`,
      items: [],
    }
  }

  // Find due scheduled renewals
  let dueRenewals: any[] = []
  if ((prisma as any).scheduledRenewal?.findMany) {
    dueRenewals = await (prisma as any).scheduledRenewal.findMany({
      where: {
        status: "PENDING",
        scheduledDate: { lte: new Date() },
      },
      orderBy: { scheduledDate: "asc" },
      take: 30,
    })
  } else {
    dueRenewals = (await prisma.$queryRawUnsafe(
      `SELECT * FROM "ScheduledRenewal" WHERE status = 'PENDING' AND "scheduledDate" <= NOW() ORDER BY "scheduledDate" ASC LIMIT 30`
    )) as any[]
  }

  if (dueRenewals.length === 0) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      pausedDueToReserve: false,
      message: "No bi-weekly second-cycle renewals are currently due.",
      items: [],
    }
  }

  const server3Record = await prisma.provider.findFirst({
    where: {
      OR: [
        { serverCode: "server-3" },
        { serverName: { contains: "Server 3" } },
        { identifier: "SMECLOUD" },
      ],
      status: true,
    },
  })

  if (!server3Record) {
    return {
      processed: 0,
      succeeded: 0,
      failed: dueRenewals.length,
      pausedDueToReserve: false,
      message: "Server 3 provider not found or inactive in database.",
      items: [],
    }
  }

  const { resolveServerAndProvider } = await import("@/services/providers/provider.factory")
  const { provider } = await resolveServerAndProvider(server3Record.id)

  let currentBalanceTracker = liveBalance
  let succeededCount = 0
  let failedCount = 0
  let pausedDueToReserve = false
  const results: any[] = []

  for (const item of dueRenewals) {
    // Before each recharge, check if vending ₦150 would breach the minimum reserve
    if (currentBalanceTracker - 150 < minReserve) {
      pausedDueToReserve = true
      console.warn(`[BiWeeklyAutoRenew] Server 3 wallet balance reached minimum reserve threshold. Halting remaining renewals.`)
      break
    }

    const secondReference = `DAT-CYC2-${Date.now()}-${Math.random().toString(36).substring(7)}`

    try {
      // Execute the second 100MB recharge directly via Server 3 (Vendor Plan 6403)
      const vendRes = await provider.buyData(
        item.network,
        item.planId,
        item.phone,
        secondReference,
        ""
      )

      const isSuccess = vendRes.isSuccessful || vendRes.isPending

      if (!isSuccess) {
        throw new Error((vendRes as any).message || vendRes.rawResponse?.server_message || "Carrier rejected second cycle vending")
      }

      // NO WALLET DEDUCTION FROM STAFF/USER! Upfront prepaid charge already covered it.
      await prisma.$transaction(async (tx) => {
        // Record ₦0 prepaid DataPurchase
        await tx.dataPurchase.create({
          data: {
            userId: item.userId,
            network: item.network,
            plan: "MTN 100MB (Cycle 2 of 2 - Bi-Weekly Auto-Renew) [Prepaid]",
            phone: item.phone,
            amount: 0,
            reference: secondReference,
            status: "SUCCESS",
            providerReference: vendRes.providerReference || null,
            serverId: server3Record.id,
            serverName: "Server 3",
            provider: provider.identifier,
            trackerId: item.vehicleId || null,
          },
        })

        // Record ₦0 transaction record
        await tx.walletTransaction.create({
          data: {
            userId: item.userId,
            amount: 0,
            type: "DEBIT",
            reference: secondReference,
            status: "SUCCESS",
          },
        })

        // Mark ScheduledRenewal as SUCCESS
        if ((tx as any).scheduledRenewal?.update) {
          await (tx as any).scheduledRenewal.update({
            where: { id: item.id },
            data: {
              status: "SUCCESS",
              executedDate: new Date(),
              secondPurchaseRef: secondReference,
              error: null,
            },
          })
        } else {
          await tx.$executeRawUnsafe(
            `UPDATE "ScheduledRenewal" SET status = 'SUCCESS', "executedDate" = NOW(), "secondPurchaseRef" = $1, error = NULL, "updatedAt" = NOW() WHERE id = $2`,
            secondReference,
            item.id
          )
        }

        // Extend vehicle tracker data expiry (+16 days to complete full 30 days)
        const expiryDate = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000)
        if (item.vehicleId) {
          await tx.vehicleTracker.updateMany({
            where: { id: item.vehicleId },
            data: {
              lastDataDate: new Date(),
              lastDataPlan: "MTN 100MB Twice a Month (Cycle 2 of 2)",
              dataExpiryDate: expiryDate,
              status: "ACTIVE",
            },
          })
        }

        // Also update OfflineVehicle cached VTU status
        await tx.offlineVehicle.updateMany({
          where: {
            OR: [
              { normalizedPhone: item.phone },
              { rawSimNumber: item.phone },
            ],
          },
          data: {
            vtuStatus: "ACTIVE",
            lastDataPlan: "MTN 100MB Twice a Month (Cycle 2 of 2)",
            dataExpiryDate: expiryDate,
            hasVtuRecord: true,
          },
        })
      })

      currentBalanceTracker -= 150
      succeededCount++
      results.push({
        phone: item.phone,
        cycle: 2,
        success: true,
        reference: secondReference,
      })
    } catch (err: any) {
      failedCount++
      const cleanErrMsg = (err?.message || "Recharge failed")
        .replace(/clubkonnect|pairgate|smecloud|sme\s*cloud|nellobyte|autobiz|demopaysub/gi, "Telecom Gateway")

      if ((prisma as any).scheduledRenewal?.update) {
        await (prisma as any).scheduledRenewal.update({
          where: { id: item.id },
          data: {
            error: cleanErrMsg,
          },
        })
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE "ScheduledRenewal" SET error = $1, "updatedAt" = NOW() WHERE id = $2`,
          cleanErrMsg,
          item.id
        )
      }

      results.push({
        phone: item.phone,
        cycle: 2,
        success: false,
        error: cleanErrMsg,
      })
    }
  }

  // Update Server 3 balance cache
  await prisma.provider.update({
    where: { id: server3Record.id },
    data: { lastKnownBalance: currentBalanceTracker },
  })

  revalidatePath("/fleet")
  revalidatePath("/trackers")
  revalidatePath("/transactions")

  return {
    processed: results.length,
    succeeded: succeededCount,
    failed: failedCount,
    pausedDueToReserve,
    message: `Processed ${results.length} bi-weekly renewal${results.length === 1 ? "" : "s"} (${succeededCount} succeeded, ${failedCount} failed).`,
    items: results,
  }
}

