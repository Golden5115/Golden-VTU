import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import {
  normalizePhoneNumber,
  parseCommaSeparatedPhones,
  getDaysAgo,
  formatRelativeDays,
  formatDisplayDate,
  detectNetwork,
} from "@/lib/phone-utils"

export interface PhoneHistoryItem {
  phone: string
  networkId: string | null
  networkName: string | null
  statusCategory: "ALREADY_LOADED" | "DUE_FOR_RENEWAL" | "NEVER_LOADED"
  isWithinMonth: boolean
  daysAgo: number | null
  lastPurchase: {
    id: string
    date: string
    formattedDate: string
    daysAgo: number
    relativeText: string
    plan?: string | null
    network: string
    amount: number
    status: string
    type: "DATA" | "AIRTIME"
  } | null
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const rawPhones = Array.isArray(body.phones) ? body.phones : []
    const type = body.type === "airtime" ? "airtime" : "data"

    if (rawPhones.length === 0) {
      return NextResponse.json({ success: true, results: [] })
    }

    // Clean, normalize and deduplicate numbers
    const cleanPhones: string[] = []
    for (const p of rawPhones) {
      if (typeof p === "string" && p.trim()) {
        const parsed = parseCommaSeparatedPhones(p)
        cleanPhones.push(...parsed)
      }
    }
    const uniquePhones = Array.from(new Set(cleanPhones))

    if (uniquePhones.length === 0) {
      return NextResponse.json({ success: true, results: [] })
    }

    // Fetch transactions for these numbers
    let purchases: any[] = []
    if (type === "data") {
      purchases = await prisma.dataPurchase.findMany({
        where: {
          phone: { in: uniquePhones },
          status: "SUCCESS",
        },
        orderBy: { createdAt: "desc" },
      })
    } else {
      purchases = await prisma.airtimePurchase.findMany({
        where: {
          phone: { in: uniquePhones },
          status: "SUCCESS",
        },
        orderBy: { createdAt: "desc" },
      })
    }

    // Group by phone to find latest purchase per phone
    const latestMap = new Map<string, any>()
    for (const record of purchases) {
      if (!latestMap.has(record.phone)) {
        latestMap.set(record.phone, record)
      }
    }

    const results: PhoneHistoryItem[] = uniquePhones.map((phone) => {
      const net = detectNetwork(phone)
      const record = latestMap.get(phone)

      if (record) {
        const daysAgo = getDaysAgo(record.createdAt)
        const isWithinMonth = daysAgo <= 30
        const statusCategory = isWithinMonth ? "ALREADY_LOADED" : "DUE_FOR_RENEWAL"

        return {
          phone,
          networkId: net?.id || null,
          networkName: net?.name || null,
          statusCategory,
          isWithinMonth,
          daysAgo,
          lastPurchase: {
            id: record.id,
            date: record.createdAt.toISOString(),
            formattedDate: formatDisplayDate(record.createdAt),
            daysAgo,
            relativeText: formatRelativeDays(daysAgo),
            plan: record.plan || null,
            network: record.network,
            amount: record.amount,
            status: record.status,
            type: type === "data" ? "DATA" : "AIRTIME",
          },
        }
      }

      return {
        phone,
        networkId: net?.id || null,
        networkName: net?.name || null,
        statusCategory: "NEVER_LOADED",
        isWithinMonth: false,
        daysAgo: null,
        lastPurchase: null,
      }
    })

    return NextResponse.json({
      success: true,
      count: results.length,
      alreadyLoadedCount: results.filter((r) => r.statusCategory === "ALREADY_LOADED").length,
      dueCount: results.filter((r) => r.statusCategory === "DUE_FOR_RENEWAL").length,
      neverLoadedCount: results.filter((r) => r.statusCategory === "NEVER_LOADED").length,
      results,
    })
  } catch (error: any) {
    console.error("[CheckHistoryAPI] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to check history" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const rawPhone = searchParams.get("phone") || ""
    const type = searchParams.get("type") === "airtime" ? "airtime" : "data"

    const phone = normalizePhoneNumber(rawPhone)
    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 })
    }

    let record: any = null
    if (type === "data") {
      record = await prisma.dataPurchase.findFirst({
        where: { phone, status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
      })
    } else {
      record = await prisma.airtimePurchase.findFirst({
        where: { phone, status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
      })
    }

    const net = detectNetwork(phone)
    if (record) {
      const daysAgo = getDaysAgo(record.createdAt)
      const isWithinMonth = daysAgo <= 30
      const statusCategory = isWithinMonth ? "ALREADY_LOADED" : "DUE_FOR_RENEWAL"

      return NextResponse.json({
        success: true,
        phone,
        networkId: net?.id || null,
        networkName: net?.name || null,
        statusCategory,
        isWithinMonth,
        daysAgo,
        lastPurchase: {
          id: record.id,
          date: record.createdAt.toISOString(),
          formattedDate: formatDisplayDate(record.createdAt),
          daysAgo,
          relativeText: formatRelativeDays(daysAgo),
          plan: record.plan || null,
          network: record.network,
          amount: record.amount,
          status: record.status,
          type: type === "data" ? "DATA" : "AIRTIME",
        },
      })
    }

    return NextResponse.json({
      success: true,
      phone,
      networkId: net?.id || null,
      networkName: net?.name || null,
      statusCategory: "NEVER_LOADED",
      isWithinMonth: false,
      daysAgo: null,
      lastPurchase: null,
    })
  } catch (error: any) {
    console.error("[CheckHistoryAPI] GET Error:", error)
    return NextResponse.json({ error: error.message || "Failed to check history" }, { status: 500 })
  }
}
