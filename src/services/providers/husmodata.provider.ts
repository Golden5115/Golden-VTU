import {
  IVtuProvider,
  ProviderInitConfig,
  VtuBalanceResponse,
  VtuDataPlan,
  VtuTransactionResponse,
} from "./vtu-provider.interface"

// Map our standardized network IDs ("01", "02", "03", "04") to Husmodata network integers
// 1 = MTN, 2 = GLO, 3 = 9MOBILE, 4 = AIRTEL
const NETWORK_INT_MAP: Record<string, number> = {
  "01": 1,
  "02": 2,
  "03": 3,
  "04": 4,
}

// Standard SME data plans catalogue commonly used across Nigerian MSorg / SME portals
const STANDARD_SME_PLANS: VtuDataPlan[] = [
  // MTN SME
  { id: "7", network: "01", networkName: "MTN", name: "500MB SME (30 Days)", price: 145, validity: "30 Days" },
  { id: "8", network: "01", networkName: "MTN", name: "1.0GB SME (30 Days)", price: 280, validity: "30 Days" },
  { id: "9", network: "01", networkName: "MTN", name: "2.0GB SME (30 Days)", price: 560, validity: "30 Days" },
  { id: "10", network: "01", networkName: "MTN", name: "3.0GB SME (30 Days)", price: 840, validity: "30 Days" },
  { id: "11", network: "01", networkName: "MTN", name: "5.0GB SME (30 Days)", price: 1400, validity: "30 Days" },
  { id: "12", network: "01", networkName: "MTN", name: "10.0GB SME (30 Days)", price: 2800, validity: "30 Days" },

  // Airtel SME / Corporate
  { id: "20", network: "04", networkName: "Airtel", name: "500MB Corporate (30 Days)", price: 220, validity: "30 Days" },
  { id: "21", network: "04", networkName: "Airtel", name: "1.0GB Corporate (30 Days)", price: 440, validity: "30 Days" },
  { id: "22", network: "04", networkName: "Airtel", name: "2.0GB Corporate (30 Days)", price: 880, validity: "30 Days" },
  { id: "23", network: "04", networkName: "Airtel", name: "5.0GB Corporate (30 Days)", price: 2200, validity: "30 Days" },

  // GLO Corporate / Data
  { id: "30", network: "02", networkName: "Glo", name: "500MB Corporate (30 Days)", price: 220, validity: "30 Days" },
  { id: "31", network: "02", networkName: "Glo", name: "1.0GB Corporate (30 Days)", price: 440, validity: "30 Days" },
  { id: "32", network: "02", networkName: "Glo", name: "2.0GB Corporate (30 Days)", price: 880, validity: "30 Days" },
  { id: "33", network: "02", networkName: "Glo", name: "5.0GB Corporate (30 Days)", price: 2200, validity: "30 Days" },

  // 9mobile Corporate (Budget)
  { id: "40", network: "03", networkName: "9mobile", name: "500MB Corporate (30 Days)", price: 100, validity: "30 Days" },
  { id: "41", network: "03", networkName: "9mobile", name: "1.0GB Corporate (30 Days)", price: 190, validity: "30 Days" },
  { id: "42", network: "03", networkName: "9mobile", name: "2.0GB Corporate (30 Days)", price: 370, validity: "30 Days" },
  { id: "43", network: "03", networkName: "9mobile", name: "5.0GB Corporate (30 Days)", price: 920, validity: "30 Days" },
]

export class HusmodataProvider implements IVtuProvider {
  readonly identifier = "HUSMODATA"

  private apiKey: string = ""
  private baseUrl: string = "https://husmodata.com/api"

  initialize(config: ProviderInitConfig): void {
    this.apiKey = config.apiKey || process.env.HUSMODATA_API_KEY || ""
    this.baseUrl = config.baseUrl || process.env.HUSMODATA_BASE_URL || "https://husmodata.com/api"
  }

