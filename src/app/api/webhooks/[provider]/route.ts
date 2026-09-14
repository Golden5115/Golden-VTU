import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  return handleWebhook(request, provider.toLowerCase())
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params
  return handleWebhook(request, provider.toLowerCase())
}

async function handleWebhook(request: NextRequest, provider: string) {
  try {
    let orderId: string | null = null
    let requestId: string | null = null
    let isSuccess = false

    // 1. Parse GET params (ClubKonnect style)
    const searchParams = request.nextUrl.searchParams
    if (searchParams.toString().length > 0) {
      orderId = searchParams.get("orderid")
      requestId = searchParams.get("requestid")
      const orderStatus = searchParams.get("orderstatus")
      isSuccess = orderStatus === "ORDER_COMPLETED"
    }

    // 2. Parse POST body if present
    if (!orderId && !requestId && request.method === "POST") {
      try {
        const body = await request.json()
        console.log(`[Webhook ${provider}] Received payload:`, body)

        if (provider === "clubkonnect") {
          orderId = body.orderid || null
          requestId = body.requestid || null
          isSuccess = body.orderstatus === "ORDER_COMPLETED"
        } else if (provider === "vtpass") {
          const content = body.content?.transactions || body
          orderId = content.transactionId || null
          requestId = content.requestId || null
          isSuccess = content.status === "delivered" || body.code === "000"
        } else if (provider === "pairgate") {
          orderId = body.reference_code || null
          requestId = body.reference || null
          const st = (body.status || "").toLowerCase()
          isSuccess = st === "successful" || st === "success"
        } else {
          // Husmodata / generic SME standard
          orderId = String(body.id || body.ident || "")
          requestId = body.ref || null
          const st = (body.status || body.Status || "").toLowerCase()
          isSuccess = st === "successful" || st === "success"
        }
      } catch {
        // Body was not json, ignore
      }
    }

    if (!orderId && !requestId) {
      return NextResponse.json({ error: "Missing order reference" }, { status: 400 })
    }

    // Check AirtimePurchase
    let airtime = orderId
      ? await prisma.airtimePurchase.findFirst({ where: { providerReference: orderId } })
      : null
    if (!airtime && requestId) {
      airtime = await prisma.airtimePurchase.findFirst({ where: { reference: requestId } })
    }

    if (airtime) {
      if (airtime.status === "PENDING") {
        await prisma.$transaction(async (tx: any) => {
          await tx.airtimePurchase.update({
            where: { id: airtime.id },
            data: { status: isSuccess ? "SUCCESS" : "FAILED" },
          })
          await tx.walletTransaction.updateMany({
            where: { reference: airtime.reference },
            data: { status: isSuccess ? "SUCCESS" : "FAILED" },
          })
          if (!isSuccess) {
            await tx.user.update({
              where: { id: airtime.userId },
              data: { walletBalance: { increment: airtime.amount } },
            })
          }
        })
      }
      return NextResponse.json({ message: "Airtime webhook processed" })
    }

    // Check DataPurchase
    let dataPur = orderId
      ? await prisma.dataPurchase.findFirst({ where: { providerReference: orderId } })
      : null
    if (!dataPur && requestId) {
      dataPur = await prisma.dataPurchase.findFirst({ where: { reference: requestId } })
    }

    if (dataPur) {
      if (dataPur.status === "PENDING") {
        await prisma.$transaction(async (tx: any) => {
          await tx.dataPurchase.update({
            where: { id: dataPur.id },
            data: { status: isSuccess ? "SUCCESS" : "FAILED" },
          })
          await tx.walletTransaction.updateMany({
            where: { reference: dataPur.reference },
            data: { status: isSuccess ? "SUCCESS" : "FAILED" },
          })
          if (!isSuccess) {
            await tx.user.update({
              where: { id: dataPur.userId },
              data: { walletBalance: { increment: dataPur.amount } },
            })
          }
        })
      }
      return NextResponse.json({ message: "Data webhook processed" })
    }

    return NextResponse.json({ message: "Order not found or already processed" }, { status: 200 })
  } catch (error: any) {
    console.error(`[Webhook ${provider}] Error:`, error)
    return NextResponse.json({ error: "Webhook internal failure" }, { status: 500 })
  }
}
