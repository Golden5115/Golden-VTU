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

export interface DeviceLiveStatusResult {
  success: boolean
  cartrackerId: number
  onlineStatus: "online" | "ack" | "offline" | "unknown"
  isOnline: boolean
  time: string | null
  speed: number | null
  stopDuration: string | null
  message: string
}

/**
 * Checks real-time connection status for a single vehicle directly from CarTracker (~200ms).
 * If the vehicle is now online, it automatically cleans it out of the local OfflineVehicle database.
 */
export async function verifyDeviceLiveStatus(cartrackerId: number): Promise<DeviceLiveStatusResult> {
  await requireUser()

  try {
    const { baseUrl } = getCarTrackerConfig()
    const token = await getCarTrackerApiHash()

    const telemetry = await fetchDeviceTelemetry(baseUrl, token, cartrackerId)
    const isOnline = telemetry.online === "online" || telemetry.online === "ack"

    if (isOnline) {
      await prisma.offlineVehicle.deleteMany({
        where: { cartrackerId },
      }).catch(() => {})
      cachedSummaryMemory = null
    } else if (telemetry.time) {
      const lastHeartbeat = parseCarTrackerDate(telemetry.time)
      const daysOffline = computeDaysOffline(lastHeartbeat, telemetry.time)
      await prisma.offlineVehicle.updateMany({
        where: { cartrackerId },
        data: {
          lastHeartbeat,
          daysOffline,
          speed: telemetry.speed || 0,
          stopDuration: telemetry.stopDuration || "",
          lastSyncAt: new Date(),
        },
      }).catch(() => {})
    }

    return {
      success: true,
      cartrackerId,
      onlineStatus: telemetry.online,
      isOnline,
      time: telemetry.time,
      speed: telemetry.speed,
      stopDuration: telemetry.stopDuration,
      message: isOnline
        ? `Vehicle is currently ONLINE (${telemetry.online.toUpperCase()})! Connected: ${telemetry.time || "Just now"}`
        : `Vehicle is confirmed OFFLINE. Last heartbeat: ${telemetry.time || "No signal"}`,
    }
  } catch (err: any) {
    return {
      success: false,
      cartrackerId,
      onlineStatus: "unknown",
      isOnline: false,
      time: null,
      speed: null,
      stopDuration: null,
      message: err.message || "Failed to verify live device status.",
    }
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

    // 2. Fetch all devices belonging to this customer (auto-paginated up to 1,000/page)
    let devicesList: any[] = []
    let page = 1
    const perPageLimit = 1000

    while (true) {
      const devListRes = await fetch(
        `${baseUrl}/admin/client/${matchedClient.id}/devices?lang=en&user_api_hash=${encodeURIComponent(token)}&page=${page}&limit=${perPageLimit}`,
        { cache: "no-store" }
      )

      if (!devListRes.ok) {
        throw new Error(`Failed to load devices for client ID ${matchedClient.id}`)
      }

      const devListData = await devListRes.json()
      const batch: any[] = devListData?.data || []
      devicesList.push(...batch)

      const lastPage = devListData?.pagination?.last_page || 1
      if (page >= lastPage || batch.length < perPageLimit) {
        break
      }
      page++
    }

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

    // 3. For each device, fetch detailed attributes and live telemetry in concurrency-controlled chunks
    const fullDevices: any[] = []
    const CHUNK_SIZE = 25
    for (let i = 0; i < devicesList.length; i += CHUNK_SIZE) {
      const chunk = devicesList.slice(i, i + CHUNK_SIZE)
      const chunkResults = await Promise.all(
        chunk.map(async (d) => {
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
      fullDevices.push(...chunkResults)
    }

    // 4. Enrich each device with local VTU database history in safe chunks
    const enrichedVehicles: FleetTrackerDevice[] = []
    for (let i = 0; i < fullDevices.length; i += CHUNK_SIZE) {
      const chunk = fullDevices.slice(i, i + CHUNK_SIZE)
      const res = await Promise.all(chunk.map(enrichDeviceWithVtu))
      enrichedVehicles.push(...res)
    }

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

/**
 * =========================================================================
 * 10,000+ OFFLINE VEHICLES RESILIENT SYNC & TROUBLESHOOT ACTIONS
 * =========================================================================
 */

function parseCarTrackerDate(timeStr?: string | null, timestamp?: number | null): Date | null {
  if (timestamp && timestamp > 0) {
    return new Date(timestamp * 1000)
  }
  if (!timeStr || typeof timeStr !== "string") return null
  const s = timeStr.trim()
  if (s === "Expired" || s === "Disabled" || s === "-" || s === "0000-00-00 00:00:00") {
    return null
  }

  // Format: "DD-MM-YYYY hh:mm:ss A" e.g. "24-01-2024 12:22:49 AM"
  const dmyMatch = s.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i)
  if (dmyMatch) {
    const [, d, m, y, h, min, sec, ampm] = dmyMatch
    let hour = parseInt(h, 10)
    if (ampm) {
      if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12
      if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0
    }
    const dt = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), hour, parseInt(min, 10), parseInt(sec, 10)))
    if (!isNaN(dt.getTime())) return dt
  }

  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed

  return null
}

function computeDaysOffline(lastHeartbeat: Date | null, timeStr?: string | null): number {
  if (lastHeartbeat) {
    const diffMs = Date.now() - lastHeartbeat.getTime()
    return Math.max(0, Math.floor(diffMs / 86400000))
  }
  if (timeStr === "Expired" || timeStr === "Disabled") {
    return 180
  }
  return 999
}

export interface OfflineSyncBatchResult {
  success: boolean
  page: number
  batchItemsCount: number
  offlineInBatch: number
  totalSyncedSoFar: number
  isDone: boolean
  error?: string
}

/**
 * Checks if a vehicle's tracking subscription or account has expired on CarTracker Nigeria.
 * Expired vehicles are excluded from offline troubleshooting syncs.
 */
function isCarTrackerVehicleExpired(item: any): boolean {
  // 1. Time field: CarTracker explicitly sets item.time = "Expired" or "Disabled" when tracking license is expired
  const time = (item.time || "").trim().toLowerCase()
  if (time === "expired" || time === "disabled") return true

  // 2. device_data active flag
  const devData = item.device_data || {}
  if (devData.active === 0 || devData.active === false) return true

  // 3. Expiration date: Check if device_data.expiration_date is in the past
  const expDateStr = devData.expiration_date
  if (expDateStr && typeof expDateStr === "string") {
    const expDate = new Date(expDateStr.replace(" ", "T"))
    if (!isNaN(expDate.getTime()) && expDate.getTime() < Date.now()) {
      return true
    }
  }

  return false
}

/**
 * Synchronizes one chunk/batch of offline devices from CarTracker Nigeria into local PostgreSQL.
 * Runs in safe 500-device batches so the database connection pool is never overwhelmed.
 * Only pulls vehicles that are NOT expired and are currently offline.
 */
export async function syncOfflineVehiclesBatch(
  page: number = 1,
  limit: number = 500,
  isSystem: boolean = false
): Promise<OfflineSyncBatchResult> {
  if (!isSystem) {
    await requireUser()
  }

  try {
    if (!(prisma as any).offlineVehicle) {
      return {
        success: false,
        page,
        batchItemsCount: 0,
        offlineInBatch: 0,
        totalSyncedSoFar: 0,
        isDone: true,
        error: "Offline vehicle database model is initializing. Please retry in a few seconds.",
      }
    }

    const { baseUrl } = getCarTrackerConfig()
    const token = await getCarTrackerApiHash()

    const res = await fetch(
      `${baseUrl}/get_devices_latest?lang=en&user_api_hash=${encodeURIComponent(token)}&time=1&page=${page}&limit=${limit}`,
      { cache: "no-store" }
    )

    if (!res.ok) {
      throw new Error(`CarTracker API responded with HTTP ${res.status}`)
    }

    const data = await res.json()
    const items: any[] = data.items || []

    if (items.length === 0) {
      const totalInDb = await prisma.offlineVehicle.count()
      return {
        success: true,
        page,
        batchItemsCount: 0,
        offlineInBatch: 0,
        totalSyncedSoFar: totalInDb,
        isDone: true,
      }
    }

    // Prune devices in this batch that are online or expired from local offline database
    const idsToPrune = items
      .filter((x) => x.online !== "offline" || isCarTrackerVehicleExpired(x))
      .map((x) => Number(x.id))

    if (idsToPrune.length > 0) {
      await prisma.offlineVehicle.deleteMany({
        where: { cartrackerId: { in: idsToPrune } },
      }).catch(() => {})
    }

    // Filter ONLY offline devices that have NOT expired
    const offlineItems = items.filter((x) => x.online === "offline" && !isCarTrackerVehicleExpired(x))

    // Extract all valid normalized phone numbers in this batch
    const phoneList: string[] = []
    const devMap = new Map<number, { normalizedPhone: string; rawSim: string; devData: any }>()

    for (const item of offlineItems) {
      const devData = item.device_data || {}
      const rawSim = (devData.sim_number || "").trim()
      const normalizedPhone = cleanPhoneNumber(rawSim)
      if (normalizedPhone.length >= 10) {
        phoneList.push(normalizedPhone)
      }
      devMap.set(item.id, { normalizedPhone, rawSim, devData })
    }

    // Single indexed query to fetch local VTU data purchases for all phones in this batch
    const uniquePhones = Array.from(new Set(phoneList))
    const recentDataPurchases = uniquePhones.length > 0
      ? await prisma.dataPurchase.findMany({
          where: { phone: { in: uniquePhones } },
          orderBy: { createdAt: "desc" },
          select: {
            phone: true,
            plan: true,
            amount: true,
            createdAt: true,
            status: true,
            serverId: true,
            serverName: true,
            provider: true,
          },
        })
      : []

    // Map each phone to its latest data purchase
    const latestDataByPhone = new Map<string, (typeof recentDataPurchases)[0]>()
    for (const p of recentDataPurchases) {
      if (!latestDataByPhone.has(p.phone)) {
        latestDataByPhone.set(p.phone, p)
      }
    }

    // Build upsert payload for offline vehicles
    const recordsToUpsert = offlineItems.map((item) => {
      const { normalizedPhone, rawSim, devData } = devMap.get(item.id) || {
        normalizedPhone: "",
        rawSim: "",
        devData: {},
      }

      const cartrackerId = Number(item.id)
      const name = (item.name || "").trim() || "Unnamed Vehicle"
      const plateNumber = (devData.plate_number || "").trim()
      const imei = (devData.imei || "").trim()
      const detectedNet = normalizedPhone.length >= 10 ? detectNetwork(normalizedPhone) : null
      const network = detectedNet?.name || null
      const deviceModel = (devData.device_model || "").trim()
      const protocol = (item.protocol || "").trim()
      const speed = typeof item.speed === "number" ? item.speed : 0
      const stopDuration = item.stop_duration || ""
      const lastHeartbeat = parseCarTrackerDate(item.time, item.timestamp)
      const daysOffline = computeDaysOffline(lastHeartbeat, item.time)

      const lastData = normalizedPhone ? latestDataByPhone.get(normalizedPhone) : null
      let hasVtuRecord = false
      let lastDataPlan: string | null = null
      let lastDataAmount: number | null = null
      let lastDataDate: Date | null = null
      let dataExpiryDate: Date | null = null
      let vtuStatus = "NEVER_LOADED"

      if (lastData) {
        hasVtuRecord = true
        lastDataPlan = lastData.plan
        lastDataAmount = lastData.amount
        lastDataDate = lastData.createdAt
        const daysAgo = Math.floor((Date.now() - lastData.createdAt.getTime()) / 86400000)

        const isServer1 =
          lastData.serverId === "server1" ||
          lastData.serverId === "cmrj56y3d0000hkn50a4bcy77" ||
          lastData.provider?.toLowerCase().includes("clubkonnect") ||
          lastData.serverName?.toLowerCase().includes("clubkonnect") ||
          lastData.serverName?.toLowerCase().includes("server 1")

        // Server 1 (ClubKonnect) data only lasts 7 days; Server 2 / others get normal validity (30 days)
        const validityDays = isServer1 ? 7 : extractValidityDays(lastData.plan, 30)
        dataExpiryDate = new Date(lastData.createdAt.getTime() + validityDays * 86400000)
        if (daysAgo >= validityDays) {
          vtuStatus = "EXPIRED"
        } else if (validityDays - daysAgo <= (isServer1 ? 2 : 3)) {
          vtuStatus = "EXPIRING_SOON"
        } else {
          vtuStatus = "ACTIVE"
        }
      }

      return {
        cartrackerId,
        name,
        plateNumber,
        imei,
        rawSimNumber: rawSim,
        normalizedPhone,
        network,
        deviceModel,
        protocol,
        speed,
        stopDuration,
        lastHeartbeat,
        daysOffline,
        hasVtuRecord,
        lastDataPlan,
        lastDataAmount,
        lastDataDate,
        dataExpiryDate,
        vtuStatus,
        lastSyncAt: new Date(),
      }
    })

    // Upsert in safe concurrent sub-chunks of 20 without interactive transactions (eliminates 5s transaction timeout)
    const CHUNK_SIZE = 20
    for (let i = 0; i < recordsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = recordsToUpsert.slice(i, i + CHUNK_SIZE)
      await Promise.all(
        chunk.map((rec) =>
          prisma.offlineVehicle
            .upsert({
              where: { cartrackerId: rec.cartrackerId },
              create: rec,
              update: {
                name: rec.name,
                plateNumber: rec.plateNumber,
                imei: rec.imei,
                rawSimNumber: rec.rawSimNumber,
                normalizedPhone: rec.normalizedPhone,
                network: rec.network,
                deviceModel: rec.deviceModel,
                protocol: rec.protocol,
                speed: rec.speed,
                stopDuration: rec.stopDuration,
                lastHeartbeat: rec.lastHeartbeat,
                daysOffline: rec.daysOffline,
                hasVtuRecord: rec.hasVtuRecord,
                lastDataPlan: rec.lastDataPlan,
                lastDataAmount: rec.lastDataAmount,
                lastDataDate: rec.lastDataDate,
                dataExpiryDate: rec.dataExpiryDate,
                vtuStatus: rec.vtuStatus,
                lastSyncAt: rec.lastSyncAt,
              },
            })
            .catch((err: any) => {
              console.warn(`[syncOfflineVehiclesBatch] Skipped device #${rec.cartrackerId} due to error:`, err?.message || err)
            })
        )
      )
    }

    cachedSummaryMemory = null
    const totalInDb = await prisma.offlineVehicle.count()

    return {
      success: true,
      page,
      batchItemsCount: items.length,
      offlineInBatch: offlineItems.length,
      totalSyncedSoFar: totalInDb,
      isDone: items.length < limit,
    }
  } catch (err: any) {
    console.error(`[syncOfflineVehiclesBatch] Error on page ${page}:`, err)
    return {
      success: false,
      page,
      batchItemsCount: 0,
      offlineInBatch: 0,
      totalSyncedSoFar: 0,
      isDone: true,
      error: err.message || "Failed to sync offline vehicles batch.",
    }
  }
}

export interface GetOfflineVehiclesParams {
  page?: number
  limit?: number
  search?: string
  daysOfflineFilter?: string
  vtuStatusFilter?: string
  networkFilter?: string
  sortBy?: "daysOffline_desc" | "daysOffline_asc" | "lastHeartbeat_desc" | "lastHeartbeat_asc" | "plate_asc" | "plate_desc"
}

export interface GetOfflineVehiclesResult {
  success: boolean
  vehicles: Array<{
    id: string
    cartrackerId: number
    name: string
    plateNumber: string
    imei: string
    rawSimNumber: string
    normalizedPhone: string
    network: string | null
    deviceModel: string | null
    protocol: string | null
    speed: number | null
    stopDuration: string | null
    lastHeartbeat: string | null
    daysOffline: number
    hasVtuRecord: boolean
    lastDataPlan: string | null
    lastDataAmount: number | null
    lastDataDate: string | null
    dataExpiryDate: string | null
    vtuStatus: "EXPIRED" | "EXPIRING_SOON" | "ACTIVE" | "NEVER_LOADED"
    lastAirtimeDate: string | null
    lastSyncAt: string
  }>
  total: number
  page: number
  totalPages: number
  summary: {
    totalOffline: number
    criticalCount: number
    expiredCount: number
    neverLoadedCount: number
    activeCount: number
    lastSyncAt: string | null
  }
  error?: string
}

let cachedSummaryMemory: {
  totalOffline: number
  criticalCount: number
  expiredCount: number
  neverLoadedCount: number
  activeCount: number
  lastSyncAt: string | null
  expiresAt: number
} | null = null

/**
 * High-performance paginated query directly against local indexed PostgreSQL.
 * Resolves within ~10ms even with 10,000+ cached vehicles.
 */
export async function getOfflineVehicles(params: GetOfflineVehiclesParams = {}): Promise<GetOfflineVehiclesResult> {
  await requireUser()

  try {
    if (!(prisma as any).offlineVehicle) {
      console.warn("[getOfflineVehicles] offlineVehicle model not loaded on current prisma client.")
      return {
        success: false,
        vehicles: [],
        total: 0,
        page: 1,
        totalPages: 1,
        summary: {
          totalOffline: 0,
          criticalCount: 0,
          expiredCount: 0,
          neverLoadedCount: 0,
          activeCount: 0,
          lastSyncAt: null,
        },
        error: "Offline fleet model is refreshing. Please reload the page.",
      }
    }

    const page = Math.max(1, params.page || 1)
    const limit = Math.min(100, Math.max(10, params.limit || 50))
    const skip = (page - 1) * limit

    const where: any = {}

    // Days offline filter
    if (params.daysOfflineFilter && params.daysOfflineFilter !== "all") {
      if (params.daysOfflineFilter === "90+") {
        where.daysOffline = { gte: 90 }
      } else if (params.daysOfflineFilter === "30-90") {
        where.daysOffline = { gte: 30, lt: 90 }
      } else if (params.daysOfflineFilter === "7-30") {
        where.daysOffline = { gte: 7, lt: 30 }
      } else if (params.daysOfflineFilter === "1-7") {
        where.daysOffline = { gte: 1, lt: 7 }
      } else if (params.daysOfflineFilter === "<1" || params.daysOfflineFilter === "0") {
        where.daysOffline = { lte: 0 }
      }
    }

    // VTU status filter
    if (params.vtuStatusFilter && params.vtuStatusFilter !== "all") {
      where.vtuStatus = params.vtuStatusFilter
    }

    // Network filter (case-insensitive)
    if (params.networkFilter && params.networkFilter !== "all") {
      where.network = { equals: params.networkFilter, mode: "insensitive" }
    }

    // Search phrase
    const rawSearch = (params.search || "").trim()
    if (rawSearch) {
      where.OR = [
        { name: { contains: rawSearch, mode: "insensitive" } },
        { plateNumber: { contains: rawSearch, mode: "insensitive" } },
        { imei: { contains: rawSearch } },
        { normalizedPhone: { contains: rawSearch } },
        { rawSimNumber: { contains: rawSearch } },
      ]
    }

    // Sorting
    let orderBy: any = { daysOffline: "desc" }
    if (params.sortBy === "daysOffline_asc") {
      orderBy = { daysOffline: "asc" }
    } else if (params.sortBy === "daysOffline_desc") {
      orderBy = { daysOffline: "desc" }
    } else if (params.sortBy === "lastHeartbeat_desc") {
      orderBy = { lastHeartbeat: { sort: "desc", nulls: "last" } }
    } else if (params.sortBy === "lastHeartbeat_asc") {
      orderBy = { lastHeartbeat: { sort: "asc", nulls: "last" } }
    } else if (params.sortBy === "plate_asc") {
      orderBy = { plateNumber: "asc" }
    } else if (params.sortBy === "plate_desc") {
      orderBy = { plateNumber: "desc" }
    }

    // -------------------------------------------------------------
    // DB QUOTA OPTIMIZATION: Cache summary metrics for 10 minutes
    // Reduces queries from 8 to 2 on every page turn / search filter
    // -------------------------------------------------------------
    let summaryData: {
      totalOffline: number
      criticalCount: number
      expiredCount: number
      neverLoadedCount: number
      activeCount: number
      lastSyncAt: string | null
    }

    if (cachedSummaryMemory && cachedSummaryMemory.expiresAt > Date.now()) {
      summaryData = cachedSummaryMemory
    } else {
      try {
        const rawRes: any[] = await prisma.$queryRaw`
          SELECT 
            COUNT(*)::int as "totalOffline",
            COUNT(*) FILTER (WHERE "daysOffline" >= 30)::int as "criticalCount",
            COUNT(*) FILTER (WHERE "vtuStatus" = 'EXPIRED')::int as "expiredCount",
            COUNT(*) FILTER (WHERE "vtuStatus" = 'NEVER_LOADED')::int as "neverLoadedCount",
            COUNT(*) FILTER (WHERE "vtuStatus" = 'ACTIVE')::int as "activeCount",
            MAX("lastSyncAt") as "lastSyncAt"
          FROM "OfflineVehicle"
        `
        const r = rawRes?.[0] || {}
        summaryData = {
          totalOffline: Number(r.totalOffline || 0),
          criticalCount: Number(r.criticalCount || 0),
          expiredCount: Number(r.expiredCount || 0),
          neverLoadedCount: Number(r.neverLoadedCount || 0),
          activeCount: Number(r.activeCount || 0),
          lastSyncAt: r.lastSyncAt ? new Date(r.lastSyncAt).toISOString() : null,
        }
        cachedSummaryMemory = {
          ...summaryData,
          expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        }
      } catch (rawErr) {
        // Fallback to separate count queries only if raw query is unsupported
        const [totalOffline, criticalCount, expiredCount, neverLoadedCount, activeCount, latestSyncRecord] =
          await Promise.all([
            prisma.offlineVehicle.count(),
            prisma.offlineVehicle.count({ where: { daysOffline: { gte: 30 } } }),
            prisma.offlineVehicle.count({ where: { vtuStatus: "EXPIRED" } }),
            prisma.offlineVehicle.count({ where: { vtuStatus: "NEVER_LOADED" } }),
            prisma.offlineVehicle.count({ where: { vtuStatus: "ACTIVE" } }),
            prisma.offlineVehicle.findFirst({ select: { lastSyncAt: true }, orderBy: { lastSyncAt: "desc" } }),
          ])
        summaryData = {
          totalOffline,
          criticalCount,
          expiredCount,
          neverLoadedCount,
          activeCount,
          lastSyncAt: latestSyncRecord?.lastSyncAt ? latestSyncRecord.lastSyncAt.toISOString() : null,
        }
        cachedSummaryMemory = {
          ...summaryData,
          expiresAt: Date.now() + 10 * 60 * 1000,
        }
      }
    }

    // Execute only the active page and filtered total (only 2 operations!)
    const [vehicles, total] = await Promise.all([
      prisma.offlineVehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      prisma.offlineVehicle.count({ where }),
    ])

    const formattedVehicles = vehicles.map((v) => ({
      id: v.id,
      cartrackerId: v.cartrackerId,
      name: v.name,
      plateNumber: v.plateNumber,
      imei: v.imei,
      rawSimNumber: v.rawSimNumber,
      normalizedPhone: v.normalizedPhone,
      network: v.network,
      deviceModel: v.deviceModel,
      protocol: v.protocol,
      speed: v.speed,
      stopDuration: v.stopDuration,
      lastHeartbeat: v.lastHeartbeat ? v.lastHeartbeat.toISOString() : null,
      daysOffline: v.daysOffline,
      hasVtuRecord: v.hasVtuRecord,
      lastDataPlan: v.lastDataPlan,
      lastDataAmount: v.lastDataAmount,
      lastDataDate: v.lastDataDate ? v.lastDataDate.toISOString() : null,
      dataExpiryDate: v.dataExpiryDate ? v.dataExpiryDate.toISOString() : null,
      vtuStatus: v.vtuStatus as "EXPIRED" | "EXPIRING_SOON" | "ACTIVE" | "NEVER_LOADED",
      lastAirtimeDate: v.lastAirtimeDate ? v.lastAirtimeDate.toISOString() : null,
      lastSyncAt: v.lastSyncAt.toISOString(),
    }))

    return {
      success: true,
      vehicles: formattedVehicles,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary: summaryData,
    }
  } catch (err: any) {
    console.error("[getOfflineVehicles] Query error:", err)
    return {
      success: false,
      vehicles: [],
      total: 0,
      page: 1,
      totalPages: 1,
      summary: {
        totalOffline: 0,
        criticalCount: 0,
        expiredCount: 0,
        neverLoadedCount: 0,
        activeCount: 0,
        lastSyncAt: null,
      },
      error: err.message || "Failed to load offline vehicles.",
    }
  }
}

export interface RechargeSingleVehiclePayload {
  vehicleId: number
  vehicleName: string
  phone: string
  networkId: string
  dataPlanId: string
  planName: string
  amount: number
  validityDays?: number
  serverId?: string
}

export interface RechargeSingleVehicleResult {
  success: boolean
  reference?: string
  newWalletBalance: number
  message?: string
  error?: string
}

/**
 * Recharges a single individual vehicle.
 * Bulk recharge has been removed per explicit directive; all recharges are performed per vehicle.
 */
export async function rechargeSingleVehicle(payload: RechargeSingleVehiclePayload): Promise<RechargeSingleVehicleResult> {
  const user = await requireUser()

  const cleanPhone = cleanPhoneNumber(payload.phone)
  if (cleanPhone.length < 10) {
    return {
      success: false,
      newWalletBalance: 0,
      error: "Invalid vehicle tracker SIM phone number.",
    }
  }

  const userAccount = await prisma.user.findUnique({
    where: { id: user.id },
    select: { walletBalance: true },
  })

  const currentBalance = userAccount?.walletBalance || 0
  if (currentBalance < payload.amount) {
    return {
      success: false,
      newWalletBalance: currentBalance,
      error: `Insufficient wallet balance. Required: ₦${payload.amount.toLocaleString()}, Balance: ₦${currentBalance.toLocaleString()}. Please fund your wallet.`,
    }
  }

  try {
    const validityDays = payload.validityDays || extractValidityDays(payload.planName, 30)

    const purchaseRes = await purchaseData(
      user.id,
      payload.networkId,
      payload.dataPlanId,
      cleanPhone,
      payload.amount,
      {
        serverId: payload.serverId,
        planName: payload.planName,
        validityDays,
        bypassSimCheck: true,
      }
    )

    // Update local OfflineVehicle cached status for this vehicle
    const expiryDate = new Date(Date.now() + validityDays * 86400000)
    await prisma.offlineVehicle.updateMany({
      where: {
        OR: [
          { cartrackerId: payload.vehicleId },
          { normalizedPhone: cleanPhone },
        ],
      },
      data: {
        vtuStatus: "ACTIVE",
        lastDataPlan: payload.planName,
        lastDataAmount: payload.amount,
        lastDataDate: new Date(),
        dataExpiryDate: expiryDate,
        hasVtuRecord: true,
      },
    })

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { walletBalance: true },
    })

    revalidatePath("/fleet")
    revalidatePath("/trackers")
    revalidatePath("/transactions")
    revalidatePath("/dashboard")

    return {
      success: true,
      reference: purchaseRes.reference,
      newWalletBalance: updatedUser?.walletBalance || 0,
      message: `Successfully dispensed ${payload.planName} to ${payload.vehicleName} (${cleanPhone}).`,
    }
  } catch (err: any) {
    console.error(`[rechargeSingleVehicle] Failed for vehicle ${payload.vehicleName}:`, err)
    return {
      success: false,
      newWalletBalance: currentBalance,
      error: err.message || "Failed to dispense data to vehicle.",
    }
  }
}

