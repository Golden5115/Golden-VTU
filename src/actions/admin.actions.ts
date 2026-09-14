"use server"

import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { instantiateProviderFromRecord } from "@/services/providers/provider.factory"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })

  if (user?.role !== "ADMIN") throw new Error("Unauthorized")
}

export async function toggleUserSuspension(userId: string, isSuspended: boolean) {
  await requireAdmin()

  await prisma.user.update({
    where: { id: userId },
    data: { isSuspended },
  })

  revalidatePath("/admin/users")
  return { success: true }
}

export async function fundUserWallet(
  userId: string,
  amount: number,
  type: "CREDIT" | "DEBIT",
  reason: string
) {
  await requireAdmin()

  await prisma.$transaction(async (tx: any) => {
    // 1. Create transaction record
    await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        type,
        status: "SUCCESS",
        reference: `ADMIN_${type}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      },
    })

    // 2. Update balance
    if (type === "CREDIT") {
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { increment: amount } },
      })
    } else {
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { decrement: amount } },
      })
    }
  })

  revalidatePath("/admin/users")
  return { success: true }
}

export async function updateProviderStatus(providerId: string, status: boolean) {
  await requireAdmin()

  await prisma.provider.update({
    where: { id: providerId },
    data: { status },
  })

  revalidatePath("/admin/providers")
  revalidatePath("/data")
  revalidatePath("/airtime")
  return { success: true }
}

export async function addProvider(data: {
  serverName: string
  serverCode?: string
  providerName: string
  identifier: string
  baseUrl: string
  apiKey: string
  userId?: string
  secretKey?: string
  publicKey?: string
  sortOrder?: number
}) {
  await requireAdmin()

  // Auto-generate serverCode slug if missing
  const serverCode =
    data.serverCode ||
    data.serverName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") ||
    `server-${Date.now()}`

  await prisma.provider.create({
    data: {
      serverName: data.serverName,
      serverCode,
      providerName: data.providerName,
      identifier: data.identifier.toUpperCase(),
      baseUrl: data.baseUrl,
      apiKey: data.apiKey,
      userId: data.userId || null,
      secretKey: data.secretKey || null,
      publicKey: data.publicKey || null,
      sortOrder: data.sortOrder || 1,
      status: true,
    },
  })

  revalidatePath("/admin/providers")
  revalidatePath("/data")
  revalidatePath("/airtime")
  return { success: true }
}

export async function deleteProvider(providerId: string) {
  await requireAdmin()

  await prisma.provider.delete({
    where: { id: providerId },
  })

  revalidatePath("/admin/providers")
  revalidatePath("/data")
  revalidatePath("/airtime")
  return { success: true }
}

export async function testProviderConnection(providerId: string) {
  await requireAdmin()

  const providerRecord = await prisma.provider.findUnique({
    where: { id: providerId },
  })

  if (!providerRecord) {
    return { success: false, message: "Provider not found in database." }
  }

  try {
    const providerInstance = instantiateProviderFromRecord(providerRecord)
    return await providerInstance.testConnection()
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to initialize provider for testing.",
    }
  }
}

export async function seedInitialServers() {
  await requireAdmin()

  const existingCount = await prisma.provider.count()
  if (existingCount === 0) {
    // 1. Seed Server 1 (ClubKonnect)
    await prisma.provider.create({
      data: {
        serverName: "Server 1 (ClubKonnect)",
        serverCode: "server-1",
        providerName: "ClubKonnect",
        identifier: "CLUBKONNECT",
        baseUrl: process.env.CLUBKONNECT_BASE_URL || "https://www.nellobytesystems.com",
        apiKey: process.env.CLUBKONNECT_API_KEY || "",
        userId: process.env.CLUBKONNECT_USER_ID || "CK100777437",
        status: true,
        isDefault: true,
        sortOrder: 1,
      },
    })

    // 2. Seed Server 2 (Sandbox / Demo Server)
    await prisma.provider.create({
      data: {
        serverName: "Server 2 (Budget SME Sandbox)",
        serverCode: "server-2",
        providerName: "Sandbox Server",
        identifier: "MOCK",
        baseUrl: "https://sandbox.local",
        apiKey: "sandbox-demo-key",
        status: true,
        isDefault: false,
        sortOrder: 2,
      },
    })
  }

  revalidatePath("/admin/providers")
  return { success: true }
}
