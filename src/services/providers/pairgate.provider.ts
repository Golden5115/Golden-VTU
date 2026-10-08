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

// Live verified Pairgate plans catalog with accurate provider plan IDs and durations
const DEFAULT_PAIRGATE_PLANS: VtuDataPlan[] = [
  // MTN (CG, AWOOF, Binge & Monthly)
  { id: "14", network: "01", networkName: "MTN", name: "500MB (CG)", price: 285, validity: "7 Days" },
  { id: "15", network: "01", networkName: "MTN", name: "1GB (CG)", price: 425, validity: "7 Days" },
  { id: "16", network: "01", networkName: "MTN", name: "2GB (CG)", price: 850, validity: "30 Days" },
  { id: "17", network: "01", networkName: "MTN", name: "3GB (CG)", price: 1275, validity: "30 Days" },
  { id: "18", network: "01", networkName: "MTN", name: "5GB (CG)", price: 1600, validity: "30 Days" },
  { id: "313", network: "01", networkName: "MTN", name: "7GB (AWOOF)", price: 1850, validity: "2 Days" },
  { id: "285", network: "01", networkName: "MTN", name: "1.5GB Daily", price: 600, validity: "2 Days" },
  { id: "315", network: "01", networkName: "MTN", name: "1GB Monthly", price: 1000, validity: "30 Days" },
  { id: "296", network: "01", networkName: "MTN", name: "2GB Monthly", price: 1500, validity: "30 Days" },
  { id: "279", network: "01", networkName: "MTN", name: "10GB Monthly", price: 4000, validity: "30 Days" },
  { id: "287", network: "01", networkName: "MTN", name: "20GB Monthly", price: 6500, validity: "30 Days" },

  // Airtel (CG, AWOOF & Monthly)
  { id: "121", network: "04", networkName: "Airtel", name: "150MB (AWOOF)", price: 67, validity: "1 Day" },
  { id: "122", network: "04", networkName: "Airtel", name: "300MB (AWOOF)", price: 125, validity: "2 Days" },
  { id: "123", network: "04", networkName: "Airtel", name: "600MB (AWOOF)", price: 230, validity: "2 Days" },
  { id: "124", network: "04", networkName: "Airtel", name: "1.5GB (AWOOF)", price: 440, validity: "1 Day" },
  { id: "125", network: "04", networkName: "Airtel", name: "2GB (AWOOF)", price: 550, validity: "2 Days" },
  { id: "126", network: "04", networkName: "Airtel", name: "3GB (AWOOF)", price: 810, validity: "2 Days" },
  { id: "89", network: "04", networkName: "Airtel", name: "500MB (CG)", price: 500, validity: "7 Days" },
  { id: "90", network: "04", networkName: "Airtel", name: "1GB (CG)", price: 830, validity: "7 Days" },
  { id: "92", network: "04", networkName: "Airtel", name: "2GB (CG)", price: 1500, validity: "30 Days" },
  { id: "93", network: "04", networkName: "Airtel", name: "3GB (CG)", price: 2000, validity: "30 Days" },
  { id: "97", network: "04", networkName: "Airtel", name: "8GB (CG)", price: 3000, validity: "30 Days" },
  { id: "127", network: "04", networkName: "Airtel", name: "10GB (AWOOF)", price: 3120, validity: "30 Days" },
  { id: "99", network: "04", networkName: "Airtel", name: "10GB (CG)", price: 4000, validity: "30 Days" },
  { id: "100", network: "04", networkName: "Airtel", name: "13GB (CG)", price: 5000, validity: "30 Days" },
  { id: "103", network: "04", networkName: "Airtel", name: "25GB (CG)", price: 8000, validity: "30 Days" },

  // Glo (CG & Monthly)
  { id: "59", network: "02", networkName: "Glo", name: "200MB (CG)", price: 92, validity: "14 Days" },
  { id: "60", network: "02", networkName: "Glo", name: "500MB (CG)", price: 215, validity: "30 Days" },
  { id: "61", network: "02", networkName: "Glo", name: "1GB (CG)", price: 375, validity: "3 Days" },
  { id: "62", network: "02", networkName: "Glo", name: "1GB (CG)", price: 395, validity: "7 Days" },
  { id: "63", network: "02", networkName: "Glo", name: "1GB (CG)", price: 445, validity: "30 Days" },
  { id: "64", network: "02", networkName: "Glo", name: "2GB (CG)", price: 890, validity: "30 Days" },
  { id: "67", network: "02", networkName: "Glo", name: "3GB (CG)", price: 1335, validity: "30 Days" },
  { id: "70", network: "02", networkName: "Glo", name: "5GB (CG)", price: 2225, validity: "30 Days" },
  { id: "71", network: "02", networkName: "Glo", name: "10GB (CG)", price: 4450, validity: "30 Days" },

  // 9mobile (Corporate)
  { id: "81", network: "03", networkName: "9mobile", name: "1.0GB Corporate", price: 230, validity: "30 Days" },
  { id: "82", network: "03", networkName: "9mobile", name: "2.0GB Corporate", price: 460, validity: "30 Days" },
]

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
      const errMsg = data.message || data.error || `Pairgate airtime failed (${response.status})`
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
      const errMsg = data.message || data.error || `Pairgate data purchase failed (${response.status})`
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
}
