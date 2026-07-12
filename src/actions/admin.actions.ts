"use server"

import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function toggleUserSuspension(userId: string, isSuspended: boolean) {
  const session = await auth()
  // @ts-ignore
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized")

  await prisma.user.update({
    where: { id: userId },
    data: { isSuspended },
  })
  
  revalidatePath("/admin/users")
  return { success: true }
}

export async function fundUserWallet(userId: string, amount: number, type: "CREDIT" | "DEBIT", reason: string) {
  const session = await auth()
  // @ts-ignore
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized")

  await prisma.$transaction(async (tx) => {
    // 1. Create transaction record
    await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        type,
        status: "SUCCESS",
        reference: `ADMIN_${type}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        // Store reason somewhere or just in reference. We can add a description field later, but for now reference will do.
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
  const session = await auth()
  // @ts-ignore
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized")

  await prisma.provider.update({
    where: { id: providerId },
    data: { status },
  })

  revalidatePath("/admin/providers")
  return { success: true }
}

export async function addProvider(data: { providerName: string, baseUrl: string, apiKey: string }) {
  const session = await auth()
  // @ts-ignore
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized")

  await prisma.provider.create({
    data,
  })

  revalidatePath("/admin/providers")
  return { success: true }
}
