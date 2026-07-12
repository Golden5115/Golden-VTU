import { NextResponse } from "next/server"
import crypto from "crypto"
import prisma from "@/lib/prisma"

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get("x-paystack-signature")

    if (!signature) {
      return NextResponse.json({ message: "No signature" }, { status: 400 })
    }

    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest("hex")

    if (hash !== signature) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 400 })
    }

    const event = JSON.parse(rawBody)

    if (event.event === "charge.success") {
      const data = event.data
      const reference = data.reference
      const amount = data.amount / 100 // Convert back from kobo
      const email = data.customer.email

      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 404 })
      }

      // Idempotency check
      const existingTx = await prisma.walletTransaction.findUnique({
        where: { reference },
      })

      if (existingTx) {
        return NextResponse.json({ message: "Transaction already processed" }, { status: 200 })
      }

      // Process using an ACID transaction
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
    }

    return NextResponse.json({ message: "Webhook received" }, { status: 200 })
  } catch (error) {
    console.error("Paystack webhook error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
