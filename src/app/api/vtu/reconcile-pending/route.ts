import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { reconcilePendingTransactions } from "@/services/vtu.service"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await reconcilePendingTransactions(session.user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error("[ReconcilePendingAPI] Error:", error.message)
    return NextResponse.json({ error: error.message || "Failed to reconcile" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await reconcilePendingTransactions(session.user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error("[ReconcilePendingAPI] Error:", error.message)
    return NextResponse.json({ error: error.message || "Failed to reconcile" }, { status: 500 })
  }
}
