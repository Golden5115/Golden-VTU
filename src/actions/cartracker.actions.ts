"use server"

import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { detectNetwork, extractValidityDays } from "@/lib/phone-utils"
import { checkSimHistory } from "@/actions/sim-history.actions"
import { purchaseData } from "@/services/vtu.service"

// In-memory cache for the CarTracker API user_api_hash token
let cachedToken: { hash: string; expiresAt: number } | null = null

async function requireUser(): Promise<{ id: string; email?: string | null; name?: string | null; role?: string }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized. Please log in.")
  return session.user as { id: string; email?: string | null; name?: string | null; role?: string }
}

function getCarTrackerConfig() {
  const baseUrl = (process.env.CARTRACKER_API_BASE_URL || "https://app.cartracker.com.ng/api").replace(/\/+$/, "")
  const email = process.env.CARTRACKER_ADMIN_EMAIL || "ayo.a@cartracker.com"
  const password = process.env.CARTRACKER_ADMIN_PASSWORD || "Ayoola1234"
  return { baseUrl, email, password }
}

/**
 * Obtains or refreshes the CarTracker Nigeria admin API token (user_api_hash)
 */
async function getCarTrackerApiHash(forceRefresh: boolean = false): Promise<string> {
  const now = Date.now()
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.hash
  }

  const { baseUrl, email, password } = getCarTrackerConfig()
  const formData = new FormData()
  formData.append("email", email)
  formData.append("password", password)

  const res = await fetch(`${baseUrl}/login`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error(`Car Tracker API login failed: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  if (data.status !== 1 || !data.user_api_hash) {
    throw new Error(data.message || "Failed to authenticate with Car Tracker Nigeria API.")
  }

  // Cache token for 2 hours
  cachedToken = {
    hash: data.user_api_hash,
    expiresAt: now + 2 * 60 * 60 * 1000,
  }

  return data.user_api_hash
}

export interface FleetTrackerDevice {
  id: number
  name: string
  plateNumber: string
  imei: string
  rawSimNumber: string
  normalizedPhone: string
  network: {
    id: string
    name: string
    color: string
  } | null
  deviceModel: string
  expirationDate: string | null
  protocol: string
  active: boolean

  // Live Connection Telemetry
  onlineStatus: "online" | "ack" | "offline" | "unknown"
  lastHeartbeat?: string | null
  speed?: number | null
  stopDuration?: string | null

  // Local VTU history / diagnostics
  vtuHistory: {
    hasRecord: boolean
    lastDataPlan?: string | null
    lastDataAmount?: number | null
    lastDataDate?: string | null
    lastDataFormattedDate?: string | null
    lastDataDaysAgo?: number | null
    isExpired?: boolean
    isExpiringSoon?: boolean
    daysUntilExpiry?: number
    statusBadge: "EXPIRED" | "EXPIRING_SOON" | "ACTIVE" | "NEVER_LOADED"
    lastAirtimeDate?: string | null
    lastAirtimeDaysAgo?: number | null
  }
}

export interface CustomerFleetResult {
  success: boolean
  client?: {
    id: number
    email: string
    phoneNumber?: string
    devicesCount: number
  }
  vehicles: FleetTrackerDevice[]
  error?: string
}

export interface DirectTrackerSearchResult {
  success: boolean
  vehicles: FleetTrackerDevice[]
  totalFound: number
  error?: string
}

/**
 * Normalizes phone numbers extracted from GPSWOX/Car Tracker device records
 */
function cleanPhoneNumber(rawPhone: string): string {
  const digits = (rawPhone || "").replace(/[^0-9]/g, "")
  if (digits.startsWith("234") && digits.length >= 13) {
    return "0" + digits.slice(3)
  }
  if (digits.length === 10 && !digits.startsWith("0")) {
    return "0" + digits
  }
  return digits
}

/**
 * Fetches real-time online/offline connection telemetry for a specific GPS Wox tracker device.
 * Uses /get_devices_latest with target device id and time=1 for instant sub-second response (~5KB).
 */
async function fetchDeviceTelemetry(
  baseUrl: string,
  token: string,
  deviceId: number
): Promise<{
  online: "online" | "ack" | "offline" | "unknown"
  time: string | null
  speed: number | null
  stopDuration: string | null
}> {
  try {
    const res = await fetch(
      `${baseUrl}/get_devices_latest?lang=en&user_api_hash=${encodeURIComponent(token)}&id=${deviceId}&time=1`,
      { cache: "no-store" }
    )
    if (!res.ok) return { online: "unknown", time: null, speed: null, stopDuration: null }
    const data = await res.json()
    const it = data.items?.[0]
    if (!it) return { online: "unknown", time: null, speed: null, stopDuration: null }

    let onlineStatus: "online" | "ack" | "offline" = "offline"
    if (it.online === "online") onlineStatus = "online"
    else if (it.online === "ack") onlineStatus = "ack"
    else onlineStatus = "offline"

    return {
      online: onlineStatus,
      time: it.time || null,
      speed: typeof it.speed === "number" ? it.speed : null,
      stopDuration: it.stop_duration || null,
    }
  } catch (err) {
    return { online: "unknown", time: null, speed: null, stopDuration: null }
  }
}

/**
 * Enriches a CarTracker device record with local VTU database diagnostics and live telemetry
 */
async function enrichDeviceWithVtu(rawDev: any): Promise<FleetTrackerDevice> {
  const rawSimNumber = (rawDev.sim_number || "").trim()
  const normalizedPhone = cleanPhoneNumber(rawSimNumber)
  const detectedNet = normalizedPhone.length >= 10 ? detectNetwork(normalizedPhone) : null

  let vtuHistory: FleetTrackerDevice["vtuHistory"] = {
    hasRecord: false,
    statusBadge: "NEVER_LOADED",
  }

  if (normalizedPhone.length >= 10) {
    try {
      const diag = await checkSimHistory(normalizedPhone)
      if (diag?.lastData) {
        let statusBadge: FleetTrackerDevice["vtuHistory"]["statusBadge"] = "ACTIVE"
        if (diag.lastData.isExpired) {
          statusBadge = "EXPIRED"
        } else if (diag.lastData.isExpiringSoon) {
          statusBadge = "EXPIRING_SOON"
        }

        vtuHistory = {
          hasRecord: true,
          lastDataPlan: diag.lastData.plan,
          lastDataAmount: diag.lastData.amount,
          lastDataDate: diag.lastData.date,
          lastDataFormattedDate: diag.lastData.formattedDate,
          lastDataDaysAgo: diag.lastData.daysAgo,
          isExpired: diag.lastData.isExpired,
          isExpiringSoon: diag.lastData.isExpiringSoon,
          daysUntilExpiry: diag.lastData.daysUntilExpiry,
          statusBadge,
          lastAirtimeDate: diag.lastAirtime?.formattedDate || null,
          lastAirtimeDaysAgo: diag.lastAirtime?.daysAgo ?? null,
        }
      } else if (diag?.lastAirtime) {
        vtuHistory = {
          hasRecord: true,
          statusBadge: "NEVER_LOADED",
          lastAirtimeDate: diag.lastAirtime.formattedDate,
          lastAirtimeDaysAgo: diag.lastAirtime.daysAgo,
        }
      }
    } catch (err) {
      console.warn(`[enrichDeviceWithVtu] Failed to check VTU history for ${normalizedPhone}:`, err)
    }
  }

  const telemetry = rawDev.telemetry || {}
  const onlineStatus: FleetTrackerDevice["onlineStatus"] = telemetry.online || (rawDev.online ?? "unknown")
  const lastHeartbeat = telemetry.time || rawDev.time || null
  const speed = typeof telemetry.speed === "number" ? telemetry.speed : (typeof rawDev.speed === "number" ? rawDev.speed : null)
  const stopDuration = telemetry.stopDuration || rawDev.stop_duration || null

  return {
    id: rawDev.id,
    name: (rawDev.name || "Unnamed Vehicle").trim(),
    plateNumber: (rawDev.plate_number || "").trim(),
    imei: (rawDev.imei || "").trim(),
    rawSimNumber,
    normalizedPhone,
    network: detectedNet ? { id: detectedNet.id, name: detectedNet.name, color: detectedNet.color } : null,
    deviceModel: (rawDev.device_model || "").trim(),
    expirationDate: rawDev.expiration_date || null,
    protocol: (rawDev.protocol || "").trim(),
    active: Boolean(rawDev.active),
    onlineStatus,
    lastHeartbeat,
    speed,
    stopDuration,
    vtuHistory,
  }
}

/**
 * MODE A: Search Customer Fleet by Email
 */
export async function searchCustomerFleet(emailInput: string): Promise<CustomerFleetResult> {
  await requireUser()

  const email = (emailInput || "").trim().toLowerCase()
  if (!email || !email.includes("@")) {
    return { success: false, vehicles: [], error: "Please enter a valid customer email address." }
  }

  const { baseUrl } = getCarTrackerConfig()
  const token = await getCarTrackerApiHash()

  try {
    // 1. Search client by email
    const clientRes = await fetch(
      `${baseUrl}/admin/clients?lang=en&user_api_hash=${encodeURIComponent(token)}&search_phrase=${encodeURIComponent(email)}`,
      { cache: "no-store" }
    )

    if (!clientRes.ok) {
      throw new Error(`Car Tracker query failed with HTTP status ${clientRes.status}`)
    }

    const clientData = await clientRes.json()
    const clients: any[] = clientData?.data || []
    
    // Find exact or closest email match
    const matchedClient = clients.find((c) => c.email?.toLowerCase() === email) || clients[0]

    if (!matchedClient) {
      return {
        success: false,
        vehicles: [],
        error: `No customer account found with email "${email}" on Car Tracker Nigeria.`,
      }
    }

    // 2. Fetch the devices belonging to this customer
    const devListRes = await fetch(
      `${baseUrl}/admin/client/${matchedClient.id}/devices?lang=en&user_api_hash=${encodeURIComponent(token)}&limit=100`,
      { cache: "no-store" }
    )

    if (!devListRes.ok) {
      throw new Error(`Failed to load devices for client ID ${matchedClient.id}`)
    }

    const devListData = await devListRes.json()
    const devicesList: any[] = devListData?.data || []

    if (devicesList.length === 0) {
      return {
        success: true,
        client: {
          id: matchedClient.id,
          email: matchedClient.email,
          phoneNumber: matchedClient.phone_number || "",
          devicesCount: 0,
        },
        vehicles: [],
      }
    }

    // 3. For each device, fetch detailed attributes and live telemetry in parallel
    const fullDevices = await Promise.all(
      devicesList.map(async (d) => {
        try {
          const [singleRes, telemetry] = await Promise.all([
            fetch(
              `${baseUrl}/admin/device/${d.id}?lang=en&user_api_hash=${encodeURIComponent(token)}`,
              { cache: "no-store" }
            )
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
            fetchDeviceTelemetry(baseUrl, token, d.id),
          ])
          const devData = singleRes?.data || d
          return {
            ...devData,
            telemetry,
          }
        } catch (e) {
          return d
        }
      })
    )

    // 4. Enrich each device with local VTU database history
    const enrichedVehicles = await Promise.all(fullDevices.map(enrichDeviceWithVtu))

    // Sort: Expired first, then Expiring soon, then Never loaded, then Active
    const statusOrder: Record<string, number> = {
      EXPIRED: 1,
      EXPIRING_SOON: 2,
      NEVER_LOADED: 3,
      ACTIVE: 4,
    }
    enrichedVehicles.sort((a, b) => {
      const orderA = statusOrder[a.vtuHistory.statusBadge] || 5
      const orderB = statusOrder[b.vtuHistory.statusBadge] || 5
      return orderA - orderB
    })

    return {
      success: true,
      client: {
        id: matchedClient.id,
        email: matchedClient.email,
        phoneNumber: matchedClient.phone_number || "",
        devicesCount: enrichedVehicles.length,
      },
      vehicles: enrichedVehicles,
    }
  } catch (err: any) {
    console.error("[searchCustomerFleet] Error:", err)
    return {
      success: false,
      vehicles: [],
      error: err.message || "Failed to search customer fleet on Car Tracker Nigeria.",
    }
  }
}

/**
 * MODE B: Search Tracker directly by SIM number, IMEI, Vehicle Name, or Plate Number
 */
export async function searchDirectTrackers(queryInput: string): Promise<DirectTrackerSearchResult> {
  await requireUser()

  const rawQuery = (queryInput || "").trim()
  if (!rawQuery || rawQuery.length < 2) {
    return { success: false, vehicles: [], totalFound: 0, error: "Please enter at least 2 characters to search." }
  }

  const { baseUrl } = getCarTrackerConfig()
  const token = await getCarTrackerApiHash()

  try {
    // 1. Query /admin/devices?s=...
    let searchRes = await fetch(
      `${baseUrl}/admin/devices?lang=en&user_api_hash=${encodeURIComponent(token)}&s=${encodeURIComponent(rawQuery)}&limit=30`,
      { cache: "no-store" }
    )

    let devData = await searchRes.json()
    let items: any[] = devData?.data || []

    // If no items found and query looks like a phone number without spaces (e.g. 07078172145),
    // try searching with standard 4-3-4 space formatting (0707 817 2145) or last 7 digits
    if (items.length === 0 && /^\d{10,11}$/.test(rawQuery)) {
      const digits = rawQuery
      const spacedVariant = `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
      const lastDigits = digits.slice(-7)

      const fallbackRes = await fetch(
        `${baseUrl}/admin/devices?lang=en&user_api_hash=${encodeURIComponent(token)}&s=${encodeURIComponent(spacedVariant)}&limit=30`,
        { cache: "no-store" }
      )
      const fallbackData = await fallbackRes.json()
      items = fallbackData?.data || []

      if (items.length === 0 && lastDigits.length === 7) {
        const lastRes = await fetch(
          `${baseUrl}/admin/devices?lang=en&user_api_hash=${encodeURIComponent(token)}&s=${encodeURIComponent(lastDigits)}&limit=30`,
          { cache: "no-store" }
        )
        const lastData = await lastRes.json()
        items = lastData?.data || []
      }
    }

    if (items.length === 0) {
      return {
        success: true,
        vehicles: [],
        totalFound: 0,
      }
    }

    // 2. Fetch live connection telemetry in parallel for each matching tracker
    const itemsWithTelemetry = await Promise.all(
      items.map(async (d) => {
        try {
          const telemetry = await fetchDeviceTelemetry(baseUrl, token, d.id)
          return {
            ...d,
            telemetry,
          }
        } catch (e) {
          return d
        }
      })
    )

    // 3. Enrich each matching device with local VTU history and telemetry
    const enrichedVehicles = await Promise.all(itemsWithTelemetry.map(enrichDeviceWithVtu))

    return {
      success: true,
      vehicles: enrichedVehicles,
      totalFound: devData?.pagination?.total || enrichedVehicles.length,
    }
  } catch (err: any) {
    console.error("[searchDirectTrackers] Error:", err)
    return {
      success: false,
      vehicles: [],
      totalFound: 0,
      error: err.message || "Failed to search tracker on Car Tracker Nigeria.",
    }
  }
}

