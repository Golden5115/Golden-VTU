"use server"

import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { normalizePhoneNumber, detectNetwork, getDaysAgo, formatDisplayDate } from "@/lib/phone-utils"

export interface SimDiagnosticHistory {
  phone: string
  network: {
    id: string
    name: string
  } | null

  lastData: {
    id: string
    plan: string
    amount: number
    date: string
    formattedDate: string
    daysAgo: number
    reference: string
    status: string
    expiryDate: string
    daysUntilExpiry: number
    isExpired: boolean
    isExpiringSoon: boolean
  } | null

  lastAirtime: {
    id: string
    amount: number
    date: string
    formattedDate: string
    daysAgo: number
    reference: string
    status: string
    needsAirtime: boolean
  } | null

  summary: {
    verdictType: "CRITICAL_EXPIRED" | "WARNING_EXPIRING" | "HEALTHY_ACTIVE" | "NEVER_DATA" | "NEVER_SEEN"
    verdictTitle: string
    verdictMessage: string
  }

  recentTransactions: Array<{
    id: string
    type: "DATA" | "AIRTIME"
    description: string
    amount: number
    status: string
    reference: string
    date: string
  }>
}

export async function checkSimHistory(rawPhone: string): Promise<SimDiagnosticHistory | null> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const clean = rawPhone.replace(/[^0-9]/g, "")
  if (clean.length < 10) return null

  // Standardize to 11-digit Nigerian format (e.g., 080...)
  let phone = clean
  if (clean.startsWith("234") && clean.length === 13) {
    phone = "0" + clean.slice(3)
  } else if (clean.length === 10) {
    phone = "0" + clean
  }

  const phoneVariants = [phone]
  if (phone.startsWith("0")) {
    phoneVariants.push("234" + phone.slice(1))
  }

  // Auto-detect network
  const detected = detectNetwork(phone)
  const network = detected ? { id: detected.id, name: detected.name } : null

  // 1. Fetch latest successful or accepted data purchase
  const lastDataRecord = await prisma.dataPurchase.findFirst({
    where: {
      phone: { in: phoneVariants },
      status: { in: ["SUCCESS", "PENDING"] },
    },
    orderBy: { createdAt: "desc" },
  })

  // 2. Fetch latest successful or accepted airtime purchase
  const lastAirtimeRecord = await prisma.airtimePurchase.findFirst({
    where: {
      phone: { in: phoneVariants },
      status: { in: ["SUCCESS", "PENDING"] },
    },
    orderBy: { createdAt: "desc" },
  })

  // 3. Fetch recent transactions for this SIM (up to 8)
  const recentData = await prisma.dataPurchase.findMany({
    where: { phone: { in: phoneVariants } },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  const recentAirtime = await prisma.airtimePurchase.findMany({
    where: { phone: { in: phoneVariants } },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  const combinedRecent = [
    ...recentData.map((d: any) => ({
      id: d.id,
      type: "DATA" as const,
      description: `Data Bundle (${d.plan})`,
      amount: d.amount,
      status: d.status,
      reference: d.reference,
      date: d.createdAt.toISOString(),
      rawDate: new Date(d.createdAt).getTime(),
    })),
    ...recentAirtime.map((a: any) => ({
      id: a.id,
      type: "AIRTIME" as const,
      description: `Airtime Top-up (₦${a.amount})`,
      amount: a.amount,
      status: a.status,
      reference: a.reference,
      date: a.createdAt.toISOString(),
      rawDate: new Date(a.createdAt).getTime(),
    })),
  ]
    .sort((a, b) => b.rawDate - a.rawDate)
    .slice(0, 8)
    .map(({ rawDate, ...rest }) => rest)

  // Calculate Data Diagnostics
  let lastData: SimDiagnosticHistory["lastData"] = null
  if (lastDataRecord) {
    const daysAgo = getDaysAgo(lastDataRecord.createdAt)
    const purchaseTime = new Date(lastDataRecord.createdAt).getTime()
    const validityDays = 30 // standard monthly VTU validity
    const expiryTime = purchaseTime + validityDays * 24 * 60 * 60 * 1000
    const now = Date.now()
    const daysUntilExpiry = Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24))
    const isExpired = daysUntilExpiry <= 0
    const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 3

    lastData = {
      id: lastDataRecord.id,
      plan: lastDataRecord.plan,
      amount: lastDataRecord.amount,
      date: lastDataRecord.createdAt.toISOString(),
      formattedDate: formatDisplayDate(lastDataRecord.createdAt),
      daysAgo,
      reference: lastDataRecord.reference,
      status: lastDataRecord.status,
      expiryDate: new Date(expiryTime).toISOString(),
      daysUntilExpiry,
      isExpired,
      isExpiringSoon,
    }
  }

  // Calculate Airtime Diagnostics
  let lastAirtime: SimDiagnosticHistory["lastAirtime"] = null
  if (lastAirtimeRecord) {
    const daysAgo = getDaysAgo(lastAirtimeRecord.createdAt)
    lastAirtime = {
      id: lastAirtimeRecord.id,
      amount: lastAirtimeRecord.amount,
      date: lastAirtimeRecord.createdAt.toISOString(),
      formattedDate: formatDisplayDate(lastAirtimeRecord.createdAt),
      daysAgo,
      reference: lastAirtimeRecord.reference,
      status: lastAirtimeRecord.status,
      needsAirtime: daysAgo > 45,
    }
  }

  // Build Diagnostic Troubleshooting Verdict
  let verdictType: SimDiagnosticHistory["summary"]["verdictType"] = "NEVER_SEEN"
  let verdictTitle = "No Previous History on File"
  let verdictMessage = "This SIM has never been recharged on this platform before."

  const hasFailedAttempts = combinedRecent.some((tx) => tx.status === "FAILED")

  if (!lastData && !lastAirtime) {
    if (combinedRecent.length > 0) {
      verdictType = "CRITICAL_EXPIRED"
      verdictTitle = "⚠️ Previous Recharges Failed"
      verdictMessage = `Found ${combinedRecent.length} previous recharge attempt(s), but all failed on the carrier network. The SIM currently has no active airtime or data balance.`
    } else {
      verdictType = "NEVER_SEEN"
      verdictTitle = "No Previous Recharge Found"
      verdictMessage = "No airtime or data records found for this SIM. It needs both data and airtime."
    }
  } else if (!lastData && lastAirtime) {
    verdictType = "NEVER_DATA"
    verdictTitle = "⚠️ No Active Data Bundle"
    const airtimeWhen = lastAirtime.daysAgo === 0 ? "today" : `${lastAirtime.daysAgo}d ago`
    if (hasFailedAttempts) {
      verdictMessage = `Airtime was loaded ${airtimeWhen} (₦${lastAirtime.amount.toLocaleString()}), but previous data activation failed. The tracker device cannot connect to GPS servers without data!`
    } else {
      verdictMessage = `Airtime was loaded ${airtimeWhen} (₦${lastAirtime.amount.toLocaleString()}), but NO data bundle was ever bought. The tracker is offline without data!`
    }
  } else if (lastData && lastData.isExpired) {
    verdictType = "CRITICAL_EXPIRED"
    verdictTitle = `🔴 Data Expired ${Math.abs(lastData.daysUntilExpiry)} Days Ago!`
    verdictMessage = `Last plan (${lastData.plan}) was loaded ${lastData.daysAgo === 0 ? "today" : `${lastData.daysAgo} days ago`} on ${lastData.formattedDate}. The SIM has exhausted its validity; device cannot transmit GPS packets.`
  } else if (lastData && lastData.isExpiringSoon) {
    verdictType = "WARNING_EXPIRING"
    verdictTitle = `🟡 Data Expiring in ${lastData.daysUntilExpiry} Days!`
    verdictMessage = `Last loaded ${lastData.daysAgo === 0 ? "today" : `${lastData.daysAgo} days ago`} (${lastData.plan}). Renew soon to prevent tracking disruption.`
  } else if (lastData) {
    verdictType = "HEALTHY_ACTIVE"
    verdictTitle = `🟢 Data is Active (${lastData.daysUntilExpiry} Days Left)`
    verdictMessage = `Last loaded ${lastData.daysAgo === 0 ? "today" : `${lastData.daysAgo} days ago`} (${lastData.plan}). If the tracker is offline, check the vehicle battery, wire harness, or device hardware.`
  }

  return {
    phone,
    network,
    lastData,
    lastAirtime,
    summary: {
      verdictType,
      verdictTitle,
      verdictMessage,
    },
    recentTransactions: combinedRecent,
  }
}
