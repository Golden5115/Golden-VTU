"use server"

import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })

  if (user?.role !== "ADMIN") throw new Error("Unauthorized: Admin privileges required")
}

/**
 * Update or set a custom selling price for a specific data plan
 */
export async function updatePlanPriceAction(data: {
  provider: string
  network: string
  planId: string
  planName: string
  customPrice: number
}) {
  await requireAdmin()

  const { provider, network, planId, planName, customPrice } = data

  if (!planId || isNaN(customPrice) || customPrice <= 0) {
    throw new Error("Invalid price: Price must be a positive number")
  }

  const rounded = Math.ceil(customPrice)

  await prisma.dataPlanPrice.upsert({
    where: {
      provider_network_planId: {
        provider,
        network,
        planId,
      },
    },
    update: {
      customPrice: rounded,
      planName: planName || undefined,
    },
    create: {
      provider,
      network,
      planId,
      planName: planName || "Data Plan",
      customPrice: rounded,
    },
  })

  revalidatePath("/admin/pricing")
  revalidatePath("/data")
  revalidatePath("/trackers")
  return { success: true, customPrice: rounded }
}

/**
 * Reset a custom data plan price back to automated wholesale + default markup
 */
export async function resetPlanPriceAction(data: {
  provider: string
  network: string
  planId: string
}) {
  await requireAdmin()

  const { provider, network, planId } = data

  await prisma.dataPlanPrice.deleteMany({
    where: {
      provider,
      network,
      planId,
    },
  })

  revalidatePath("/admin/pricing")
  revalidatePath("/data")
  revalidatePath("/trackers")
  return { success: true }
}

/**
 * Update the global default profit markup (e.g. ₦100, ₦150)
 */
export async function updateDefaultMarkupAction(markup: number) {
  await requireAdmin()

  if (isNaN(markup) || markup < 0) {
    throw new Error("Invalid markup: Must be ₦0 or greater")
  }

  const rounded = Math.ceil(markup)

  await prisma.systemSetting.upsert({
    where: { key: "data_profit_markup" },
    update: { value: rounded.toString() },
    create: { key: "data_profit_markup", value: rounded.toString() },
  })

  revalidatePath("/admin/pricing")
  revalidatePath("/data")
  revalidatePath("/trackers")
  return { success: true, markup: rounded }
}
