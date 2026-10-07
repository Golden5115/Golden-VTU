"use server"

import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { purchaseAirtime, purchaseData } from "@/services/vtu.service"

async function requireUser(): Promise<{ id: string; email?: string | null; name?: string | null; role?: string }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized. Please log in.")
  return session.user as { id: string; email?: string | null; name?: string | null; role?: string }
}

import {
  computeTrackerDiagnostics,
  type EnrichedTracker,
  type TrackerHealthStatus,
} from "@/lib/tracker-utils"

export async function getTrackers(filters?: {
  search?: string
  status?: string
  network?: string
}) {
  const user = await requireUser()

  const whereClause: any = {
    userId: user.id,
  }

  if (filters?.network && filters.network !== "ALL") {
    whereClause.network = filters.network
  }

  if (filters?.search) {
    const s = filters.search.trim()
    whereClause.OR = [
      { plateNumber: { contains: s, mode: "insensitive" } },
      { vehicleName: { contains: s, mode: "insensitive" } },
      { simNumber: { contains: s } },
      { imei: { contains: s } },
      { clientName: { contains: s, mode: "insensitive" } },
    ]
  }

  const rawTrackers = await prisma.vehicleTracker.findMany({
    where: whereClause,
    orderBy: [
      { dataExpiryDate: "asc" }, // Put expired and soon-expiring on top for troubleshooting
      { createdAt: "desc" },
    ],
  })

  let enriched = rawTrackers.map(computeTrackerDiagnostics)

  // Filter by computed status if requested
  if (filters?.status && filters.status !== "ALL") {
    enriched = enriched.filter((t) => t.dataStatus === filters.status)
  }

  // Calculate fleet summaries
  const allTrackers = rawTrackers.map(computeTrackerDiagnostics)
  const total = allTrackers.length
  const active = allTrackers.filter((t) => t.dataStatus === "ACTIVE").length
  const expiringSoon = allTrackers.filter((t) => t.dataStatus === "EXPIRING_SOON").length
  const expired = allTrackers.filter((t) => t.dataStatus === "EXPIRED").length
  const neverRecharged = allTrackers.filter((t) => t.dataStatus === "NEVER_TOPPED_UP").length
  const needsAirtimeCount = allTrackers.filter((t) => t.needsAirtime).length

  return {
    trackers: enriched,
    metrics: {
      total,
      active,
      expiringSoon,
      expired,
      neverRecharged,
      needsAirtimeCount,
    },
  }
}

export async function getTrackerById(trackerId: string) {
  const user = await requireUser()

  const tracker = await prisma.vehicleTracker.findFirst({
    where: { id: trackerId, userId: user.id },
    include: {
      airtimePurchases: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      dataPurchases: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  })

  if (!tracker) return null

  return {
    ...computeTrackerDiagnostics(tracker),
    airtimePurchases: tracker.airtimePurchases,
    dataPurchases: tracker.dataPurchases,
  }
}

export async function createTracker(data: {
  vehicleName: string
  plateNumber: string
  simNumber: string
  network: string
  deviceModel?: string
  imei?: string
  clientName?: string
  clientPhone?: string
  notes?: string
}) {
  const user = await requireUser()

  // Clean phone number
  let phone = data.simNumber.replace(/[^0-9]/g, "")
  if (phone.startsWith("234")) {
    phone = "0" + phone.slice(3)
  }

  const tracker = await prisma.vehicleTracker.create({
    data: {
      userId: user.id,
      vehicleName: data.vehicleName.trim(),
      plateNumber: data.plateNumber.trim().toUpperCase(),
      simNumber: phone,
      network: data.network,
      deviceModel: data.deviceModel?.trim() || null,
      imei: data.imei?.trim() || null,
      clientName: data.clientName?.trim() || null,
      clientPhone: data.clientPhone?.trim() || null,
      notes: data.notes?.trim() || null,
      status: "ACTIVE",
    },
  })

  revalidatePath("/trackers")
  revalidatePath("/dashboard")
  return { success: true, tracker }
}

export async function updateTracker(
  trackerId: string,
  data: {
    vehicleName?: string
    plateNumber?: string
    simNumber?: string
    network?: string
    deviceModel?: string
    imei?: string
    clientName?: string
    clientPhone?: string
    notes?: string
  }
) {
  const user = await requireUser()

  let simNumber = data.simNumber
  if (simNumber) {
    simNumber = simNumber.replace(/[^0-9]/g, "")
    if (simNumber.startsWith("234")) {
      simNumber = "0" + simNumber.slice(3)
    }
  }

  const tracker = await prisma.vehicleTracker.updateMany({
    where: { id: trackerId, userId: user.id },
    data: {
      ...(data.vehicleName ? { vehicleName: data.vehicleName.trim() } : {}),
      ...(data.plateNumber ? { plateNumber: data.plateNumber.trim().toUpperCase() } : {}),
      ...(simNumber ? { simNumber } : {}),
      ...(data.network ? { network: data.network } : {}),
      ...(data.deviceModel !== undefined ? { deviceModel: data.deviceModel?.trim() || null } : {}),
      ...(data.imei !== undefined ? { imei: data.imei?.trim() || null } : {}),
      ...(data.clientName !== undefined ? { clientName: data.clientName?.trim() || null } : {}),
      ...(data.clientPhone !== undefined ? { clientPhone: data.clientPhone?.trim() || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
    },
  })

  revalidatePath("/trackers")
  revalidatePath(`/trackers/${trackerId}`)
  revalidatePath("/dashboard")
  return { success: true, count: tracker.count }
}

export async function deleteTracker(trackerId: string) {
  const user = await requireUser()

  await prisma.vehicleTracker.deleteMany({
    where: { id: trackerId, userId: user.id },
  })

  revalidatePath("/trackers")
  revalidatePath("/dashboard")
  return { success: true }
}

export async function rechargeTrackerAirtime(
  trackerId: string,
  amount: number,
  serverId?: string
) {
  const user = await requireUser()

  const tracker = await prisma.vehicleTracker.findFirst({
    where: { id: trackerId, userId: user.id },
  })

  if (!tracker) throw new Error("Tracker SIM record not found.")

  if (amount < 50) throw new Error("Minimum airtime amount is ₦50.")

  await purchaseAirtime(user.id, tracker.network, tracker.simNumber, amount, {
    serverId,
    trackerId: tracker.id,
  })

  revalidatePath("/trackers")
  revalidatePath(`/trackers/${trackerId}`)
  revalidatePath("/dashboard")
  revalidatePath("/transactions")
  return { success: true }
}

export async function rechargeTrackerData(
  trackerId: string,
  dataPlanId: string,
  amount: number,
  planName: string,
  validityDays: number = 30,
  serverId?: string
) {
  const user = await requireUser()

  const tracker = await prisma.vehicleTracker.findFirst({
    where: { id: trackerId, userId: user.id },
  })

  if (!tracker) throw new Error("Tracker SIM record not found.")

  await purchaseData(user.id, tracker.network, dataPlanId, tracker.simNumber, amount, {
    serverId,
    trackerId: tracker.id,
    planName,
    validityDays,
  })

  revalidatePath("/trackers")
  revalidatePath(`/trackers/${trackerId}`)
  revalidatePath("/dashboard")
  revalidatePath("/transactions")
  return { success: true }
}
