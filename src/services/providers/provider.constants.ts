export interface ProviderTemplate {
  identifier: string
  name: string
  defaultBaseUrl: string
  requiresUserId: boolean
  requiresApiKey: boolean
  requiresSecretKey: boolean
  requiresPublicKey: boolean
  description: string
  apiKeyLabel: string
}

export const SUPPORTED_PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    identifier: "CLUBKONNECT",
    name: "ClubKonnect",
    defaultBaseUrl: "https://www.nellobytesystems.com",
    requiresUserId: true,
    requiresApiKey: true,
    requiresSecretKey: false,
    requiresPublicKey: false,
    description: "Nellobyte Systems ClubKonnect API (User ID & API Key)",
    apiKeyLabel: "API Key",
  },
  {
    identifier: "VTPASS",
    name: "VTPass",
    defaultBaseUrl: "https://api-service.vtpass.com/api",
    requiresUserId: false,
    requiresApiKey: true,
    requiresSecretKey: true,
    requiresPublicKey: true,
    description: "VTPass Corporate VTU & Utility API (API Key + Secret Key)",
    apiKeyLabel: "API Key",
  },
  {
    identifier: "HUSMODATA",
    name: "Husmodata / Standard SME API",
    defaultBaseUrl: "https://husmodata.com/api",
    requiresUserId: false,
    requiresApiKey: true,
    requiresSecretKey: false,
    requiresPublicKey: false,
    description: "Standard Nigerian SME Token API (Husmodata, Alrahuz, Glad9ja, SMEPlug)",
    apiKeyLabel: "Authorization Token",
  },
  {
    identifier: "DEMOPAYSUB",
    name: "Demopaysub (MSORG Engine)",
    defaultBaseUrl: "https://demopaysub.com/api",
    requiresUserId: false,
    requiresApiKey: true,
    requiresSecretKey: false,
    requiresPublicKey: false,
    description: "Demopaysub MSORG VTU Portal (Authorization Token)",
    apiKeyLabel: "API Token",
  },
  {
    identifier: "PAIRGATE",
    name: "Pairgate",
    defaultBaseUrl: "https://pairgate.com/api/v1",
    requiresUserId: false,
    requiresApiKey: true,
    requiresSecretKey: false,
    requiresPublicKey: false,
    description: "Pairgate Automated VTU (Free API Key, Wholesale Pricing, Bearer Token)",
    apiKeyLabel: "Bearer API Key",
  },
  {
    identifier: "MOCK",
    name: "Sandbox / Demo Server",
    defaultBaseUrl: "https://sandbox.local",
    requiresUserId: false,
    requiresApiKey: false,
    requiresSecretKey: false,
    requiresPublicKey: false,
    description: "Offline simulated server with budget prices for safe testing",
    apiKeyLabel: "API Key (Optional)",
  },
]
