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

    const code = String(data.statuscode || data.statusCode || "").trim()
    const remark = String(data.remark || "").trim().toLowerCase()
    const statusText = String(data.status || "").toUpperCase()

    // 1. Confirmed Success: Code 200 with success remark
    if (code === "200" || (statusText === "ORDER_COMPLETED" && (remark === "success" || !remark) && code !== "201")) {
      return {
        isSuccessful: true,
        isPending: false,
        providerReference: data.orderid || reference,
        rawResponse: data,
      }
    }

    // 2. Pending / Queued by carrier: Code 100 (ORDER_RECEIVED), Code 300 (ORDER_PROCESSING)
    if (code === "100" || code === "300" || statusText === "ORDER_RECEIVED" || statusText === "ORDER_PROCESSING") {
      return {
        isSuccessful: false,
        isPending: true,
        providerReference: data.orderid || reference,
        rawResponse: data,
      }
    }

    // 3. Known Carrier Cancellation / Refund / Network Unresponsive
    if (
      code === "201" ||
      remark.includes("network unresponsive") ||
      remark.includes("refund") ||
      statusText.includes("REFUND") ||
      statusText.includes("CANCEL") ||
      remark.includes("cancel")
    ) {
      throw new Error(`Carrier Rejected: Network Unresponsive or Cancelled/Refunded (Code ${code || "201"}).`)
    }

    // 4. Known Carrier Cancellation: 500-599
    if (code.startsWith("5") || statusText === "ORDER_CANCELLED") {
      throw new Error(`Carrier Cancelled: ${data.remark || data.description || "Order cancelled by network"}`)
    }

    // 5. Carrier Error: 400-499
    if (code.startsWith("4") || statusText === "ORDER_ERROR") {
      throw new Error(`Carrier Error: ${data.remark || data.description || "Invalid carrier request"}`)
    }

    throw new Error(`Provider Airtime Error: ${data.remark || data.status || "Unknown carrier error"}`)
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

    const code = String(data.statuscode || data.statusCode || "").trim()
    const remark = String(data.remark || "").trim().toLowerCase()
    const statusText = String(data.status || "").toUpperCase()

    // 1. Confirmed Success: Code 200 with success remark
    if (code === "200" || (statusText === "ORDER_COMPLETED" && (remark === "success" || !remark) && code !== "201")) {
      return {
        isSuccessful: true,
        isPending: false,
        providerReference: data.orderid || reference,
        rawResponse: data,
      }
    }

    // 2. Pending / Queued by carrier: Code 100 (ORDER_RECEIVED), Code 300 (ORDER_PROCESSING)
    if (code === "100" || code === "300" || statusText === "ORDER_RECEIVED" || statusText === "ORDER_PROCESSING") {
      return {
        isSuccessful: false,
        isPending: true,
        providerReference: data.orderid || reference,
        rawResponse: data,
      }
    }

    // 3. Known Carrier Cancellation / Refund / Network Unresponsive
    if (
      code === "201" ||
      remark.includes("network unresponsive") ||
      remark.includes("refund") ||
      statusText.includes("REFUND") ||
      statusText.includes("CANCEL") ||
      remark.includes("cancel")
    ) {
      throw new Error(`Carrier Rejected: Network Unresponsive or Cancelled/Refunded (Code ${code || "201"}).`)
    }

    // 4. Known Carrier Cancellation: 500-599 (e.g. 520: Invalid network user)
    if (code.startsWith("5") || statusText === "ORDER_CANCELLED") {
      throw new Error(`Carrier Cancelled: ${data.remark || data.description || "Order cancelled by network"}`)
    }

    // 5. Carrier Error: 400-499
    if (code.startsWith("4") || statusText === "ORDER_ERROR") {
      throw new Error(`Carrier Error: ${data.remark || data.description || "Invalid carrier request"}`)
    }

    throw new Error(`Provider Data Error: ${data.remark || data.status || "Unknown carrier error"}`)
  }

  /**
   * Query transaction status live directly from ClubKonnect APIQueryV1.asp
   */
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
    const isNumeric = /^\d+$/.test(orderIdOrReference)
    const params: Record<string, string> = isNumeric ? { OrderID: orderIdOrReference } : { RequestID: orderIdOrReference }
    const data = await this.clubKonnectFetch<any>("APIQueryV1.asp", params)

    const code = String(data.statuscode || data.statusCode || "").trim()
    const remark = String(data.remark || "").trim()
    const status = String(data.status || "").toUpperCase()

    const isSuccessful = code === "200" || (status === "ORDER_COMPLETED" && remark.toLowerCase() === "success")
    const isPending =
      code === "100" ||
      code === "300" ||
      status === "ORDER_RECEIVED" ||
      status === "ORDER_PROCESSING" ||
      (code.startsWith("6") && code.length === 3)
    const isFailed =
      code === "201" ||
      status.includes("REFUND") ||
      status.includes("CANCEL") ||
      remark.toLowerCase().includes("refund") ||
      remark.toLowerCase().includes("cancel") ||
      (code.startsWith("4") && code.length === 3) ||
      (code.startsWith("5") && code.length === 3)

    return {
      orderId: data.orderid || "",
      statusCode: code,
      status,
      remark,
      network: data.mobilenetwork,
      mobileNumber: data.mobilenumber,
      amountCharged: parseFloat(String(data.amountcharged || "0").replace(/,/g, "")),
      walletBalance: parseFloat(String(data.walletbalance || "0").replace(/,/g, "")),
      isSuccessful,
      isPending,
      isFailed,
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
                const rawPrice = item.PRODUCT_AMOUNT || "0"
                const planPrice = parseFloat(String(rawPrice).replace(/,/g, "").trim()) || 0
                // Add ₦100 profit markup on every data bundle
                const DATA_PROFIT_MARKUP = 100
                const customerPrice = planPrice > 0 ? planPrice + DATA_PROFIT_MARKUP : planPrice

                if (planId && planName) {
                  const lowerName = planName.toLowerCase()
                  let extractedValidity = "30 Days"
                  if (lowerName.includes("1 day") || lowerName.includes("daily") || lowerName.includes("24 hrs")) {
                    extractedValidity = "1 Day"
                  } else if (lowerName.includes("2 day") || lowerName.includes("2days")) {
                    extractedValidity = "2 Days"
                  } else if (lowerName.includes("3 day") || lowerName.includes("3days")) {
                    extractedValidity = "3 Days"
                  } else if (lowerName.includes("7 day") || lowerName.includes("weekly") || lowerName.includes("1 week")) {
                    extractedValidity = "7 Days"
                  } else if (lowerName.includes("14 day") || lowerName.includes("2 week")) {
                    extractedValidity = "14 Days"
                  } else if (lowerName.includes("60 day") || lowerName.includes("2 month")) {
                    extractedValidity = "60 Days"
                  } else if (lowerName.includes("90 day") || lowerName.includes("3 month")) {
                    extractedValidity = "90 Days"
                  } else if (lowerName.includes("365 day") || lowerName.includes("yearly") || lowerName.includes("1 year")) {
                    extractedValidity = "1 Year"
                  }

                  plans.push({
                    id: planId.toString(),
                    network: networkId.toString(),
                    networkName: NETWORK_MAP[networkId.toString()] || networkName,
                    name: planName,
                    price: customerPrice,
                    validity: extractedValidity,
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
    const rawBal = data.Balance || data.balance || data.walletbalance || "0"
    const cleaned = String(rawBal).replace(/,/g, "").trim()
    const balanceNum = parseFloat(cleaned) || 0
    return {
      balance: balanceNum,
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
