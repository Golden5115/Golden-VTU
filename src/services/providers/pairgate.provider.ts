import {
  IVtuProvider,
  ProviderInitConfig,
  VtuBalanceResponse,
  VtuDataPlan,
  VtuTransactionResponse,
} from "./vtu-provider.interface"

// Map our standardized network IDs ("01", "02", "03", "04") to Pairgate provider slugs
const NETWORK_MAP_TO_PAIRGATE: Record<string, string> = {
  "01": "mtn",
  "02": "glo",
  "03": "9mobile",
  "04": "airtel",
}

const PAIRGATE_TO_NETWORK_MAP: Record<string, { code: string; name: string }> = {
  mtn: { code: "01", name: "MTN" },
  glo: { code: "02", name: "Glo" },
  "9mobile": { code: "03", name: "9mobile" },
  airtel: { code: "04", name: "Airtel" },
}

import { RAW_PAIRGATE_PLANS } from "./pairgate.plans"

// Live verified Pairgate plans catalogue with accurate provider plan IDs and durations
const DATA_PROFIT_MARKUP = 100

export const DEFAULT_PAIRGATE_PLANS: VtuDataPlan[] = RAW_PAIRGATE_PLANS.map((p) => ({
  id: p.id,
  network: p.network,
  networkName: p.networkName,
  name: p.name,
  rawPrice: p.rawPrice,
  price: Math.ceil(p.rawPrice + DATA_PROFIT_MARKUP),
  validity: p.validity,
}))

export class PairgateProvider implements IVtuProvider {
  readonly identifier = "PAIRGATE"

  private apiKey: string = ""
  private baseUrl: string = "https://pairgate.com/api/v1"
  private isTestMode: boolean = false

  initialize(config: ProviderInitConfig): void {
    this.apiKey = config.apiKey || process.env.PAIRGATE_API_KEY || ""
    this.baseUrl = config.baseUrl || process.env.PAIRGATE_BASE_URL || "https://pairgate.com/api/v1"
    this.isTestMode = this.baseUrl.includes("/test") || this.apiKey.toLowerCase().startsWith("test_")
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

  private getEndpoint(path: string): string {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const cleanPath = path.replace(/^\/+/, "")
    if (this.isTestMode && !cleanPath.startsWith("test/")) {
      return `${cleanBaseUrl}/test/${cleanPath}`
    }
    return `${cleanBaseUrl}/${cleanPath}`
  }

  async buyAirtime(
    networkId: string,
    amount: number,
    mobileNumber: string,
    reference: string,
    _callbackUrl: string
  ): Promise<VtuTransactionResponse> {
    const url = this.getEndpoint("airtime/purchase")
    const providerSlug = NETWORK_MAP_TO_PAIRGATE[networkId] || "mtn"

    const payload = {
      provider_id: providerSlug,
      amount: amount,
      recipient: mobileNumber,
      reference: reference,
    }

    console.log(`[Pairgate Provider] Buying airtime at ${url}:`, payload)

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || (data.status && data.status !== "success" && data.code !== 200)) {
      const errMsg = data.message || data.error || `Carrier airtime failed (${response.status})`
      throw new Error(errMsg)
    }

    const txData = data.data || {}
    const innerStatus = String(txData.status || "").toLowerCase().trim()
    const isExplicitSuccess = innerStatus === "successful" || innerStatus === "delivered"
    const isExplicitFailed =
      innerStatus === "failed" ||
      innerStatus === "rejected" ||
      innerStatus === "cancelled" ||
      innerStatus === "error"

    if (isExplicitFailed) {
      throw new Error(`Carrier Rejected: ${txData.remark || txData.message || data.message || "Transaction failed on Server 2."}`)
    }

    return {
      isSuccessful: isExplicitSuccess,
      isPending: !isExplicitSuccess,
      providerReference: String(txData.reference_code || reference),
      rawResponse: data,
    }
  }

  async buyData(
    networkId: string,
    dataPlanId: string,
    mobileNumber: string,
    reference: string,
    _callbackUrl: string
  ): Promise<VtuTransactionResponse> {
    const url = this.getEndpoint("data/purchase")
    const providerSlug = NETWORK_MAP_TO_PAIRGATE[networkId] || "mtn"

    const payload = {
      provider_id: providerSlug,
      plan_id: String(dataPlanId),
      recipient: mobileNumber,
      reference: reference,
    }

    console.log(`[Pairgate Provider] Buying data at ${url}:`, payload)

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || (data.status && data.status !== "success" && data.code !== 200)) {
      const errMsg = data.message || data.error || `Carrier data purchase failed (${response.status})`
      throw new Error(errMsg)
    }

