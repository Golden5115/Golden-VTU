import dns from "node:dns"
import {
  IVtuProvider,
  ProviderInitConfig,
  VtuBalanceResponse,
  VtuDataPlan,
  VtuTransactionResponse,
} from "./vtu-provider.interface"
import { RAW_SMECLOUD_PLANS } from "./smecloud.plans"

// Ensure reliable IPv4 resolution for SMECloud on Windows/serverless networks
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first")
}
const origLookup = dns.lookup
// @ts-ignore
dns.lookup = function (hostname: string, a: any, b: any) {
  const cb = typeof a === "function" ? a : b
  const opt = typeof a === "function" ? {} : a

  origLookup(hostname, opt, (err: any, addr: any, fam: any) => {
    if (err && (err.code === "EAI_AGAIN" || err.code === "ENOTFOUND") && hostname) {
      dns.resolve4(hostname, (rErr, addrs) => {
        if (!rErr && addrs && addrs.length > 0) {
          if (opt && opt.all) {
            return cb(null, addrs.map((ip) => ({ address: ip, family: 4 })))
          }
          return cb(null, addrs[0], 4)
        }
        cb(err, addr, fam)
      })
    } else {
      cb(err, addr, fam)
    }
  })
}

// Standardized telecom network IDs ("01": MTN, "02": Glo, "03": 9mobile, "04": Airtel)
const NETWORK_AIRTIME_PRODUCT_CODES: Record<string, string> = {
  "01": "mtn_custom",
  "02": "glo_custom",
  "03": "9mobile_custom",
  "04": "prepaid_airtel",
}

const DATA_PROFIT_MARKUP = 80 // Default markup in Naira on wholesale rate

export const DEFAULT_SMECLOUD_PLANS: VtuDataPlan[] = RAW_SMECLOUD_PLANS.map((p) => ({
  id: p.id,
  network: p.network,
  networkName: p.networkName,
  name: p.name,
  rawPrice: p.rawPrice,
  price: Math.ceil(p.rawPrice + DATA_PROFIT_MARKUP),
  validity: p.validity,
}))

export class SmeCloudProvider implements IVtuProvider {
  readonly identifier = "SMECLOUD"

  private apiKey: string = ""
  private baseUrl: string = "https://smecloud.io/autobiz_vending_index.php"

  initialize(config: ProviderInitConfig): void {
    this.apiKey = config.apiKey || process.env.SMECLOUD_API_KEY || ""
    this.baseUrl = config.baseUrl || process.env.SMECLOUD_BASE_URL || "https://smecloud.io/autobiz_vending_index.php"
  }

