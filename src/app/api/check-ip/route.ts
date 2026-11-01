import { NextResponse } from "next/server"

export async function GET() {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" })
    const data = await res.json()
    return NextResponse.json({
      success: true,
      serverOutboundIp: data.ip,
      environment: process.env.VERCEL ? "Vercel Serverless" : process.env.NODE_ENV || "custom",
      instructions: `Add ${data.ip} to your Telecom Gateway API IP Whitelist.`,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