export interface RechargeFleetPayload {
  vehicles: Array<{
    id: number
    name: string
    plateNumber?: string
    phone: string
    networkId: string
    imei?: string
  }>
  dataPlanId: string
  planName: string
  amount: number
  validityDays?: number
  serverId?: string
}

export interface RechargeFleetResult {
  success: boolean
  totalAttempted: number
  successCount: number
  failureCount: number
  results: Array<{
    vehicleId: number
    vehicleName: string
    phone: string
    status: "SUCCESS" | "FAILED"
    message?: string
    reference?: string
  }>
  newWalletBalance: number
  error?: string
}

/**
 * Dispenses data to selected fleet vehicles in bulk or individually
 */
export async function rechargeFleetVehicles(payload: RechargeFleetPayload): Promise<RechargeFleetResult> {
  const user = await requireUser()

  if (!payload.vehicles || payload.vehicles.length === 0) {
    return {
      success: false,
      totalAttempted: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      newWalletBalance: 0,
      error: "No vehicles selected for recharge.",
    }
  }

  const totalCost = payload.amount * payload.vehicles.length
  const userAccount = await prisma.user.findUnique({
    where: { id: user.id },
    select: { walletBalance: true },
  })

  const currentBalance = userAccount?.walletBalance || 0
  if (currentBalance < totalCost) {
    return {
      success: false,
      totalAttempted: payload.vehicles.length,
      successCount: 0,
      failureCount: 0,
      results: [],
      newWalletBalance: currentBalance,
      error: `Insufficient wallet balance. Total cost is ₦${totalCost.toLocaleString()}, but your balance is ₦${currentBalance.toLocaleString()}. Please fund your wallet.`,
    }
  }

  const results: RechargeFleetResult["results"] = []
  let successCount = 0
  let failureCount = 0

  for (const v of payload.vehicles) {
    try {
      const cleanPhone = cleanPhoneNumber(v.phone)
      if (cleanPhone.length < 10) {
        throw new Error("Invalid tracker phone number.")
      }

      // Execute data purchase via resilient VTU engine with SIM bypass (ported SIMs supported)
      const purchaseRes = await purchaseData(
        user.id,
        v.networkId,
        payload.dataPlanId,
        cleanPhone,
        payload.amount,
        {
          serverId: payload.serverId,
          planName: payload.planName,
          validityDays: payload.validityDays || extractValidityDays(payload.planName, 30),
          bypassSimCheck: true,
        }
      )

      results.push({
        vehicleId: v.id,
        vehicleName: v.name,
        phone: cleanPhone,
        status: "SUCCESS",
        reference: purchaseRes.reference,
        message: "Data dispensed successfully.",
      })
      successCount++
    } catch (err: any) {
      console.error(`[rechargeFleetVehicles] Failed for ${v.name} (${v.phone}):`, err)
      results.push({
        vehicleId: v.id,
        vehicleName: v.name,
        phone: v.phone,
        status: "FAILED",
        message: err.message || "Failed to dispense data.",
      })
      failureCount++
    }
  }

  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { walletBalance: true },
  })

  revalidatePath("/fleet")
  revalidatePath("/trackers")
  revalidatePath("/transactions")
  revalidatePath("/dashboard")

  return {
    success: successCount > 0,
    totalAttempted: payload.vehicles.length,
    successCount,
    failureCount,
    results,
    newWalletBalance: updatedUser?.walletBalance || 0,
  }
}
