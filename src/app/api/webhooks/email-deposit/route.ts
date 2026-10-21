import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import crypto from "crypto"
import prisma from "@/lib/prisma"

// Health check endpoint for webhook ping
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Golden VTU Email Deposit Webhook Handler",
    timestamp: new Date().toISOString(),
  })
}

interface ParsedMoniepointEmail {
  amount: number
  reference: string
  sender?: string
  accountNo?: string
  date?: string
  narration?: string
  isCredit: boolean
}

/**
 * Robust Moniepoint & Nigerian bank credit notification parser.
 * Specifically handles Moniepoint format: "Credit Amount\n100.00", "Account Number:\n3006410113", etc.
 */
export function parseCreditEmail(text: string, subject: string = ""): ParsedMoniepointEmail {
  const combined = `${subject}\n${text}`
  const cleanText = combined.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")

  // Check if it's a CREDIT alert
  const isCredit =
    /credit\s*amount/i.test(cleanText) ||
    /credit\s*transaction/i.test(cleanText) ||
    /credit/i.test(subject) ||
    /credited/i.test(cleanText) ||
    /deposit/i.test(subject)

  // 1. EXTRACT AMOUNT: Specifically target Moniepoint's "Credit Amount\n100.00" FIRST!
  let amount = 0
  const creditAmountMatch = cleanText.match(/credit\s*amount\s*[:=-]?\s*(?:n|ngn|₦)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i)
  if (creditAmountMatch && creditAmountMatch[1]) {
    amount = parseFloat(creditAmountMatch[1].replace(/,/g, ""))
  }

  // Fallback patterns if not formatted as "Credit Amount"
  if (!amount || isNaN(amount)) {
    const fallbackPatterns = [
      /(?:amount\s*credited|amount)\s*[:=-]?\s*(?:ngn|naira|n|₦)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      /(?:ngn|₦)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      /(?:paid|transferred|received)\s*(?:ngn|naira|₦)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    ]
    for (const pattern of fallbackPatterns) {
      const match = cleanText.match(pattern)
      if (match && match[1]) {
        const parsed = parseFloat(match[1].replace(/,/g, ""))
        if (!isNaN(parsed) && parsed > 0) {
          amount = parsed
          break
        }
      }
    }
  }

  // 2. EXTRACT ACCOUNT NUMBER
  let accountNo = ""
  const acctMatch = cleanText.match(/account\s*number\s*[:=-]?\s*(\d{10})/i)
  if (acctMatch && acctMatch[1]) {
    accountNo = acctMatch[1]
  }

  // 3. EXTRACT DATE & TIME (Stop before Narration or line end)
  let dateTimeStr = ""
  const dateMatch = cleanText.match(/date\s*(?:&|and)?\s*time\s*[:=-]?\s*([0-9]{1,2}\s+[A-Za-z]{3},?\s+[0-9]{4}\s*\|\s*[0-9]{1,2}:[0-9]{2}:[0-9]{2}\s*(?:AM|PM)?)/i)
  if (dateMatch && dateMatch[1]) {
    dateTimeStr = dateMatch[1].trim()
  } else {
    const altDate = cleanText.match(/date\s*(?:&|and)?\s*time\s*[:=-]?\s*([^\n\r]+)/i)
    if (altDate && altDate[1]) dateTimeStr = altDate[1].trim()
  }

  // 4. EXTRACT SENDER NAME
  let sender = ""
  const senderMatch = cleanText.match(/sender(?:'s)?\s*name\s*[:=-]?\s*(?:from)?\s*([^\n\r<]{3,50})/i)
  if (senderMatch && senderMatch[1]) {
    sender = senderMatch[1].trim().replace(/^from\s+/i, "")
  }

  // 5. EXTRACT NARRATION
  let narration = ""
  const narMatch = cleanText.match(/narration\s*[:=-]?\s*([^\n\r<]{3,60})/i)
  if (narMatch && narMatch[1]) {
    narration = narMatch[1].trim()
  }

  // 6. EXTRACT OR GENERATE DETERMINISTIC REFERENCE
  let reference = ""
  const refMatch = cleanText.match(/(?:session\s*id|transaction\s*reference|reference)\s*[:=-]?\s*([A-Za-z0-9_\-]+)/i)
  if (refMatch && refMatch[1] && refMatch[1].length >= 6) {
    reference = refMatch[1].trim()
  } else {
    // Generate deterministic hash from accountNo + amount + dateTimeStr
    const key = `${accountNo}_${amount}_${dateTimeStr || cleanText.slice(0, 100)}`
    const hash = crypto.createHash("sha256").update(key).digest("hex").slice(0, 12).toUpperCase()
    reference = `MNP_${hash}`
  }

  return {
    amount,
    reference,
    sender,
    accountNo,
    narration,
    isCredit,
  }
}

export async function POST(req: Request) {
  try {
    // Optional secret key verification (from query ?secret=... or headers)
    const configuredSecret = process.env.EMAIL_WEBHOOK_SECRET?.trim()
    if (configuredSecret) {
      const url = new URL(req.url)
      const providedSecret =
        url.searchParams.get("secret") ||
        req.headers.get("x-webhook-secret") ||
        req.headers.get("x-api-key") ||
        req.headers.get("authorization")?.replace(/^bearer\s+/i, "")

      if (providedSecret !== configuredSecret) {
        return NextResponse.json({ message: "Unauthorized webhook secret" }, { status: 401 })
      }
    }

    // Support both application/json and multipart/form-data (used by SendGrid/Mailgun)
    let subject = ""
    let bodyText = ""
    let senderEmail = ""

    const contentType = req.headers.get("content-type") || ""

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData()
      subject = String(formData.get("subject") || formData.get("Subject") || "")
      bodyText = String(
        formData.get("text") ||
        formData.get("body_plain") ||
        formData.get("stripped-text") ||
        formData.get("html") ||
        formData.get("body_html") ||
        ""
      )
      senderEmail = String(formData.get("from") || formData.get("sender") || "")
    } else {
      let json: any = {}
      try {
        json = await req.json()
      } catch {
        const raw = await req.text()
        bodyText = raw
      }

      subject = String(
        json.subject ||
        json.Subject ||
        json.title ||
        json.headline ||
        ""
      )

      bodyText = String(
        json.body_plain ||
        json.body ||
        json.text ||
        json.plain ||
        json.content ||
        json.html ||
        json.body_html ||
        json.strippedText ||
        json.message ||
        ""
      )

      senderEmail = String(json.from || json.sender || json.From || "")
    }

    if (!bodyText && !subject) {
      return NextResponse.json({ message: "No email subject or body provided" }, { status: 400 })
    }

    console.log(`[Email Webhook] Processing email from "${senderEmail}" with subject "${subject}"`)

    const parsed = parseCreditEmail(bodyText, subject)

    if (!parsed.isCredit) {
      console.log(`[Email Webhook] Email does not appear to be a credit notification. Skipping.`)
      return NextResponse.json({ message: "Not a credit notification", subject }, { status: 200 })
    }

    if (parsed.amount <= 0) {
      console.warn(`[Email Webhook] Could not determine credit amount from email content:`, { subject, sample: bodyText.slice(0, 200) })
      return NextResponse.json({ message: "Could not parse amount from email", parsed }, { status: 400 })
    }

    const reference = parsed.reference || `EML_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Target user resolution
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
      return NextResponse.json({ message: "Target user not found" }, { status: 404 })
    }

    // Idempotency: Prevent duplicate crediting of the same email / session ID
    const existingTx = await prisma.walletTransaction.findUnique({
      where: { reference },
    })

    if (existingTx) {
      console.log(`[Email Webhook] Transaction with reference ${reference} was already credited previously.`)
      return NextResponse.json({
        message: "Transaction already processed",
        reference,
        amount: parsed.amount,
      }, { status: 200 })
    }

    // Atomically credit user's wallet
    await prisma.$transaction([
      prisma.walletTransaction.create({
        data: {
          userId: user.id,
          amount: parsed.amount,
          type: "CREDIT",
          reference: reference,
          status: "SUCCESS",
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          walletBalance: {
            increment: parsed.amount,
          },
        },
      }),
    ])

    // Revalidate app caches so balance updates instantly
    try {
      revalidatePath("/trackers")
      revalidatePath("/wallet/fund")
      revalidatePath("/dashboard")
      revalidatePath("/transactions")
    } catch {
      // background revalidation error non-fatal
    }

    console.log(`[Email Webhook] Successfully credited ₦${parsed.amount.toLocaleString()} to ${user.email} (ref: ${reference})`)

    return NextResponse.json({
      status: "success",
      message: `Successfully credited ₦${parsed.amount.toLocaleString()} to ${user.email}`,
      reference,
      amount: parsed.amount,
      sender: parsed.sender,
      narration: parsed.narration,
    }, { status: 200 })
  } catch (error: any) {
    console.error("[Email Webhook Error]:", error)
    return NextResponse.json({ message: "Internal server error", error: error.message }, { status: 500 })
  }
}
