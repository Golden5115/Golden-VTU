export interface VtuTransactionResponse {
  isSuccessful: boolean
  isPending: boolean
  providerReference: string
  rawResponse?: any
}

export interface VtuDataPlan {
  id: string        // Provider's internal ID for the plan
  network: string    // Standardized network ID ("01": MTN, "02": Glo, "03": 9mobile, "04": Airtel)
  networkName: string
  name: string       // e.g. "1 GB - Monthly"
  price: number
  validity?: string
}

export interface VtuBalanceResponse {
  balance: number
  currency: string
}

export interface ProviderInitConfig {
  apiKey: string
  baseUrl: string
  userId?: string | null
  secretKey?: string | null
  publicKey?: string | null
}

export interface IVtuProvider {
  /**
   * The unique identifier for this provider implementation (e.g. "CLUBKONNECT", "VTPASS", "HUSMODATA", "MOCK")
   */
  readonly identifier: string

  /**
   * Initialize the provider with DB credentials
   */
  initialize(config: ProviderInitConfig): void

  buyAirtime(
    networkId: string,
    amount: number,
    mobileNumber: string,
    reference: string,
    callbackUrl: string
  ): Promise<VtuTransactionResponse>

  buyData(
    networkId: string,
    dataPlanId: string,
    mobileNumber: string,
    reference: string,
    callbackUrl: string
  ): Promise<VtuTransactionResponse>

  getDataPlans(): Promise<VtuDataPlan[]>

  getWalletBalance(): Promise<VtuBalanceResponse>

  testConnection(): Promise<{
    success: boolean
    balance?: number
    currency?: string
    message?: string
  }>

  queryTransaction?(orderIdOrReference: string): Promise<{
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
  }>
}
