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

// Map nominal/legacy PRODUCT_ID values to official ClubKonnect APIDatabundleV1.asp PRODUCT_CODE values
const CK_PRODUCT_ID_TO_CODE_MAP: Record<string, Record<string, string>> = {
  "01": {
    "500": "2",
    "1000": "4",
    "2000": "5",
    "3000": "6",
    "500.00": "9",
    "1000.00": "10",
    "2000.00": "11",
    "3000.00": "12",
    "5000.00": "13",
    "100.01": "38",
    "200.01": "39",
    "350.01": "40",
    "500.01": "14",
    "750.01": "15",
    "900.01": "16",
    "1000.01": "17",
    "500.02": "18",
    "800.01": "19",
    "1000.03": "40",
    "1500.03": "41",
    "2500.01": "20",
    "3500.01": "21",
    "1500.02": "22",
    "2000.01": "23",
    "2500.02": "24",
    "3500.02": "26",
    "4500.01": "27",
    "5500.01": "28",
    "6500.01": "29",
    "7500.01": "30",
    "9000.01": "31",
    "11000.01": "32",
    "18000.01": "33",
    "35000.01": "34",
    "40000.01": "35",
    "5000.01": "36",
    "90000.03": "37",
  },
  "02": {
    "200": "1",
    "500": "2",
    "1000": "3",
    "2000": "4",
    "3000": "5",
    "5000": "6",
    "10000": "7",
    "1000.11": "8",
    "3000.11": "9",
    "5000.11": "10",
    "1000.12": "11",
    "3000.12": "12",
    "5000.12": "13",
    "1000.21": "37",
    "3000.21": "38",
    "5000.21": "39",
    "10000.21": "40",
    "100.01": "14",
    "200.01": "15",
    "500.01": "16",
    "1000.01": "17",
    "1500.01": "18",
    "2000.01": "19",
    "2500.01": "20",
    "3000.01": "21",
    "4000.01": "22",
    "5000.01": "23",
    "8000.01": "24",
    "10000.01": "25",
    "15000.01": "26",
    "20000.01": "27",
    "500.02": "28",
    "1500.02": "29",
    "500.03": "30",
    "200.02": "31",
    "30000.01": "32",
    "36000.01": "33",
    "50000.01": "34",
    "60000.01": "35",
    "75000.01": "36",
    "150000.03": "41",
  },
  "03": {
    "50": "1",
    "100": "2",
    "300": "3",
    "500": "4",
    "1000": "5",
    "2000": "6",
    "3000": "7",
    "4000": "8",
    "5000": "9",
    "10000": "10",
    "15000": "11",
    "20000": "12",
    "25000": "13",
    "100.01": "14",
    "150.01": "15",
    "200.01": "16",
    "350.01": "17",
    "500.01": "18",
    "1500.01": "19",
    "600.01": "20",
    "1000.01": "21",
    "1200.01": "22",
    "2000.01": "23",
    "2500.01": "24",
    "3000.01": "25",
    "4000.01": "26",
    "5000.01": "27",
    "12000.01": "28",
    "18500.01": "29",
    "20000.01": "30",
    "30000.01": "31",
  },
  "04": {
    "499.91": "14",
    "599.91": "15",
    "749.91": "16",
    "999.91": "17",
    "1499.91": "18",
    "499.92": "19",
    "799.91": "20",
    "999.92": "21",
    "1499.92": "22",
    "2499.91": "23",
    "2999.91": "24",
    "4999.91": "25",
    "1499.93": "26",
    "1999.91": "27",
    "2499.92": "28",
    "2999.92": "29",
    "3999.91": "30",
    "4999.92": "31",
    "5999.91": "32",
    "7999.91": "33",
    "9999.91": "34",
    "14999.91": "35",
    "19999.91": "36",
    "29999.91": "37",
    "39999.91": "38",
    "49999.91": "39",
    "59999.91": "40",
  },
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

  private async clubKonnectFetch<T>(endpoint: string, params: Record<string, string>, timeoutMs = 35000): Promise<T> {
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
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      if (response.status === 503) {
        throw new Error("Carrier Route Unavailable (HTTP 503): This bundle route is temporarily down for maintenance on Server 1. Please try an alternative bundle or switch to Server 2.")
      }
      throw new Error(`Carrier API error: ${response.status} ${response.statusText}`)
    }

    let data: any
    try {
      data = await response.json()
    } catch {
      throw new Error("Carrier returned an invalid non-JSON response.")
    }

    if (data.status === "INVALID_CREDENTIALS") {
      throw new Error("Carrier: Invalid API credentials")
    }
    if (data.status === "MISSING_CREDENTIALS") {
      throw new Error("Carrier: Missing API credentials")
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
    const params: Record<string, string> = {
      MobileNetwork: networkId,
      Amount: amount.toString(),
      MobileNumber: mobileNumber,
      RequestID: reference,
    }

    if (callbackUrl && process.env.CLUBKONNECT_ENABLE_CALLBACK === "true") {
      params.CallBackURL = callbackUrl
    }

    const data = await this.clubKonnectFetch<any>("APIAirtimeV1.asp", params)

    const code = String(data.statuscode || data.statusCode || "").trim()
    const remark = String(data.remark || "").trim().toLowerCase()
    const statusText = String(data.status || "").toUpperCase()

    // 1. Confirmed Success: Code 200, 299, or ORDER_COMPLETED (with non-refund remark)
    if (
      code === "200" ||
      code === "299" ||
      (statusText === "ORDER_COMPLETED" && code !== "201" && !remark.includes("refund") && !remark.includes("cancel"))
    ) {
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
    // Resolve dataPlanId: ensure we pass active numeric PRODUCT_CODE (e.g. "2", "4", "5") as expected by APIDatabundleV1.asp
    // If a nominal PRODUCT_ID (e.g. "500", "500.00", "1000", "1000.00") was passed, resolve it to the active PRODUCT_CODE
    let resolvedPlanId = String(dataPlanId).trim()
    const codeMap = CK_PRODUCT_ID_TO_CODE_MAP[networkId]
    if (codeMap && codeMap[resolvedPlanId]) {
      console.log(`[ClubKonnect Provider] Resolving nominal PRODUCT_ID "${resolvedPlanId}" -> active PRODUCT_CODE "${codeMap[resolvedPlanId]}"`)
      resolvedPlanId = codeMap[resolvedPlanId]
    }

    const params: Record<string, string> = {
      MobileNetwork: networkId,
      DataPlan: resolvedPlanId,
      MobileNumber: mobileNumber,
      RequestID: reference,
    }

    if (callbackUrl && process.env.CLUBKONNECT_ENABLE_CALLBACK === "true") {
      params.CallBackURL = callbackUrl
    }

    const data = await this.clubKonnectFetch<any>("APIDatabundleV1.asp", params)

    const code = String(data.statuscode || data.statusCode || "").trim()
    const remark = String(data.remark || "").trim().toLowerCase()
    const statusText = String(data.status || "").toUpperCase()

    // 1. Confirmed Success: Code 200, 299, or ORDER_COMPLETED (with non-refund remark)
    if (
      code === "200" ||
      code === "299" ||
      (statusText === "ORDER_COMPLETED" && code !== "201" && !remark.includes("refund") && !remark.includes("cancel"))
    ) {
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
    const data = await this.clubKonnectFetch<any>("APIQueryV1.asp", params, 15000)

    const code = String(data.statuscode || data.statusCode || "").trim()
    const remark = String(data.remark || "").trim()
    const status = String(data.status || "").toUpperCase()

    const isSuccessful =
      code === "200" ||
      code === "299" ||
      (status === "ORDER_COMPLETED" &&
        code !== "201" &&
        !remark.toLowerCase().includes("refund") &&
        !remark.toLowerCase().includes("cancel"))
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

  /**
   * Cancel transaction via ClubKonnect APICancelV1.asp
   */
  async cancelTransaction(orderId: string): Promise<{
    orderId: string
    status: string
    isCancelled: boolean
    rawResponse: any
  }> {
    try {
      const data = await this.clubKonnectFetch<any>("APICancelV1.asp", { OrderID: orderId }, 15000)
      const isCancelled = String(data.status || "").toUpperCase() === "ORDER_CANCELLED" || String(data.statuscode || "") === "500"
      return {
        orderId: data.orderid || orderId,
        status: data.status || "",
        isCancelled,
        rawResponse: data,
      }
    } catch (err: any) {
      console.warn(`[ClubKonnect Provider] APICancelV1.asp notice for order ${orderId}:`, err.message)
      return {
        orderId,
        status: "CANCEL_FAILED",
        isCancelled: false,
        rawResponse: { error: err.message },
      }
    }
  }

  async getDataPlans(): Promise<VtuDataPlan[]> {
    const cleanBaseUrl = this.baseUrl.replace(/\/+$/, "")
    const url = `${cleanBaseUrl}/APIDatabundlePlansV2.asp?UserID=${this.userId}`

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
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
                // Must use official ClubKonnect DataPlan numeric PRODUCT_CODE as expected by APIDatabundleV1.asp
                const planId = (item.PRODUCT_CODE || item.PRODUCT_ID || "").toString()
                const planName = item.PRODUCT_NAME || ""
                const rawPrice = item.PRODUCT_AMOUNT || "0"
                const planPrice = parseFloat(String(rawPrice).replace(/,/g, "").trim()) || 0
                // Add ₦100 profit markup on every data bundle
                const DATA_PROFIT_MARKUP = 100
                const customerPrice = planPrice > 0 ? Math.ceil(planPrice + DATA_PROFIT_MARKUP) : planPrice

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
                    rawPrice: planPrice,
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
