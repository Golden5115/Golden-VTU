import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * ClubKonnect Callback Webhook
 * 
 * ClubKonnect calls this endpoint after processing an airtime/data order.
 * It sends the result as query string parameters:
 *   ?orderdate=...&orderid=...&statuscode=...&orderstatus=...&orderremark=...
 * 
 * Status codes:
 *   100 = ORDER_RECEIVED (still processing)
 *   200 = ORDER_COMPLETED (success)
 *   Other = Failed
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const orderId = searchParams.get("orderid")
    const statusCode = searchParams.get("statuscode")
    const orderStatus = searchParams.get("orderstatus")
    const orderRemark = searchParams.get("orderremark")
    const requestId = searchParams.get("requestid")

    console.log(`[ClubKonnect Callback] OrderID: ${orderId}, Status: ${orderStatus}, Code: ${statusCode}`)

    if (!orderId && !requestId) {
      return NextResponse.json({ error: "Missing order identifier" }, { status: 400 })
    }

    // Determine if this is a success or failure
    const isSuccess = statusCode === "200" && orderStatus === "ORDER_COMPLETED"

    // Try to find the purchase by providerReference (orderid) or by reference (requestid)
    // Check AirtimePurchase first
    let airtimePurchase = orderId
      ? await prisma.airtimePurchase.findFirst({ where: { providerReference: orderId } })
      : null

    if (!airtimePurchase && requestId) {
      airtimePurchase = await prisma.airtimePurchase.findFirst({ where: { reference: requestId } })
    }

    if (airtimePurchase) {
      await handleAirtimeCallback(airtimePurchase, isSuccess)
      return NextResponse.json({ message: "Airtime callback processed" })
    }

    // Check DataPurchase
    let dataPurchase = orderId
      ? await prisma.dataPurchase.findFirst({ where: { providerReference: orderId } })
      : null

    if (!dataPurchase && requestId) {
      dataPurchase = await prisma.dataPurchase.findFirst({ where: { reference: requestId } })
    }

    if (dataPurchase) {
      await handleDataCallback(dataPurchase, isSuccess)
      return NextResponse.json({ message: "Data callback processed" })
    }

    console.warn(`[ClubKonnect Callback] No matching purchase found for OrderID: ${orderId}`)
    return NextResponse.json({ error: "No matching purchase found" }, { status: 404 })
  } catch (error: any) {
    console.error("[ClubKonnect Callback] Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// Also handle POST in case ClubKonnect sends JSON body
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const orderId = body.orderid
    const statusCode = body.statuscode
    const orderStatus = body.orderstatus

    console.log(`[ClubKonnect Callback POST] OrderID: ${orderId}, Status: ${orderStatus}, Code: ${statusCode}`)

    const isSuccess = statusCode === "200" && orderStatus === "ORDER_COMPLETED"

    // Check AirtimePurchase
    let airtimePurchase = await prisma.airtimePurchase.findFirst({
      where: { providerReference: orderId },
    })

    if (airtimePurchase) {
      await handleAirtimeCallback(airtimePurchase, isSuccess)
      return NextResponse.json({ message: "Airtime callback processed" })
    }

    // Check DataPurchase
    let dataPurchase = await prisma.dataPurchase.findFirst({
      where: { providerReference: orderId },
    })

    if (dataPurchase) {
      await handleDataCallback(dataPurchase, isSuccess)
      return NextResponse.json({ message: "Data callback processed" })
    }

    return NextResponse.json({ error: "No matching purchase found" }, { status: 404 })
  } catch (error: any) {
    console.error("[ClubKonnect Callback POST] Error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// ─── Handlers ───────────────────────────────────────────────────────────────────

async function handleAirtimeCallback(purchase: any, isSuccess: boolean) {
  if (purchase.status !== "PENDING") {
    console.log(`[ClubKonnect] Airtime purchase ${purchase.id} already processed (${purchase.status}). Skipping.`)
    return
  }

  if (isSuccess) {
    // Mark as SUCCESS
    await prisma.$transaction(async (tx: any) => {
      await tx.airtimePurchase.update({
        where: { id: purchase.id },
        data: { status: "SUCCESS" },
      })
      await tx.walletTransaction.updateMany({
        where: { reference: purchase.reference },
        data: { status: "SUCCESS" },
      })
    })
    console.log(`[ClubKonnect] Airtime purchase ${purchase.id} marked SUCCESS`)
  } else {
    // Mark as FAILED and refund
    await prisma.$transaction(async (tx: any) => {
      await tx.airtimePurchase.update({
        where: { id: purchase.id },
        data: { status: "FAILED" },
      })
      await tx.walletTransaction.updateMany({
        where: { reference: purchase.reference },
        data: { status: "FAILED" },
      })
      // Refund user
      await tx.user.update({
        where: { id: purchase.userId },
        data: { walletBalance: { increment: purchase.amount } },
      })
    })
    console.log(`[ClubKonnect] Airtime purchase ${purchase.id} FAILED. User refunded ₦${purchase.amount}`)
  }
}

async function handleDataCallback(purchase: any, isSuccess: boolean) {
  if (purchase.status !== "PENDING") {
    console.log(`[ClubKonnect] Data purchase ${purchase.id} already processed (${purchase.status}). Skipping.`)
    return
  }

  if (isSuccess) {
    await prisma.$transaction(async (tx: any) => {
      await tx.dataPurchase.update({
        where: { id: purchase.id },
        data: { status: "SUCCESS" },
      })
      await tx.walletTransaction.updateMany({
        where: { reference: purchase.reference },
        data: { status: "SUCCESS" },
      })
    })
    console.log(`[ClubKonnect] Data purchase ${purchase.id} marked SUCCESS`)
  } else {
    await prisma.$transaction(async (tx: any) => {
      await tx.dataPurchase.update({
        where: { id: purchase.id },
        data: { status: "FAILED" },
      })
      await tx.walletTransaction.updateMany({
        where: { reference: purchase.reference },
        data: { status: "FAILED" },
      })
      await tx.user.update({
        where: { id: purchase.userId },
        data: { walletBalance: { increment: purchase.amount } },
      })
    })
    console.log(`[ClubKonnect] Data purchase ${purchase.id} FAILED. User refunded ₦${purchase.amount}`)
  }
}
