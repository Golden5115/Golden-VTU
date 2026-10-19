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

// Live verified Pairgate plans catalogue with accurate provider plan IDs and durations
const DATA_PROFIT_MARKUP = 100

const RAW_PAIRGATE_PLANS = [
  // MTN (CG - 30 Days)
  { id: "14", network: "01", networkName: "MTN", name: "500MB (CG)", rawPrice: 270, validity: "30 Days" },
  { id: "15", network: "01", networkName: "MTN", name: "1GB (CG)", rawPrice: 415, validity: "30 Days" },
  { id: "16", network: "01", networkName: "MTN", name: "2GB (CG)", rawPrice: 830, validity: "30 Days" },
  { id: "17", network: "01", networkName: "MTN", name: "3GB (CG)", rawPrice: 1245, validity: "30 Days" },
  { id: "18", network: "01", networkName: "MTN", name: "5GB (CG)", rawPrice: 2075, validity: "30 Days" },

  // Airtel (CG - Corporate Gifting - Genuine 30-Day Data Bundles)
  { id: "89", network: "04", networkName: "Airtel", name: "500MB (CG)", rawPrice: 500, validity: "7 Days" },
  { id: "90", network: "04", networkName: "Airtel", name: "1GB (CG)", rawPrice: 830, validity: "7 Days" },
  { id: "91", network: "04", networkName: "Airtel", name: "1.5GB (CG)", rawPrice: 1000, validity: "7 Days" },
  { id: "92", network: "04", networkName: "Airtel", name: "2GB (CG - 30 Days)", rawPrice: 1500, validity: "30 Days" },
  { id: "93", network: "04", networkName: "Airtel", name: "3GB (CG - 30 Days)", rawPrice: 2000, validity: "30 Days" },
  { id: "95", network: "04", networkName: "Airtel", name: "4GB (CG - 30 Days)", rawPrice: 2500, validity: "30 Days" },
  { id: "97", network: "04", networkName: "Airtel", name: "8GB (CG - 30 Days)", rawPrice: 3000, validity: "30 Days" },
  { id: "99", network: "04", networkName: "Airtel", name: "10GB (CG - 30 Days)", rawPrice: 4000, validity: "30 Days" },
  { id: "100", network: "04", networkName: "Airtel", name: "13GB (CG - 30 Days)", rawPrice: 5000, validity: "30 Days" },
  { id: "102", network: "04", networkName: "Airtel", name: "18GB (CG - 30 Days)", rawPrice: 6000, validity: "30 Days" },
  { id: "103", network: "04", networkName: "Airtel", name: "25GB (CG - 30 Days)", rawPrice: 8000, validity: "30 Days" },

  // Airtel Gifting (Alternative direct options)
  { id: "189", network: "04", networkName: "Airtel", name: "110MB Daily", rawPrice: 100, validity: "1 Day" },
  { id: "209", network: "04", networkName: "Airtel", name: "1GB Weekly", rawPrice: 800, validity: "7 Days" },
  { id: "195", network: "04", networkName: "Airtel", name: "2GB Monthly (Gifting)", rawPrice: 1500, validity: "30 Days" },
  { id: "207", network: "04", networkName: "Airtel", name: "3GB Monthly (Gifting)", rawPrice: 2000, validity: "30 Days" },

  // Glo (CG - Corporate Gifting)
  { id: "59", network: "02", networkName: "Glo", name: "200MB (CG)", rawPrice: 92, validity: "14 Days" },
  { id: "60", network: "02", networkName: "Glo", name: "500MB (CG)", rawPrice: 215, validity: "30 Days" },
  { id: "62", network: "02", networkName: "Glo", name: "1GB (CG - Weekly)", rawPrice: 395, validity: "7 Days" },
  { id: "63", network: "02", networkName: "Glo", name: "1GB (CG - 30 Days)", rawPrice: 445, validity: "30 Days" },
  { id: "64", network: "02", networkName: "Glo", name: "2GB (CG - 30 Days)", rawPrice: 890, validity: "30 Days" },
  { id: "67", network: "02", networkName: "Glo", name: "3GB (CG - 30 Days)", rawPrice: 1335, validity: "30 Days" },
  { id: "70", network: "02", networkName: "Glo", name: "5GB (CG - 30 Days)", rawPrice: 2225, validity: "30 Days" },
  { id: "71", network: "02", networkName: "Glo", name: "10GB (CG - 30 Days)", rawPrice: 4450, validity: "30 Days" },

  // 9mobile (SME - 30 Days)
  { id: "128", network: "03", networkName: "9mobile", name: "500MB (SME)", rawPrice: 260, validity: "30 Days" },
  { id: "129", network: "03", networkName: "9mobile", name: "1GB (SME)", rawPrice: 515, validity: "30 Days" },
  { id: "130", network: "03", networkName: "9mobile", name: "1.5GB (SME)", rawPrice: 750, validity: "30 Days" },
  { id: "131", network: "03", networkName: "9mobile", name: "2GB (SME)", rawPrice: 1030, validity: "30 Days" },
  { id: "132", network: "03", networkName: "9mobile", name: "3GB (SME)", rawPrice: 1545, validity: "30 Days" },
  { id: "135", network: "03", networkName: "9mobile", name: "5GB (SME)", rawPrice: 2575, validity: "30 Days" },
]

export const DEFAULT_PAIRGATE_PLANS: VtuDataPlan[] = RAW_PAIRGATE_PLANS.map((p) => ({
  id: p.id,
  network: p.network,
  networkName: p.networkName,
  name: p.name,
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

    const isSuccess = data.status === "success" || data.code === 200
    const isPending = data.data?.status === "processing" || data.data?.status === "pending"

    return {
      isSuccessful: isSuccess && !isPending,
      isPending: isPending,
      providerReference: String(data.data?.reference_code || reference),
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

    const isSuccess = data.status === "success" || data.code === 200
    const isPending = data.data?.status === "processing" || data.data?.status === "pending"

    return {
      isSuccessful: isSuccess && !isPending,
      isPending: isPending,
      providerReference: String(data.data?.reference_code || reference),
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
      const txStatus = (txData.status || data.status || "").toLowerCase()
      const isSuccess = txStatus === "successful" || txStatus === "success"
      const isPending = txStatus === "processing" || txStatus === "pending"
      const isFailed = txStatus === "failed" || data.status === "error"

      return {
        orderId: String(txData.reference_code || orderIdOrReference),
        statusCode: String(data.code || (isSuccess ? "200" : isPending ? "100" : "400")),
        status: String(txData.status || data.status || "UNKNOWN").toUpperCase(),
        remark: String(data.message || txData.message || (isSuccess ? "Successful" : isPending ? "Processing" : "Failed")),
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

