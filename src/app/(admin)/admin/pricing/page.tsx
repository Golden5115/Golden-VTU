import prisma from "@/lib/prisma"
import { getActiveServers, resolveServerAndProvider } from "@/services/providers/provider.factory"
import { applyCustomPricing, getDefaultMarkup } from "@/services/pricing.service"
import { PricingManagerClient } from "./PricingManagerClient"

export const dynamic = "force-dynamic"

export default async function AdminPricingPage() {
  const [dbServers, defaultMarkup, customPriceCount] = await Promise.all([
    getActiveServers(),
    getDefaultMarkup(),
    prisma.dataPlanPrice.count(),
  ])

  const servers = dbServers.map((s) => ({
    id: s.id,
    serverName: s.serverName,
    identifier: s.identifier,
    serverCode: s.serverCode,
  }))

  const defaultServer =
    servers.find((s) => s.serverCode === "server-2" || s.identifier === "PAIRGATE") ||
    servers[0]
  let initialPlans: any[] = []

  if (defaultServer) {
    try {
      const { provider } = await resolveServerAndProvider(defaultServer.id)
      const rawPlans = await provider.getDataPlans()
      initialPlans = await applyCustomPricing(rawPlans, provider.identifier)
    } catch (err) {
      console.error("[AdminPricingPage] Failed to fetch initial plans:", err)
    }
  }

  return (
    <PricingManagerClient
      servers={servers}
      initialServerId={defaultServer?.id || ""}
      initialPlans={initialPlans}
      defaultMarkup={defaultMarkup}
      customPriceCount={customPriceCount}
    />
  )
}
