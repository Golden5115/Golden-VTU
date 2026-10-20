import { NextResponse } from "next/server"
import crypto from "crypto"
import prisma from "@/lib/prisma"

// Health check endpoint for Moniepoint webhook registration ping
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Golden VTU Moniepoint Webhook Handler",
    timestamp: new Date().toISOString(),
  })
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    
    // Check for signature if secret is provided in environment variables
    const secret = process.env.MONIEPOINT_WEBHOOK_SECRET?.trim()
    const signature =
      req.headers.get("x-moniepoint-signature") ||
      req.headers.get("monnify-signature") ||
      req.headers.get("moniepoint-signature") ||
      req.headers.get("signature")

    if (secret) {
      if (!signature) {
        console.warn("[Moniepoint Webhook] Warning: Secret is configured but no signature header was provided.")
        return NextResponse.json({ message: "Missing signature header" }, { status: 401 })
      }

      // Moniepoint / Monnify typically use SHA512 (fallback SHA256)
      const hash512 = crypto.createHmac("sha512", secret).update(rawBody).digest("hex")
      const hash256 = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")

      if (signature !== hash512 && signature !== hash256) {
        console.warn("[Moniepoint Webhook] Invalid signature received:", signature)
        return NextResponse.json({ message: "Invalid signature" }, { status: 401 })
      }
    }

    let payload: any = {}
    try {
      payload = JSON.parse(rawBody)
    } catch {
      console.warn("[Moniepoint Webhook] Failed to parse JSON body:", rawBody)
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
    }

    console.log("[Moniepoint Webhook] Received payload:", JSON.stringify(payload, null, 2))

    // Handle envelope formats: eventData, data, array, or root object
    const eventData = payload.eventData || payload.data || (Array.isArray(payload) ? payload[0] : payload) || {}
    const eventType = String(payload.eventType || payload.event || payload.type || "").toUpperCase()
    const status = String(eventData.status || payload.status || eventType || "").toUpperCase()

    // Extract reference
    const reference = String(
      eventData.transactionReference ||
      eventData.paymentReference ||
      eventData.reference ||
      eventData.txnRef ||
      eventData.rrn ||
      payload.transactionReference ||
      payload.paymentReference ||
      payload.reference ||
      ""
    ).trim() || `MNP_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Filter out failed or cancelled transactions
    const isExplicitFailure =
      status.includes("FAIL") ||
      status.includes("CANCEL") ||
      status.includes("DECLINE") ||
      status.includes("REVERS")

    if (isExplicitFailure) {
      console.log(`[Moniepoint Webhook] Transaction ${reference} is marked as failed/cancelled (${status}). Skipping wallet credit.`)
      return NextResponse.json({ message: "Transaction failed or declined", reference }, { status: 200 })
    }

    // Extract amount
    const rawAmount =
      eventData.amount ??
      eventData.amountPaid ??
      eventData.totalAmount ??
      payload.amount ??
      payload.amountPaid ??
      0

    let amount = typeof rawAmount === "string" ? parseFloat(rawAmount.replace(/,/g, "")) : Number(rawAmount)

    if (isNaN(amount) || amount <= 0) {
      console.warn("[Moniepoint Webhook] Invalid amount detected:", rawAmount)
      return NextResponse.json({ message: "Invalid or zero amount received" }, { status: 400 })
    }

    // Determine target user
    const targetEmail = process.env.MONIEPOINT_TARGET_EMAIL?.trim()
    let user = null

    if (targetEmail) {
      user = await prisma.user.findUnique({ where: { email: targetEmail } })
    }

    // If target email not found or unset, prioritize ctnwallet@gmail.com, then ADMIN, then any active user
    if (!user) {
      user = await prisma.user.findUnique({ where: { email: "ctnwallet@gmail.com" } })
    }
    if (!user) {
      user = await prisma.user.findFirst({ where: { role: "ADMIN" } })
    }
    if (!user) {
      user = await prisma.user.findFirst()
    }

    if (!user) {
      console.error("[Moniepoint Webhook] No user found in database to credit.")
      return NextResponse.json({ message: "Target user not found" }, { status: 404 })
    }

    // Idempotency check: prevent duplicate credit
    const existingTx = await prisma.walletTransaction.findUnique({
      where: { reference },
    })

    if (existingTx) {
      console.log(`[Moniepoint Webhook] Transaction reference ${reference} has already been processed.`)
      return NextResponse.json({ message: "Transaction already processed", reference }, { status: 200 })
    }

    // Atomically credit user's wallet balance and record WalletTransaction
    await prisma.$transaction([
      prisma.walletTransaction.create({
        data: {
          userId: user.id,
          amount: amount,
          type: "CREDIT",
          reference: reference,
          status: "SUCCESS",
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          walletBalance: {
            increment: amount,
          },
        },
      }),
    ])

    console.log(`[Moniepoint Webhook] Successfully credited ₦${amount.toLocaleString()} to ${user.email} (ref: ${reference})`)

    return NextResponse.json({
      status: "success",
      message: `Successfully credited ₦${amount.toLocaleString()} to ${user.email}`,
      reference,
      amount,
    }, { status: 200 })
  } catch (error: any) {
    console.error("[Moniepoint Webhook Error]:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
