import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { purchaseAirtime, purchaseData } from "@/services/vtu.service"
import { normalizePhoneNumber, detectNetwork, NETWORKS } from "@/lib/phone-utils"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const body = await request.json()
    const { type, networkId, planId, amount, serverId, phones, bypassSimCheck } = body

    if (!Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json({ error: "At least one recipient phone number is required" }, { status: 400 })
    }

    const unitAmount = Math.round((parseFloat(amount) || 0) * 100) / 100
    if (!unitAmount || unitAmount <= 0) {
      return NextResponse.json({ error: "Invalid purchase amount" }, { status: 400 })
    }

    if (type === "data" && !planId) {
      return NextResponse.json({ error: "Data plan ID is required" }, { status: 400 })
    }

    if (!networkId) {
      return NextResponse.json({ error: "Mobile network is required" }, { status: 400 })
    }

    // Clean phone numbers
    const cleanPhones = phones
      .map((p: string) => normalizePhoneNumber(p))
      .filter((p: string) => p.length === 11)

    if (cleanPhones.length === 0) {
      return NextResponse.json({ error: "No valid 11-digit phone numbers found" }, { status: 400 })
    }

    // Pre-check total wallet balance (with transient network retry)
    const totalRequired = Math.round(unitAmount * cleanPhones.length * 100) / 100
    let user = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { walletBalance: true },
        })
        break
      } catch (dbErr: any) {
        if (attempt === 2) throw dbErr
        await new Promise((r) => setTimeout(r, 400))
      }
    }

    if (!user || user.walletBalance < totalRequired) {
      return NextResponse.json(
        {
          error: `Insufficient wallet balance. Total required for ${cleanPhones.length} numbers is ₦${totalRequired.toLocaleString()}, but your balance is ₦${(user?.walletBalance || 0).toLocaleString()}.`,
        },
        { status: 400 }
      )
    }

    console.log(`[BulkPurchaseAPI] Starting bulk ${type} for ${cleanPhones.length} numbers (Total: ₦${totalRequired}, SIM Bypass: ${Boolean(bypassSimCheck)})`)

    const results: Array<{
      phone: string
      success: boolean
      reference?: string
      error?: string
    }> = []

    for (const phone of cleanPhones) {
      try {
        if (type === "data") {
          const res = await purchaseData(userId, networkId, planId, phone, unitAmount, {
            serverId,
            bypassSimCheck: true,
          })
          results.push({
            phone,
            success: true,
            reference: (res as any)?.reference || (res as any)?.id,
          })
        } else {
          const res = await purchaseAirtime(userId, networkId, phone, unitAmount, {
            serverId,
            bypassSimCheck: true,
          })
          results.push({
            phone,
            success: true,
            reference: (res as any)?.reference || (res as any)?.id,
          })
        }
      } catch (err: any) {
        console.error(`[BulkPurchaseAPI] Failed for phone ${phone}:`, err.message)
        results.push({
          phone,
          success: false,
          error: err.message || "Failed to process",
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      totalProcessed: cleanPhones.length,
      successCount,
      failureCount,
      results,
    })
  } catch (error: any) {
    console.error("[BulkPurchaseAPI] Server error:", error)
    return NextResponse.json({ error: error.message || "Bulk purchase failed" }, { status: 500 })
  }
}
