import {
  IVtuProvider,
  ProviderInitConfig,
  VtuBalanceResponse,
  VtuDataPlan,
  VtuTransactionResponse,
} from "./vtu-provider.interface"

// Map user-friendly network names to ClubKonnect network IDs
const NETWORK_MAP: Record<string, string> = {
  "01": "MTN",
  "02": "Glo",
  "03": "9mobile",
  "04": "Airtel",
}

const NETWORK_ID_MAP: Record<string, string> = {
  MTN: "01",
  GLO: "02",
  "9MOBILE": "03",
  AIRTEL: "04",
}

export class ClubKonnectProvider implements IVtuProvider {
  readonly identifier = "CLUBKONNECT"

  private apiKey: string = ""
  private baseUrl: string = "https://www.nellobytesystems.com"
  private userId: string = ""

  initialize(config: ProviderInitConfig): void {
    this.apiKey = config.apiKey || process.env.CLUBKONNECT_API_KEY || ""
    this.baseUrl = config.baseUrl || process.env.CLUBKONNECT_BASE_URL || "https://www.nellobytesystems.com"

    if (config.userId) {
      this.userId = config.userId
    } else if (this.apiKey.includes("|")) {
      const parts = this.apiKey.split("|")
      this.userId = parts[0]
      this.apiKey = parts[1]
    } else {
      this.userId = process.env.CLUBKONNECT_USER_ID || ""
    }
  }

  private async clubKonnectFetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const url = new URL(`${cleanBaseUrl}/${endpoint}`)
    url.searchParams.set("UserID", this.userId)
    url.searchParams.set("APIKey", this.apiKey)

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }

    console.log(`[ClubKonnect Provider] Calling: ${endpoint}`)

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`ClubKonnect API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (data.status === "INVALID_CREDENTIALS") {
      throw new Error("ClubKonnect: Invalid API credentials")
    }
    if (data.status === "MISSING_CREDENTIALS") {
      throw new Error("ClubKonnect: Missing API credentials")
    }

    return data as T
  }

  async buyAirtime(
    networkId: string,
    amount: number,
    mobileNumber: string,
    reference: string,
    callbackUrl: string
  ): Promise<VtuTransactionResponse> {
    const data = await this.clubKonnectFetch<any>("APIAirtimeV1.asp", {
      MobileNetwork: networkId,
      Amount: amount.toString(),
      MobileNumber: mobileNumber,
      RequestID: reference,
      CallBackURL: callbackUrl,
    })

    if (data.statuscode !== "100" && data.statuscode !== "200") {
      throw new Error(`ClubKonnect Error: ${data.status || "Unknown error"}`)
    }

    return {
      isSuccessful: data.statuscode === "200",
      isPending: data.statuscode === "100",
      providerReference: data.orderid || reference,
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
    const data = await this.clubKonnectFetch<any>("APIDatabundleV1.asp", {
      MobileNetwork: networkId,
      DataPlan: dataPlanId,
      MobileNumber: mobileNumber,
      RequestID: reference,
      CallBackURL: callbackUrl,
    })

    if (data.statuscode !== "100" && data.statuscode !== "200") {
      throw new Error(`ClubKonnect Data Error: ${data.status || "Unknown error"}`)
    }

    return {
      isSuccessful: data.statuscode === "200",
      isPending: data.statuscode === "100",
      providerReference: data.orderid || reference,
      rawResponse: data,
    }
  }

  async getDataPlans(): Promise<VtuDataPlan[]> {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const url = `${cleanBaseUrl}/APIDatabundlePlansV2.asp?UserID=${this.userId}`

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch data plans: ${response.status}`)
    }

    const rawData = await response.json()
    const plans: VtuDataPlan[] = []

    let networksContainer = rawData
    if (rawData.MOBILE_NETWORK) {
      networksContainer = rawData.MOBILE_NETWORK
    }

    if (typeof networksContainer === "object") {
      for (const [networkName, networkData] of Object.entries(networksContainer)) {
        if (Array.isArray(networkData)) {
          for (const networkEntry of networkData) {
            const networkId = networkEntry.ID || NETWORK_ID_MAP[networkName.toUpperCase()] || ""

            if (Array.isArray(networkEntry.PRODUCT)) {
              for (const item of networkEntry.PRODUCT) {
                const planId = item.PRODUCT_ID || ""
                const planName = item.PRODUCT_NAME || ""
                const planPrice = parseFloat(item.PRODUCT_AMOUNT || "0")

                if (planId && planName) {
                  plans.push({
                    id: planId.toString(),
                    network: networkId.toString(),
                    networkName: NETWORK_MAP[networkId.toString()] || networkName,
                    name: planName,
                    price: planPrice,
                  })
                }
              }
            }
          }
        }
      }
    }

    return plans
  }

  async getWalletBalance(): Promise<VtuBalanceResponse> {
    const data = await this.clubKonnectFetch<any>("APIWalletBalanceV1.asp", {})
    return {
      balance: parseFloat(data.Balance || data.balance || "0"),
      currency: "NGN",
    }
  }

  async testConnection(): Promise<{ success: boolean; balance?: number; currency?: string; message?: string }> {
    try {
      if (!this.userId || !this.apiKey) {
        return {
          success: false,
          message: "User ID or API Key is missing. Please ensure both are configured.",
        }
      }
      const bal = await this.getWalletBalance()
      return {
        success: true,
        balance: bal.balance,
        currency: bal.currency,
        message: `Connected successfully. Wallet balance: ₦${bal.balance.toLocaleString()}`,
      }
    } catch (err: any) {
      return {
        success: false,
        message: err.message || "Failed to connect to ClubKonnect.",
      }
    }
  }
}
