import {
  IVtuProvider,
  ProviderInitConfig,
  VtuBalanceResponse,
  VtuDataPlan,
  VtuTransactionResponse,
} from "./vtu-provider.interface"

const MOCK_DATA_PLANS: VtuDataPlan[] = [
  // MTN Budget Server
  { id: "mock-mtn-500mb", network: "01", networkName: "MTN", name: "500MB (30 Days) - Budget Server", price: 135 },
  { id: "mock-mtn-1gb", network: "01", networkName: "MTN", name: "1.0GB (30 Days) - Budget Server", price: 255 },
  { id: "mock-mtn-2gb", network: "01", networkName: "MTN", name: "2.0GB (30 Days) - Budget Server", price: 510 },
  { id: "mock-mtn-5gb", network: "01", networkName: "MTN", name: "5.0GB (30 Days) - Budget Server", price: 1275 },
  // Airtel Budget Server
  { id: "mock-airtel-1gb", network: "04", networkName: "Airtel", name: "1.0GB (30 Days) - Budget Server", price: 260 },
  { id: "mock-airtel-2gb", network: "04", networkName: "Airtel", name: "2.0GB (30 Days) - Budget Server", price: 520 },
  // Glo Budget Server
  { id: "mock-glo-1gb", network: "02", networkName: "Glo", name: "1.0GB (30 Days) - Budget Server", price: 250 },
  { id: "mock-glo-2gb", network: "02", networkName: "Glo", name: "2.0GB (30 Days) - Budget Server", price: 500 },
  // 9mobile Budget Server
  { id: "mock-9mobile-1gb", network: "03", networkName: "9mobile", name: "1.0GB (30 Days) - Budget Server", price: 230 },
]

export class MockProvider implements IVtuProvider {
  readonly identifier = "MOCK"

  initialize(config: ProviderInitConfig): void {
    // Sandbox / simulator doesn't need external credentials
  }

  async buyAirtime(
    networkId: string,
    amount: number,
    mobileNumber: string,
    reference: string,
    callbackUrl: string
  ): Promise<VtuTransactionResponse> {
    // Simulate brief network latency
    await new Promise((res) => setTimeout(res, 600))

    return {
      isSuccessful: true,
      isPending: false,
      providerReference: `SIM-AIR-${Date.now()}`,
      rawResponse: { message: "Simulated sandbox airtime top-up successful", networkId, amount, mobileNumber },
    }
  }

  async buyData(
    networkId: string,
    dataPlanId: string,
    mobileNumber: string,
    reference: string,
    callbackUrl: string
  ): Promise<VtuTransactionResponse> {
    await new Promise((res) => setTimeout(res, 600))

    return {
      isSuccessful: true,
      isPending: false,
      providerReference: `SIM-DAT-${Date.now()}`,
      rawResponse: { message: "Simulated sandbox data top-up successful", networkId, dataPlanId, mobileNumber },
    }
  }

  async getDataPlans(): Promise<VtuDataPlan[]> {
    return MOCK_DATA_PLANS
  }

  async getWalletBalance(): Promise<VtuBalanceResponse> {
    return {
      balance: 150000,
      currency: "NGN",
    }
  }

  async testConnection(): Promise<{ success: boolean; balance?: number; currency?: string; message?: string }> {
    return {
      success: true,
      balance: 150000,
      currency: "NGN",
      message: "Sandbox Server online. Simulated balance: ₦150,000",
    }
  }
}
