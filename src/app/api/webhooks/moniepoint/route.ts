import { NextResponse } from "next/server"
import crypto from "crypto"
import { revalidatePath } from "next/cache"
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
      req.headers.get("monnify-signature") ||
      req.headers.get("x-moniepoint-signature") ||
      req.headers.get("moniepoint-signature") ||
      req.headers.get("x-signature") ||
      req.headers.get("signature") ||
      req.headers.get("authorization")

    if (secret && signature) {
      const cleanSignature = signature.replace(/^bearer\s+/i, "").trim()
      const hash512Hex = crypto.createHmac("sha512", secret).update(rawBody).digest("hex")
      const hash512Base64 = crypto.createHmac("sha512", secret).update(rawBody).digest("base64")
      const hash256Hex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
      const hash256Base64 = crypto.createHmac("sha256", secret).update(rawBody).digest("base64")

      const isMatch =
        cleanSignature.toLowerCase() === hash512Hex.toLowerCase() ||
        cleanSignature === hash512Base64 ||
        cleanSignature.toLowerCase() === hash256Hex.toLowerCase() ||
        cleanSignature === hash256Base64 ||
        cleanSignature === secret

      if (!isMatch) {
        console.warn("[Moniepoint Webhook] Invalid signature received:", cleanSignature)
        return NextResponse.json({ message: "Invalid signature" }, { status: 401 })
      }
    } else if (secret && !signature) {
      console.warn("[Moniepoint Webhook] Warning: Secret configured but incoming request had no signature header. Processing with caution.")
    }

    let payload: any = {}
    try {
      payload = JSON.parse(rawBody)
    } catch {
      console.warn("[Moniepoint Webhook] Failed to parse JSON body:", rawBody)
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
    }

    console.log("[Moniepoint Webhook] Received payload:", JSON.stringify(payload, null, 2))

    // Moniepoint POS API (OpenAPI 3.1.0) wraps transaction data in 'payload'
    const txData =
      payload.payload ||
      payload.eventData ||
      payload.data ||
      (Array.isArray(payload) ? payload[0] : payload) ||
      {}

    const eventType = String(payload.eventType || payload.event || payload.type || "").toUpperCase()

    // Status: Check processingStatus (OpenAPI enum: SUCCESSFUL, COMPLETED, PROCESSED, PENDING, FAILED, CANCELLED, REJECTED, EXPIRED)
    const status = String(
      txData.processingStatus ||
      txData.status ||
      payload.status ||
      eventType ||
      ""
    ).toUpperCase()

    // Handle verification/test events from Moniepoint Developer Dashboard
    if (
      eventType === "PING" ||
      eventType === "TEST" ||
      eventType === "SUBSCRIPTION_CONFIRMATION" ||
      eventType === "WEBHOOK_VERIFICATION"
    ) {
      console.log(`[Moniepoint Webhook] Handled test/verification event: ${eventType}`)
      return NextResponse.json({ status: "success", message: "Webhook endpoint verified" }, { status: 200 })
    }

    // Extract reference (Moniepoint POS uses transactionReference or merchantReference or idempotentId)
    const reference = String(
      txData.transactionReference ||
      txData.merchantReference ||
      txData.paymentReference ||
      txData.reference ||
      txData.rrn ||
      txData.sessionID ||
      txData.sessionId ||
      txData.transactionId ||
      txData.id ||
      payload.idempotentId ||
      payload.transactionReference ||
      payload.reference ||
      ""
    ).trim() || `MNP_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Filter out failed or cancelled transactions
    const isExplicitFailure =
      status.includes("FAIL") ||
      status.includes("CANCEL") ||
      status.includes("DECLINE") ||
      status.includes("REVERS") ||
      status.includes("REJECT") ||
      status.includes("EXPIRE")

    if (isExplicitFailure) {
      console.log(`[Moniepoint Webhook] Transaction ${reference} is marked as failed/cancelled (${status}). Skipping wallet credit.`)
      return NextResponse.json({ message: "Transaction failed or declined", reference }, { status: 200 })
    }

    // Extract amount: Moniepoint POS uses actualAmount or requestAmount (in Naira or kobo)
    const rawAmount =
      txData.actualAmount ??
      txData.requestAmount ??
      txData.amountPaid ??
      txData.amount ??
      txData.settlementAmount ??
      txData.amountTransferred ??
      txData.transactionAmount ??
      txData.totalAmount ??
      txData.totalPayable ??
      payload.actualAmount ??
      payload.amount ??
      0

    let amount = typeof rawAmount === "string" ? parseFloat(rawAmount.replace(/,/g, "")) : Number(rawAmount)

    if (isNaN(amount) || amount <= 0) {
      console.warn("[Moniepoint Webhook] Invalid amount detected:", rawAmount)
      return NextResponse.json({ message: "Invalid or zero amount received" }, { status: 400 })
    }

    // Determine target user (case-insensitive fallback)
    const targetEmail = process.env.MONIEPOINT_TARGET_EMAIL?.trim() || "ctnwallet@gmail.com"
    let user = await prisma.user.findFirst({
      where: {
        email: {
          equals: targetEmail,
          mode: "insensitive",
        },
      },
    })

    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          email: {
            equals: "ctnwallet@gmail.com",
            mode: "insensitive",
          },
        },
      })
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

    // Purge Next.js Server Component page caches so balance reflects immediately
    try {
      revalidatePath("/trackers")
      revalidatePath("/wallet/fund")
      revalidatePath("/dashboard")
      revalidatePath("/transactions")
    } catch {
      // Revalidation failure in background should not abort webhook 200 response
    }

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