    const txData = data.data || {}
    const innerStatus = String(txData.status || "").toLowerCase().trim()
    const isExplicitSuccess = innerStatus === "successful" || innerStatus === "delivered"
    const isExplicitFailed =
      innerStatus === "failed" ||
      innerStatus === "rejected" ||
      innerStatus === "cancelled" ||
      innerStatus === "error"

    if (isExplicitFailed) {
      throw new Error(`Carrier Rejected: ${txData.remark || txData.message || data.message || "Transaction failed on Server 2."}`)
    }

    return {
      isSuccessful: isExplicitSuccess,
      isPending: !isExplicitSuccess,
      providerReference: String(txData.reference_code || reference),
      rawResponse: data,
    }
  }

  async getDataPlans(): Promise<VtuDataPlan[]> {
    return DEFAULT_PAIRGATE_PLANS
  }

  async getWalletBalance(): Promise<VtuBalanceResponse> {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const url = `${cleanBaseUrl}/wallet/balance`

    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || data.status === "error") {
      throw new Error(data.message || `Failed to fetch Pairgate wallet balance (${response.status})`)
    }

    const rawBal = data.data?.balance || data.balance || "0"
    const bal = parseFloat(String(rawBal).replace(/,/g, "").trim()) || 0

    return {
      balance: bal,
      currency: data.data?.currency || "NGN",
    }
  }

  async testConnection(): Promise<{ success: boolean; balance?: number; currency?: string; message?: string }> {
    try {
      if (!this.apiKey) {
        return { success: false, message: "API Key (Bearer Token) is required for Pairgate." }
      }
      const bal = await this.getWalletBalance()
      return {
        success: true,
        balance: bal.balance,
        currency: bal.currency,
        message: `Pairgate connected successfully! Wallet Balance: ₦${bal.balance.toLocaleString()}`,
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Failed to connect to Pairgate API.",
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
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const url = `${cleanBaseUrl}/transaction/status?reference_code=${encodeURIComponent(orderIdOrReference)}`

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
        cache: "no-store",
      })

      const data = await response.json().catch(() => ({}))
      const txData = data.data || {}
      const innerStatus = String(txData.status || "").toLowerCase().trim()

      // Only positive confirmed success from Pairgate's inner order status
      const isSuccess = data.code === 200 && (innerStatus === "successful" || innerStatus === "delivered")

      // Only positive confirmed failure from Pairgate's inner order status
      // (NEVER treat data.status === "error" or code: 201 as failed! That's just indexing/lookup delay on Pairgate's status API)
      const isFailed = data.code === 200 && (innerStatus === "failed" || innerStatus === "rejected" || innerStatus === "cancelled")

      // All other cases (processing, pending, queued, 201 indexing, 429 rate limit) are strictly PENDING!
      const isPending = !isSuccess && !isFailed

      return {
        orderId: String(txData.reference_code || orderIdOrReference),
        statusCode: String(data.code || (isSuccess ? "200" : isPending ? "100" : "400")),
        status: String(txData.status || (isSuccess ? "SUCCESSFUL" : isPending ? "PENDING" : "FAILED")),
        remark: String(txData.remark || txData.message || data.message || (isSuccess ? "Successful" : isPending ? "Processing" : "Failed")),
        network: txData.provider_id || undefined,
        mobileNumber: txData.recipient || undefined,
        amountCharged: typeof txData.amount === "number" ? txData.amount : undefined,
        walletBalance: typeof txData.balance_after === "number" ? txData.balance_after : undefined,
        isSuccessful: isSuccess,
        isPending: isPending,
        isFailed: isFailed,
        rawResponse: data,
      }
    } catch (e: any) {
      return {
        orderId: orderIdOrReference,
        statusCode: "500",
        status: "ERROR",
        remark: e.message || "Failed to query transaction status",
        isSuccessful: false,
        isPending: true,
        isFailed: false,
        rawResponse: { error: e.message },
      }
    }
  }
}

