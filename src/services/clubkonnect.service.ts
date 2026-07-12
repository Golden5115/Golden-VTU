/**
 * ClubKonnect (Nellobyte Systems) VTU API Service
 * Handles all communication with the ClubKonnect API for airtime, data, and balance queries.
 */

const BASE_URL = process.env.CLUBKONNECT_BASE_URL || "https://www.nellobytesystems.com"
const USER_ID = process.env.CLUBKONNECT_USER_ID || ""
const API_KEY = process.env.CLUBKONNECT_API_KEY || ""

// Map user-friendly network names to ClubKonnect network IDs
export const NETWORK_MAP: Record<string, string> = {
  "01": "MTN",
  "02": "Glo",
  "03": "9mobile",
  "04": "Airtel",
}

export const NETWORK_ID_MAP: Record<string, string> = {
  MTN: "01",
  GLO: "02",
  "9MOBILE": "03",
  AIRTEL: "04",
}

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ClubKonnectAirtimeResponse {
  orderid: string
  statuscode: string
  status: string
}

export interface ClubKonnectQueryResponse {
  date: string
  orderid: string
  requestid: string
  statuscode: string
  status: string
  remark: string
  ordertype: string
  mobilenetwork: string
  mobilenumber: string
  amountcharged: string
  walletbalance: string
}

export interface ClubKonnectBalanceResponse {
  date: string
  id: string
  phoneno: string
  balance: string
}

export interface ClubKonnectDataPlan {
  id: string        // The DataPlan ID to send to the API (e.g. "1000", "500.01")
  network: string    // Network ID (01, 02, 03, 04)
  networkName: string
  name: string       // Plan description (e.g. "1 GB - Monthly (SME)")
  price: number      // Price in Naira
}

export interface ClubKonnectCallbackData {
  orderdate?: string
  orderid?: string
  requestid?: string
  statuscode?: string
  orderstatus?: string
  orderremark?: string
}

// ─── Helper ─────────────────────────────────────────────────────────────────────

async function clubKonnectFetch<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}/${endpoint}`)
  url.searchParams.set("UserID", USER_ID)
  url.searchParams.set("APIKey", API_KEY)
  
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  console.log(`[ClubKonnect] Calling: ${endpoint}`)

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Accept": "application/json" },
  })

  if (!response.ok) {
    throw new Error(`ClubKonnect API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  
  // Check for credential errors
  if (data.status === "INVALID_CREDENTIALS") {
    throw new Error("ClubKonnect: Invalid API credentials")
  }
  if (data.status === "MISSING_CREDENTIALS") {
    throw new Error("ClubKonnect: Missing API credentials")
  }

  return data as T
}

// ─── API Functions ──────────────────────────────────────────────────────────────

/**
 * Purchase airtime via ClubKonnect API.
 * Returns ORDER_RECEIVED (statuscode 100) on success.
 */
export async function ckBuyAirtime(
  networkId: string,
  amount: number,
  mobileNumber: string,
  requestId: string,
  callbackUrl: string
): Promise<ClubKonnectAirtimeResponse> {
  const data = await clubKonnectFetch<ClubKonnectAirtimeResponse>("APIAirtimeV1.asp", {
    MobileNetwork: networkId,
    Amount: amount.toString(),
    MobileNumber: mobileNumber,
    RequestID: requestId,
    CallBackURL: callbackUrl,
  })

  // Check for specific error statuses
  // ClubKonnect can return 100 (ORDER_RECEIVED) or 200 (ORDER_COMPLETED) if instant
  if (data.statuscode !== "100" && data.statuscode !== "200") {
    throw new Error(`ClubKonnect Error: ${data.status}`)
  }

  return data
}

/**
 * Purchase data bundle via ClubKonnect API.
 */
export async function ckBuyData(
  networkId: string,
  dataPlanId: string,
  mobileNumber: string,
  requestId: string,
  callbackUrl: string
): Promise<ClubKonnectAirtimeResponse> {
  const data = await clubKonnectFetch<ClubKonnectAirtimeResponse>("APIDatabundleV1.asp", {
    MobileNetwork: networkId,
    DataPlan: dataPlanId,
    MobileNumber: mobileNumber,
    RequestID: requestId,
    CallBackURL: callbackUrl,
  })

  if (data.statuscode !== "100" && data.statuscode !== "200") {
    throw new Error(`ClubKonnect Data Error: ${data.status}`)
  }

  return data
}

/**
 * Query a transaction by OrderID.
 */
export async function ckQueryTransaction(orderId: string): Promise<ClubKonnectQueryResponse> {
  return await clubKonnectFetch<ClubKonnectQueryResponse>("APIQueryV1.asp", {
    OrderID: orderId,
  })
}

/**
 * Check ClubKonnect wallet balance.
 */
export async function ckGetWalletBalance(): Promise<ClubKonnectBalanceResponse> {
  return await clubKonnectFetch<ClubKonnectBalanceResponse>("APIWalletBalanceV1.asp", {})
}

/**
 * Fetch available data plans from ClubKonnect.
 * Returns a parsed list of plans grouped by network.
 */
export async function ckGetDataPlans(): Promise<ClubKonnectDataPlan[]> {
  const url = `${BASE_URL}/APIDatabundlePlansV2.asp?UserID=${USER_ID}`
  
  const response = await fetch(url, {
    headers: { "Accept": "application/json" },
    next: { revalidate: 3600 }, // Cache for 1 hour
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch data plans: ${response.status}`)
  }

  const rawData = await response.json()
  const plans: ClubKonnectDataPlan[] = []

  let networksContainer = rawData
  if (rawData.MOBILE_NETWORK) {
    networksContainer = rawData.MOBILE_NETWORK
  }

  if (typeof networksContainer === "object") {
    for (const [networkName, networkData] of Object.entries(networksContainer)) {
      if (Array.isArray(networkData)) {
        // networkData is like [ { ID: "01", PRODUCT: [ ... ] } ]
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
