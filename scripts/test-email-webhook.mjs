const LOCAL_URL = "http://localhost:3000/api/webhooks/email-deposit"
const LIVE_URL = "https://ctnwallet.vercel.app/api/webhooks/email-deposit"

const args = process.argv.slice(2)
const isLive = args.includes("--live")
const targetUrl = isLive ? LIVE_URL : LOCAL_URL

// Real Moniepoint email pasted by the user
const realEmailSubject = "Credit Notification - Moniepoint"
const realEmailBody = `
Hi ABIODUN,
We wish to inform you that a credit transaction occurred on your account with us. Log in to [Business Banking](https://u8065049.ct.sendgrid.net/ls/click?upn=u001.H1Ep8uVFtCrdwMini-2FLYyFugEQjQftXB2sla-2F-2BiBHHcdkzld3Nn8hUq6nUh746uQWFRC3VF7FMkfnncjgznBQSCqYPkSxRyeIB3TH4nKxDiHmnjipMj1MN3-2FwvDIMc2WKcjB_DHwvUOPpuVvmOqBqITahNrqWCRRBXdl-2F1Ew-2B3pF9Qceofx9OQ5iC30B0G9OHk4oUk9SHxKbqmYK6swhKEGp8W-2BF1q-2Bbj8KV-2FLUOxzxB2NDcsB-2F3txj8GcQNycT6Ve6Hue-2Bkrcrs6zxHxluwGuLnWSROzdA97NOxYrtmAsARkoRUA-2Fe3GWuwgDLcdJ9YDYYZpQGf4E1qR7rOfZbrUCcpNb6t5lJEtamy1yLsnMVWcysmn7kirNEqIuO9n4-2B4O31J22kdzbefAr6dVVM3RFUX8kZ-2FqgA14eX256x2WCiNMFZw96VXEiEhsa6fpYd7hL2GdH58l0LwB6cgi9V-2B2DoEGC3yJXEFI7n6ifytVZbQuqn6TL-2FW9unlFlpsJ9x29W-2FFPZjKXptjz30bK-2BSnmurCoow-3D-3D) for more details.
Credit Amount
100.00
Transaction Details
Account Balance:
N 1,078.50
Account Number:
3006410113
Sender's Name:
from ABIODUN AYOMIDE AYOOLA
Date & Time:
21 Oct, 2026 | 05:40:31 AM
Narration:
Transfer from ABIODUN AYOMIDE AYOOLA
If you experience any problems kindly contact us at [support@moniepoint.com](mailto:support@moniepoint.com) or send us a WhatsApp message at +234 908 843 0803
Follow us on:
`

console.log(`\n========================================`)
console.log(`TESTING REAL MONIEPOINT EMAIL WEBHOOK`)
console.log(`========================================`)
console.log(`Target: ${targetUrl}`)
console.log(`----------------------------------------`)

async function run() {
  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: realEmailSubject,
        body: realEmailBody,
        from: "notifications@moniepoint.com",
      }),
    })

    console.log(`HTTP Status: ${res.status} ${res.statusText}`)
    const json = await res.json()
    console.log("Response:", JSON.stringify(json, null, 2))
  } catch (err) {
    console.error("Error:", err.message)
  }
}

run()
