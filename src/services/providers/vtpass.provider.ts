import {
  IVtuProvider,
  ProviderInitConfig,
  VtuBalanceResponse,
  VtuDataPlan,
  VtuTransactionResponse,
} from "./vtu-provider.interface"

const NETWORK_SERVICE_ID_MAP: Record<string, { airtime: string; data: string; name: string }> = {
  "01": { airtime: "mtn", data: "mtn-data", name: "MTN" },
  "02": { airtime: "glo", data: "glo-data", name: "Glo" },
  "03": { airtime: "etisalat", data: "etisalat-data", name: "9mobile" },
  "04": { airtime: "airtel", data: "airtel-data", name: "Airtel" },
}

export class VtpassProvider implements IVtuProvider {
  readonly identifier = "VTPASS"

  private apiKey: string = ""
  private secretKey: string = ""
  private publicKey: string = ""
  private baseUrl: string = "https://api-service.vtpass.com/api"

  initialize(config: ProviderInitConfig): void {
    this.apiKey = config.apiKey || process.env.VTPASS_API_KEY || ""
    this.secretKey = config.secretKey || process.env.VTPASS_SECRET_KEY || ""
    this.publicKey = config.publicKey || process.env.VTPASS_PUBLIC_KEY || ""
    this.baseUrl = config.baseUrl || process.env.VTPASS_BASE_URL || "https://api-service.vtpass.com/api"
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": this.apiKey,
    }
    if (this.secretKey) {
      headers["secret-key"] = this.secretKey
    }
    if (this.publicKey) {
      headers["public-key"] = this.publicKey
    }
    return headers
  }

  // Generates VTPass specific requestId in format YYYYMMDDHHMMSS + unique string
  private generateRequestId(prefix: string): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hours = String(now.getHours()).padStart(2, "0")
    const minutes = String(now.getMinutes()).padStart(2, "0")
    const seconds = String(now.getSeconds()).padStart(2, "0")
    const dateStr = `${year}${month}${day}${hours}${minutes}${seconds}`
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    return `${dateStr}${prefix}${randomSuffix}`.slice(0, 30)
  }

  async buyAirtime(
    networkId: string,
    amount: number,
    mobileNumber: string,
    reference: string,
    callbackUrl: string
  ): Promise<VtuTransactionResponse> {
    const networkMeta = NETWORK_SERVICE_ID_MAP[networkId] || NETWORK_SERVICE_ID_MAP["01"]
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const url = `${cleanBaseUrl}/pay`

    const payload = {
      request_id: this.generateRequestId("AIR"),
      serviceID: networkMeta.airtime,
      amount: amount,
      phone: mobileNumber,
    }

    console.log(`[VTPass Provider] Buying airtime:`, payload.serviceID, amount, mobileNumber)

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`VTPass API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const isSuccess = data.code === "000"
    const isPending = data.code === "099" || data.status === "pending"

    if (!isSuccess && !isPending) {
      throw new Error(data.response_description || data.message || "VTPass airtime transaction failed")
    }

    return {
      isSuccessful: isSuccess,
      isPending: isPending,
      providerReference: data.transactionId || data.requestId || reference,
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
    const networkMeta = NETWORK_SERVICE_ID_MAP[networkId] || NETWORK_SERVICE_ID_MAP["01"]
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const url = `${cleanBaseUrl}/pay`

    const payload = {
      request_id: this.generateRequestId("DAT"),
      serviceID: networkMeta.data,
      billersCode: mobileNumber,
      variation_code: dataPlanId,
      phone: mobileNumber,
    }

    console.log(`[VTPass Provider] Buying data:`, payload.serviceID, dataPlanId, mobileNumber)

    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`VTPass API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const isSuccess = data.code === "000"
    const isPending = data.code === "099" || data.status === "pending"

    if (!isSuccess && !isPending) {
      throw new Error(data.response_description || data.message || "VTPass data bundle transaction failed")
    }

    return {
      isSuccessful: isSuccess,
      isPending: isPending,
      providerReference: data.transactionId || data.requestId || reference,
      rawResponse: data,
    }
  }

  async getDataPlans(): Promise<VtuDataPlan[]> {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const plans: VtuDataPlan[] = []

    // Fetch variations for each supported network
    for (const [netId, netMeta] of Object.entries(NETWORK_SERVICE_ID_MAP)) {
      try {
        const url = `${cleanBaseUrl}/service-variations?serviceID=${netMeta.data}`
        const response = await fetch(url, {
          headers: { Accept: "application/json", "api-key": this.apiKey },
          next: { revalidate: 3600 },
        })

        if (response.ok) {
          const data = await response.json()
          const variations = data.content?.varations || data.content?.variations || []

          for (const item of variations) {
            if (item.variation_code) {
              plans.push({
                id: item.variation_code,
                network: netId,
                networkName: netMeta.name,
                name: item.name || item.variation_code,
                price: parseFloat(item.variation_amount || "0"),
              })
            }
          }
        }
      } catch (err) {
        console.warn(`[VTPass Provider] Failed to fetch plans for ${netMeta.data}:`, err)
      }
    }

    return plans
  }

  async getWalletBalance(): Promise<VtuBalanceResponse> {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const url = `${cleanBaseUrl}/balance`

    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`VTPass balance error: ${response.statusText}`)
    }

    const data = await response.json()
    const rawBal = data.contents?.balance || data.content?.balance || data.balance || "0"
    const balanceNum = parseFloat(String(rawBal).replace(/,/g, "").trim()) || 0

    return {
      balance: balanceNum,
      currency: "NGN",
    }
  }

  async testConnection(): Promise<{ success: boolean; balance?: number; currency?: string; message?: string }> {
    try {
      if (!this.apiKey) {
        return { success: false, message: "API Key is required for VTPass." }
      }
      const bal = await this.getWalletBalance()
      return {
        success: true,
        balance: bal.balance,
        currency: bal.currency,
        message: `VTPass Connected. Live balance: ₦${bal.balance.toLocaleString()}`,
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Failed to connect to VTPass.",
      }
    }
  }
}
