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
import { reconcilePendingTransactions } from "@/services/vtu.service"

export interface PhoneHistoryItem {
  phone: string
  networkId: string | null
  networkName: string | null
  statusCategory: "ALREADY_LOADED" | "DUE_FOR_RENEWAL" | "NEVER_LOADED"
  isWithinMonth: boolean
  daysAgo: number | null
  lastData?: {
    id: string
    date: string
    formattedDate: string
    daysAgo: number
    plan: string
    amount: number
    daysUntilExpiry: number
    isExpired: boolean
    isExpiringSoon: boolean
  } | null
  lastAirtime?: {
    id: string
    date: string
    formattedDate: string
    daysAgo: number
    amount: number
    status: string
  } | null
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

    // Reconcile pending telecom orders so telemetry history is accurate
    await reconcilePendingTransactions(session.user.id)

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

    // Also include '234' format variants for deep history matching
    const searchVariants = [...uniquePhones]
    for (const p of uniquePhones) {
      if (p.startsWith("0")) {
        searchVariants.push("234" + p.slice(1))
      }
    }

    // Fetch BOTH Data and Airtime transactions for these numbers simultaneously
    const [dataPurchases, airtimePurchases] = await Promise.all([
      prisma.dataPurchase.findMany({
        where: {
          phone: { in: searchVariants },
          status: "SUCCESS",
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.airtimePurchase.findMany({
        where: {
          phone: { in: searchVariants },
          status: "SUCCESS",
        },
        orderBy: { createdAt: "desc" },
      }),
    ])

    // Group by standard 11-digit phone
    const latestDataMap = new Map<string, any>()
    for (const record of dataPurchases) {
      const stdPhone = normalizePhoneNumber(record.phone)
      if (!latestDataMap.has(stdPhone)) {
        latestDataMap.set(stdPhone, record)
      }
    }

    const latestAirtimeMap = new Map<string, any>()
    for (const record of airtimePurchases) {
      const stdPhone = normalizePhoneNumber(record.phone)
      if (!latestAirtimeMap.has(stdPhone)) {
        latestAirtimeMap.set(stdPhone, record)
      }
    }

    const results: PhoneHistoryItem[] = uniquePhones.map((phone) => {
      const net = detectNetwork(phone)
      const dataRecord = latestDataMap.get(phone)
      const airtimeRecord = latestAirtimeMap.get(phone)

      // Calculate Data details
      let lastData = null
      if (dataRecord) {
        const dAgo = getDaysAgo(dataRecord.createdAt)
        const daysUntilExpiry = 30 - dAgo
        lastData = {
          id: dataRecord.id,
          date: dataRecord.createdAt.toISOString(),
          formattedDate: formatDisplayDate(dataRecord.createdAt),
          daysAgo: dAgo,
          plan: dataRecord.plan,
          amount: dataRecord.amount,
          daysUntilExpiry,
          isExpired: daysUntilExpiry <= 0,
          isExpiringSoon: daysUntilExpiry > 0 && daysUntilExpiry <= 3,
        }
      }

      // Calculate Airtime details
      let lastAirtime = null
      if (airtimeRecord) {
        const aAgo = getDaysAgo(airtimeRecord.createdAt)
        lastAirtime = {
          id: airtimeRecord.id,
          date: airtimeRecord.createdAt.toISOString(),
          formattedDate: formatDisplayDate(airtimeRecord.createdAt),
          daysAgo: aAgo,
          amount: airtimeRecord.amount,
          status: airtimeRecord.status,
        }
      }

      // Context record (matching current active screen: data or airtime)
      const contextRecord = type === "data" ? dataRecord : airtimeRecord

      let statusCategory: PhoneHistoryItem["statusCategory"] = "NEVER_LOADED"
      let isWithinMonth = false
      let daysAgo: number | null = null
      let lastPurchase: PhoneHistoryItem["lastPurchase"] = null

      if (contextRecord) {
        daysAgo = getDaysAgo(contextRecord.createdAt)
        isWithinMonth = daysAgo <= 30
        statusCategory = isWithinMonth ? "ALREADY_LOADED" : "DUE_FOR_RENEWAL"
        lastPurchase = {
          id: contextRecord.id,
          date: contextRecord.createdAt.toISOString(),
          formattedDate: formatDisplayDate(contextRecord.createdAt),
          daysAgo,
          relativeText: formatRelativeDays(daysAgo),
          plan: contextRecord.plan || null,
          network: contextRecord.network,
          amount: contextRecord.amount,
          status: contextRecord.status,
          type: type === "data" ? "DATA" : "AIRTIME",
        }
      } else if (type === "data" && airtimeRecord) {
        // Did buy airtime, but never data
        lastPurchase = {
          id: airtimeRecord.id,
          date: airtimeRecord.createdAt.toISOString(),
          formattedDate: formatDisplayDate(airtimeRecord.createdAt),
          daysAgo: getDaysAgo(airtimeRecord.createdAt),
          relativeText: formatRelativeDays(getDaysAgo(airtimeRecord.createdAt)),
          plan: null,
          network: airtimeRecord.network,
          amount: airtimeRecord.amount,
          status: airtimeRecord.status,
          type: "AIRTIME",
        }
      } else if (type === "airtime" && dataRecord) {
        // Did buy data, but never airtime
        lastPurchase = {
          id: dataRecord.id,
          date: dataRecord.createdAt.toISOString(),
          formattedDate: formatDisplayDate(dataRecord.createdAt),
          daysAgo: getDaysAgo(dataRecord.createdAt),
          relativeText: formatRelativeDays(getDaysAgo(dataRecord.createdAt)),
          plan: dataRecord.plan,
          network: dataRecord.network,
          amount: dataRecord.amount,
          status: dataRecord.status,
          type: "DATA",
        }
      }

      return {
        phone,
        networkId: net?.id || null,
        networkName: net?.name || null,
        statusCategory,
        isWithinMonth,
        daysAgo,
        lastData,
        lastAirtime,
        lastPurchase,
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

    // Reconcile pending orders so SIM lookup gets live telemetry
    await reconcilePendingTransactions(session.user.id)

    const { searchParams } = new URL(request.url)
    const rawPhone = searchParams.get("phone") || ""

    const phone = normalizePhoneNumber(rawPhone)
    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 })
    }

    const phoneVariants = [phone]
    if (phone.startsWith("0")) {
      phoneVariants.push("234" + phone.slice(1))
    }

    const net = detectNetwork(phone)

    const [dataRecord, airtimeRecord] = await Promise.all([
      prisma.dataPurchase.findFirst({
        where: { phone: { in: phoneVariants }, status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.airtimePurchase.findFirst({
        where: { phone: { in: phoneVariants }, status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
      }),
    ])

    let lastData = null
    if (dataRecord) {
      const daysAgo = getDaysAgo(dataRecord.createdAt)
      const isWithinMonth = daysAgo <= 30
      lastData = {
        id: dataRecord.id,
        date: dataRecord.createdAt.toISOString(),
        formattedDate: formatDisplayDate(dataRecord.createdAt),
        daysAgo,
        plan: dataRecord.plan,
        amount: dataRecord.amount,
        status: dataRecord.status,
        reference: dataRecord.reference,
        isWithinMonth,
        daysUntilExpiry: 30 - daysAgo,
        isExpired: daysAgo > 30,
      }
    }

    let lastAirtime = null
    if (airtimeRecord) {
      const daysAgo = getDaysAgo(airtimeRecord.createdAt)
      lastAirtime = {
        id: airtimeRecord.id,
        date: airtimeRecord.createdAt.toISOString(),
        formattedDate: formatDisplayDate(airtimeRecord.createdAt),
        daysAgo,
        amount: airtimeRecord.amount,
        status: airtimeRecord.status,
        reference: airtimeRecord.reference,
        needsAirtime: daysAgo > 45,
      }
    }

    return NextResponse.json({
      success: true,
      phone,
      networkId: net?.id || null,
      networkName: net?.name || null,
      lastData,
      lastAirtime,
    })
  } catch (error: any) {
    console.error("[CheckHistoryAPI] GET Error:", error)
    return NextResponse.json({ error: error.message || "Failed to check history" }, { status: 500 })
  }
}
