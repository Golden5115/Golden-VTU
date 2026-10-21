import crypto from "crypto"

// Default configuration
const LIVE_URL = "https://ctnwallet.vercel.app/api/webhooks/moniepoint"
const LOCAL_URL = "http://localhost:3000/api/webhooks/moniepoint"
const SECRET = process.env.MONIEPOINT_WEBHOOK_SECRET || "e9c1809eb3124bd58e9e0414834b0372_388d20"

// Parse command line arguments
const args = process.argv.slice(2)
const isLive = args.includes("--live")
const targetUrl = isLive ? LIVE_URL : LOCAL_URL
const isCredit = args.includes("--credit")
const amountArg = args.find((a) => a.startsWith("--amount="))
const amount = amountArg ? parseFloat(amountArg.split("=")[1]) : 100

console.log(`\n========================================`)
console.log(`MONIEPOINT WEBHOOK TEST UTILITY`)
console.log(`========================================`)
console.log(`Target: ${targetUrl}`)
console.log(`Mode:   ${isCredit ? `TRANSACTION SIMULATION (₦${amount})` : "PING / HEALTH CHECK"}`)
console.log(`Secret: ${SECRET.slice(0, 8)}...${SECRET.slice(-6)}`)
console.log(`----------------------------------------`)

let payload
if (isCredit) {
  const ref = `TEST_MNP_${Date.now()}_${Math.random().toString(36).substring(7)}`
  payload = {
    eventType: "SUCCESSFUL_TRANSACTION",
    timestamp: new Date().toISOString(),
    payload: {
      transactionReference: ref,
      merchantReference: `MERCH_${Date.now()}`,
      processingStatus: "SUCCESSFUL",
      actualAmount: amount,
      requestAmount: amount,
      terminalId: "9051156866",
      currency: "NGN",
      narration: "Test POS Deposit Simulation",
    },
  }
} else {
  payload = {
    eventType: "PING",
    terminalId: "9051156866",
    timestamp: new Date().toISOString(),
  }
}

const rawBody = JSON.stringify(payload)
const signature = crypto.createHmac("sha512", SECRET).update(rawBody).digest("hex")

async function sendWebhook() {
  try {
    console.log("Sending payload:\n", JSON.stringify(payload, null, 2))
    console.log("\nComputed HMAC-SHA512 Signature:", signature.slice(0, 32) + "...")

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "moniepoint-signature": signature,
      },
      body: rawBody,
    })

    console.log(`\nHTTP Status: ${response.status} ${response.statusText}`)
    const text = await response.text()
    try {
      const json = JSON.parse(text)
      console.log("Response JSON:", json)
    } catch {
      console.log("Response Raw:", text)
    }

    if (response.ok) {
      console.log("\nSUCCESS: Webhook handled properly!")
    } else {
      console.log("\nFAILED: Server returned error status.")
    }
  } catch (err) {
    console.error("\nConnection Error:", err.message)
    if (!isLive) {
      console.log("TIP: If testing locally, make sure Next.js is running (run 'npm run dev' in another terminal)!")
    }
  }
}

sendWebhook()