  private getHeaders(): Record<string, string> {
    const cleanToken = this.apiKey.replace(/^Token\s+/i, "")
    return {
      Authorization: `Token ${cleanToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    }
  }

  async buyAirtime(
    networkId: string,
    amount: number,
    mobileNumber: string,
    reference: string,
    callbackUrl: string
  ): Promise<VtuTransactionResponse> {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const url = `${cleanBaseUrl}/topup/`
    const netInt = NETWORK_INT_MAP[networkId] || 1

    const payload = {
      network: netInt,
      amount: amount,
      mobile_number: mobileNumber,
      Ported_number: true,
      airtime_type: "VTU",
      ref: reference,
    }

    console.log(`[Husmodata Provider] Buying airtime:`, payload)

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Husmodata airtime failed (${response.status}): ${err}`)
    }

    const data = await response.json()
    const statusLower = (data.Status || data.status || "").toLowerCase()
    const isSuccess = statusLower === "successful" || statusLower === "success"
    const isPending = statusLower === "processing" || statusLower === "pending"

    if (!isSuccess && !isPending) {
      throw new Error(data.msg || data.detail || data.error || "Husmodata topup failed")
    }

    return {
      isSuccessful: isSuccess,
      isPending: isPending,
      providerReference: String(data.id || data.ident || reference),
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
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const url = `${cleanBaseUrl}/data/`
    const netInt = NETWORK_INT_MAP[networkId] || 1

    const payload = {
      network: netInt,
      mobile_number: mobileNumber,
      plan: parseInt(dataPlanId) || dataPlanId,
      Ported_number: true,
      ref: reference,
    }

    console.log(`[Husmodata Provider] Buying data:`, payload)

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Husmodata data purchase failed (${response.status}): ${err}`)
    }

    const data = await response.json()
    const statusLower = (data.Status || data.status || "").toLowerCase()
    const isSuccess = statusLower === "successful" || statusLower === "success"
    const isPending = statusLower === "processing" || statusLower === "pending"

    if (!isSuccess && !isPending) {
      throw new Error(data.msg || data.detail || data.error || "Husmodata data purchase failed")
    }

    return {
      isSuccessful: isSuccess,
      isPending: isPending,
      providerReference: String(data.id || data.ident || reference),
      rawResponse: data,
    }
  }

  async getDataPlans(): Promise<VtuDataPlan[]> {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    // Try to fetch dynamic plans if endpoint exists
    try {
      const response = await fetch(`${cleanBaseUrl}/plans/`, {
        headers: this.getHeaders(),
        next: { revalidate: 3600 },
      })
      if (response.ok) {
        const raw = await response.json()
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.map((item: any) => ({
            id: String(item.id || item.plan_id),
            network: String(item.network_id || item.network || "01").padStart(2, "0"),
            networkName: item.network_name || "MTN",
            name: item.plan_name || item.name,
            price: parseFloat(item.price || item.plan_amount || "0"),
          }))
        }
      }
    } catch {
      // Fallback to standard SME catalog
    }

    return STANDARD_SME_PLANS
  }

  async getWalletBalance(): Promise<VtuBalanceResponse> {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const url = `${cleanBaseUrl}/user/`

    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Husmodata balance error (${response.status}): ${response.statusText}`)
    }

    const data = await response.json()
    const bal = parseFloat(
      data.user?.wallet_balance || data.wallet_balance || data.user_wallet || "0"
    )

    return {
      balance: bal,
      currency: "NGN",
    }
  }

  async testConnection(): Promise<{ success: boolean; balance?: number; currency?: string; message?: string }> {
    try {
      if (!this.apiKey) {
        return { success: false, message: "Authorization Token is required for SME Provider." }
      }
      const bal = await this.getWalletBalance()
      return {
        success: true,
        balance: bal.balance,
        currency: bal.currency,
        message: `SME Provider Connected. Wallet balance: ₦${bal.balance.toLocaleString()}`,
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Failed to connect to SME VTU Provider.",
      }
    }
  }
}
