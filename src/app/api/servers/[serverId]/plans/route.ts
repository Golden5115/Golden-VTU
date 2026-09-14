import { NextRequest, NextResponse } from "next/server"
import { resolveServerAndProvider } from "@/services/providers/provider.factory"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const { serverId } = await params
    const { server, provider } = await resolveServerAndProvider(serverId)

    console.log(`[ServerPlansAPI] Fetching plans for server: ${server.serverName} (${provider.identifier})`)
    const plans = await provider.getDataPlans()

    return NextResponse.json({
      success: true,
      server: {
        id: server.id,
        serverName: server.serverName,
        serverCode: server.serverCode,
        providerName: server.providerName,
        identifier: server.identifier,
      },
      plans,
    })
  } catch (error: any) {
    console.error("[ServerPlansAPI] Error fetching plans:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to load plans for the selected server",
        plans: [],
      },
      { status: 500 }
    )
  }
}