  private getHeaders(): Record<string, string> {
    const cleanToken = this.apiKey.replace(/^Bearer\s+/i, "").trim()
    return {
      Authorization: `Bearer ${cleanToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Cache-Control": "no-cache",
    }
  }

  async buyAirtime(
    networkId: string,
    amount: number,
    mobileNumber: string,
    reference: string,
    callbackUrl: string
  ): Promise<VtuTransactionResponse> {
    const productCode = NETWORK_AIRTIME_PRODUCT_CODES[networkId] || "mtn_custom"

    const payload = {
      amount,
      product_code: productCode,
      phone_number: mobileNumber,
      action: "vend",
      user_reference: reference,
      processing_mode: "async",
      ...(callbackUrl ? { callback: callbackUrl } : {}),
    }

    console.log(`[SMECloud Provider] Buying airtime at ${this.baseUrl}:`, payload)

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))
    console.log(`[SMECloud Provider] Airtime response:`, data)

    // Check for API-level errors
    if (!response.ok || data.status === false) {
      const rawErrMsg =
        data.data?.true_response ||
        data.server_message ||
        data.data?.text_status ||
        `Carrier Airtime vending failed (${response.status})`
      const cleanMsg = String(rawErrMsg)
        .replace(/sme\s*cloud(?:\.io)?/gi, "Telecom Carrier")
        .replace(/smecloud(?:\.io)?/gi, "Telecom Carrier")
        .replace(/pairgate/gi, "Telecom Carrier")
        .replace(/clubkonnect/gi, "Telecom Carrier")
        .replace(/autobiz(?:_vending_index\.php)?/gi, "Carrier Gateway")
      throw new Error(cleanMsg)
    }

    const txData = data.data || {}
    const rechargeId = txData.recharge_id || reference
    const innerStatus = String(txData.text_status || txData.status || "").toUpperCase().trim()

    const isExplicitSuccess = innerStatus === "COMPLETED" || innerStatus === "SUCCESSFUL" || innerStatus === "DELIVERED"
    const isExplicitFailed = innerStatus === "FAILED" || innerStatus === "CANCELLED" || innerStatus === "REJECTED"

    if (isExplicitFailed) {
      throw new Error(`Carrier Rejected: ${txData.true_response || data.server_message || "Transaction failed on Server 3."}`)
    }

    return {
      isSuccessful: isExplicitSuccess,
      isPending: !isExplicitSuccess,
      providerReference: String(rechargeId),
      rawResponse: data,
    }
  }

  async buyData(
    networkId: string,
    dataPlanId: string,
    mobileNumber: string,
    reference: string,
    callbackUrl: string
  ): Promise<VtuTransactionResponse> {
    // Map known numeric IDs to SMECloud product_code slugs if needed
    const PLAN_CODE_MAP: Record<string, string> = {
      // MTN Data Transfer Plans
      "6403": "6403",
      "6404": "mtn_200mb_monthly",
      "6405": "mtn_100mb_weekly",
      "6406": "mtn_200mb_weekly",
      "1223": "mtn_500mb_monthly",
      "1224": "mtn_1gb_monthly",
      "1225": "mtn_2gb_monthly",
      "1226": "mtn_3gb_monthly",
      "1227": "mtn_5gb_monthly",
      "6278": "mtn_10gb_monthly",
      "1219": "mtn_1gb_weekly",
      "1220": "mtn_2gb_weekly",
      "1221": "mtn_3gb_weekly",
      "1222": "mtn_5gb_weekly",

      // Glo Corporate Gifting Plans (All 18 verified tiers)
      "962": "glo_cg_200mb_14days",
      "963": "glo_cg_500mb_14days",
      "964": "glo_cg_500mb_30days",
      "965": "glo_cg_1gb_30days",
      "966": "glo_cg_2gb_30days",
      "967": "glo_cg_3gb_30days",
      "968": "glo_cg_5gb_30days",
      "969": "glo_cg_10gb_30days",
      "6050": "glo_cg_1gb_3days",
      "6051": "glo_cg_1gb_7days",
      "6057": "glo_cg_1gb_14days",
      "6052": "glo_cg_3gb_3days",
      "6053": "glo_cg_3gb_7days",
      "6058": "glo_cg_3gb_14days",
      "6054": "glo_cg_5gb_3days",
      "6055": "glo_cg_5gb_7days",
      "6059": "glo_cg_5gb_14days",
      "6056": "glo_cg_10gb_14days",
    }

    const productCode = PLAN_CODE_MAP[String(dataPlanId)] || String(dataPlanId)

    const payload = {
      product_code: productCode,
      phone_number: mobileNumber,
      action: "vend",
      user_reference: reference,
      processing_mode: "async",
      ...(callbackUrl ? { callback: callbackUrl } : {}),
    }

    console.log(`[SMECloud Provider] Buying data at ${this.baseUrl}:`, payload)

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))
    console.log(`[SMECloud Provider] Data response:`, data)

    // Check for API-level errors
    if (!response.ok || data.status === false) {
      const rawErrMsg =
        data.data?.true_response ||
        data.server_message ||
        data.data?.text_status ||
        `Carrier Data purchase failed (${response.status})`
      const cleanMsg = String(rawErrMsg)
        .replace(/sme\s*cloud(?:\.io)?/gi, "Telecom Carrier")
        .replace(/smecloud(?:\.io)?/gi, "Telecom Carrier")
        .replace(/pairgate/gi, "Telecom Carrier")
        .replace(/clubkonnect/gi, "Telecom Carrier")
        .replace(/autobiz(?:_vending_index\.php)?/gi, "Carrier Gateway")
      throw new Error(cleanMsg)
    }

    const txData = data.data || {}
    const rechargeId = txData.recharge_id || reference
    const innerStatus = String(txData.text_status || txData.status || "").toUpperCase().trim()

    const isExplicitSuccess = innerStatus === "COMPLETED" || innerStatus === "SUCCESSFUL" || innerStatus === "DELIVERED"
    const isExplicitFailed = innerStatus === "FAILED" || innerStatus === "CANCELLED" || innerStatus === "REJECTED"

    if (isExplicitFailed) {
      throw new Error(`Carrier Rejected: ${txData.true_response || data.server_message || "Transaction failed on Server 3."}`)
    }

    return {
      isSuccessful: isExplicitSuccess,
      isPending: !isExplicitSuccess,
      providerReference: String(rechargeId),
      rawResponse: data,
    }
  }

  async getDataPlans(): Promise<VtuDataPlan[]> {
    return DEFAULT_SMECLOUD_PLANS
  }

  async getWalletBalance(): Promise<VtuBalanceResponse> {
    const payload = { action: "balance" }

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || data.status === false) {
      const errMsg =
        data.data?.true_response ||
        data.server_message ||
        `Failed to fetch Server 3 wallet balance (${response.status})`
      throw new Error(
        String(errMsg)
          .replace(/sme\s*cloud(?:\.io)?/gi, "Telecom Carrier")
          .replace(/smecloud(?:\.io)?/gi, "Telecom Carrier")
          .replace(/autobiz(?:_vending_index\.php)?/gi, "Carrier Gateway")
      )
    }

    const balances = Array.isArray(data.data) ? data.data : []
    const nairaWallet = balances.find((b: any) =>
      String(b.label || "").toLowerCase().includes("naira")
    ) || balances[0]

    const rawBalStr = String(nairaWallet?.balance || "0").replace(/[#,\s]/g, "")
    const bal = parseFloat(rawBalStr) || 0

    return {
      balance: bal,
      currency: "NGN",
    }
  }

  async testConnection(): Promise<{
    success: boolean
    balance?: number
    currency?: string
    message?: string
  }> {
    try {
      if (!this.apiKey) {
        return { success: false, message: "API Key (Bearer Token) is required for Server 3 Gateway." }
      }

      const bal = await this.getWalletBalance()
      return {
        success: true,
        balance: bal.balance,
        currency: bal.currency,
        message: `Server 3 connected successfully! Wallet Balance: ₦${bal.balance.toLocaleString()}`,
      }
    } catch (err: any) {
      const rawMsg = err.message || "Failed to connect to Server 3 Gateway."
      const cleanMsg = String(rawMsg)
        .replace(/sme\s*cloud(?:\.io)?/gi, "Telecom Carrier")
        .replace(/smecloud(?:\.io)?/gi, "Telecom Carrier")
        .replace(/autobiz(?:_vending_index\.php)?/gi, "Carrier Gateway")

      if (cleanMsg.includes("Whitelist") || cleanMsg.includes("Access denied")) {
        return {
          success: false,
          message: `IP Whitelist Required: Please log in to your telecom gateway dashboard and add your server/calling IP (105.115.6.178) to the API Whitelist.`,
        }
      }
      return {
        success: false,
        message: cleanMsg,
      }
    }
  }

  async queryTransaction(orderIdOrReference: string): Promise<{
    orderId: string
    statusCode: string
    status: string
    remark: string
    network?: string
    mobileNumber?: string
    amountCharged?: number
    walletBalance?: number
    isSuccessful: boolean
    isPending: boolean
    isFailed: boolean
    rawResponse: any
  }> {
    const payload = {
      order_id: orderIdOrReference,
      action: "status",
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
        cache: "no-store",
      })

      const data = await response.json().catch(() => ({}))
      const txData = data.data || {}
      const st = String(txData.status || data.text_status || "").toUpperCase().trim()

      const isSuccessful = st === "COMPLETED" || st === "SUCCESSFUL" || st === "DONE"
      const isFailed = st === "FAILED" || st === "CANCELLED" || st === "REJECTED"
      const isPending = !isSuccessful && !isFailed

      const rawRemark = data.server_message || txData.true_response || st
      const cleanRemark = String(rawRemark || "")
        .replace(/sme\s*cloud(?:\.io)?/gi, "Telecom Carrier")
        .replace(/smecloud(?:\.io)?/gi, "Telecom Carrier")
        .replace(/pairgate/gi, "Telecom Carrier")
        .replace(/clubkonnect/gi, "Telecom Carrier")
        .replace(/autobiz(?:_vending_index\.php)?/gi, "Carrier Gateway")

      return {
        orderId: String(txData.recharge_id || orderIdOrReference),
        statusCode: String(data.error_code || "200"),
        status: isSuccessful ? "SUCCESSFUL" : isFailed ? "FAILED" : "PENDING",
        remark: cleanRemark,
        amountCharged: txData.amount_charged ? parseFloat(String(txData.amount_charged)) : undefined,
        isSuccessful,
        isPending,
        isFailed,
        rawResponse: data,
      }
    } catch (err: any) {
      return {
        orderId: orderIdOrReference,
        statusCode: "500",
        status: "PENDING",
        remark: `Status check error: ${err.message}`,
        isSuccessful: false,
        isPending: true,
        isFailed: false,
        rawResponse: null,
      }
    }
  }
}
