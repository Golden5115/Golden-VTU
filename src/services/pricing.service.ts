import prisma from "@/lib/prisma"
import { VtuDataPlan } from "./providers/vtu-provider.interface"

/**
 * Retrieves the global default profit markup (defaults to ₦100).
 */
export async function getDefaultMarkup(): Promise<number> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "data_profit_markup" },
    })
    if (setting?.value) {
      const val = parseFloat(setting.value)
      if (!isNaN(val)) return val
    }
  } catch (err) {
    console.warn("[PricingService] Failed to read default markup:", err)
  }
  return 100 // Fallback default profit markup
}

/**
 * Merges raw provider plans with admin custom pricing overrides and the default profit markup.
 */
export async function applyCustomPricing(
  plans: VtuDataPlan[],
  providerIdentifier: string
): Promise<VtuDataPlan[]> {
  try {
    const defaultMarkup = await getDefaultMarkup()

    // Fetch custom prices set by admin for this provider or globally ("ALL")
    const customPrices = await prisma.dataPlanPrice.findMany({
      where: {
        OR: [
          { provider: providerIdentifier },
          { provider: "ALL" },
        ],
      },
    })

    const customPriceMap = new Map<string, number>()
    for (const cp of customPrices) {
      customPriceMap.set(`${cp.provider}_${cp.network}_${cp.planId}`, cp.customPrice)
      customPriceMap.set(`${cp.network}_${cp.planId}`, cp.customPrice)
      customPriceMap.set(cp.planId, cp.customPrice)
    }

    return plans.map((plan) => {
      const specificKey = `${providerIdentifier}_${plan.network}_${plan.id}`
      const netKey = `${plan.network}_${plan.id}`
      const directKey = plan.id

      const customPrice =
        customPriceMap.get(specificKey) ??
        customPriceMap.get(netKey) ??
        customPriceMap.get(directKey)

      const wholesale = plan.rawPrice ?? Math.max(0, plan.price - 100)

      // 1. If admin explicitly customized the price for this plan, use it
      if (customPrice !== undefined && customPrice > 0) {
        return {
          ...plan,
          rawPrice: wholesale,
          price: Math.ceil(customPrice),
          isCustomPrice: true,
        }
      }

      // 2. Otherwise apply wholesale cost + default admin markup
      const finalPrice = wholesale > 0 ? Math.ceil(wholesale + defaultMarkup) : plan.price
      return {
        ...plan,
        rawPrice: wholesale,
        price: finalPrice,
        isCustomPrice: false,
      }
    })
  } catch (err) {
    console.error("[PricingService] Failed to apply custom pricing:", err)
    return plans
  }
}
