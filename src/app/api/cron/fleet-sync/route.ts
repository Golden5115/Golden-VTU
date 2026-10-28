import { NextResponse } from "next/server"
import { syncOfflineVehiclesBatch } from "@/actions/cartracker.actions"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Automated Cron Fleet Sync
 * Runs periodically to ensure unexpired offline vehicles in PostgreSQL
 * stay fresh and pruned without requiring admin staff to manually sync.
 */
export async function GET(req: Request) {
  try {
    let currentPage = 1
    let totalSynced = 0
    const maxPages = 35

    while (currentPage <= maxPages) {
      const res = await syncOfflineVehiclesBatch(currentPage, 500, true)
      if (!res.success) {
        console.error(`[FleetSyncCron] Error on page ${currentPage}:`, res.error)
        return NextResponse.json({ success: false, error: res.error, page: currentPage }, { status: 500 })
      }

      totalSynced = res.totalSyncedSoFar

      if (res.isDone || res.batchItemsCount < 500) {
        break
      }

      currentPage++
    }

    return NextResponse.json({
      success: true,
      pagesProcessed: currentPage,
      totalSynced,
      timestamp: new Date().toISOString(),
      message: "Automated fleet sync completed successfully",
    })
  } catch (error: any) {
    console.error("[FleetSyncCron] Unexpected error:", error.message)
    return NextResponse.json(
      { success: false, error: error?.message || "Failed automated sync" },
      { status: 500 }
    )
  }
}
