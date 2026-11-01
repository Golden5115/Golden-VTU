import { NextResponse } from "next/server"
import { runAutoRenewalBatch, getAutoRenewalConfig } from "@/services/auto-renew.service"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Automated Cron Vehicle Tracker Data Auto-Renewal
 * Runs periodically to automatically recharge expiring/expired tracker SIMs
 * across all network providers using configured telecom server plans.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get("key") || searchParams.get("secret")
    const authHeader = req.headers.get("authorization")

    // Optional cron secret protection
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const isAuthValid =
        authHeader === `Bearer ${cronSecret}` ||
        secret === cronSecret
      if (!isAuthValid) {
        return NextResponse.json(
          { success: false, error: "Unauthorized cron execution." },
          { status: 401 }
        )
      }
    }

    const { processScheduledBiWeeklyRenewals, getServer3ReserveTelemetry } = await import("@/services/auto-renew.service")

    // 1. Process automated bi-weekly second-cycle renewals (prepaid upfront, 0 wallet deduction)
    const biWeeklyResult = await processScheduledBiWeeklyRenewals()

    // 2. Query reserve telemetry
    const reserveTelemetry = await getServer3ReserveTelemetry()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      biWeeklyRenewals: {
        processed: biWeeklyResult.processed,
        succeeded: biWeeklyResult.succeeded,
        failed: biWeeklyResult.failed,
        pausedDueToReserve: biWeeklyResult.pausedDueToReserve,
        message: biWeeklyResult.message,
        items: biWeeklyResult.items,
      },
      server3Reserve: {
        liveBalance: reserveTelemetry.liveBalance,
        minReserveThreshold: reserveTelemetry.minReserve,
        availableForRenewals: reserveTelemetry.availableForRenewals,
        renewalsCovered: reserveTelemetry.renewalsCovered,
        pendingCycle2Queue: reserveTelemetry.pendingCount,
        isHealthy: reserveTelemetry.isHealthy,
      },
      message: biWeeklyResult.message,
    })
  } catch (error: any) {
    console.error("[AutoRenewCron] Unexpected execution error:", error?.message || error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed automated renewal batch execution",
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  return GET(req)
}
