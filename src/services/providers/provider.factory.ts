import prisma from "@/lib/prisma"
import { IVtuProvider, ProviderInitConfig } from "./vtu-provider.interface"
import { ClubKonnectProvider } from "./clubkonnect.provider"
import { VtpassProvider } from "./vtpass.provider"
import { HusmodataProvider } from "./husmodata.provider"
import { PairgateProvider } from "./pairgate.provider"
import { MockProvider } from "./mock.provider"

export * from "./provider.constants"

export function createProviderInstance(identifier: string): IVtuProvider {
  switch (identifier.toUpperCase()) {
    case "CLUBKONNECT":
      return new ClubKonnectProvider()
    case "PAIRGATE":
      return new PairgateProvider()
    case "VTPASS":
      return new VtpassProvider()
    case "DEMOPAYSUB":
    case "HUSMODATA":
    case "SMEPLUG":
    case "ALRAHUZ":
      return new HusmodataProvider()
    case "MOCK":
    case "SANDBOX":
      return new MockProvider()
    default:
      throw new Error(`Provider engine '${identifier}' is not supported yet.`)
  }
}

export function instantiateProviderFromRecord(dbRecord: {
  identifier: string
  apiKey: string
  baseUrl: string
  userId?: string | null
  secretKey?: string | null
  publicKey?: string | null
}): IVtuProvider {
  const provider = createProviderInstance(dbRecord.identifier)
  provider.initialize({
    apiKey: dbRecord.apiKey,
    baseUrl: dbRecord.baseUrl,
    userId: dbRecord.userId,
    secretKey: dbRecord.secretKey,
    publicKey: dbRecord.publicKey,
  })
  return provider
}

/**
 * Fetch all enabled servers for user selection.
 */
export async function getActiveServers() {
  return await prisma.provider.findMany({
    where: { status: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      serverName: true,
      serverCode: true,
      providerName: true,
      identifier: true,
      status: true,
      isDefault: true,
      sortOrder: true,
    },
  })
}

/**
 * Resolve provider and server record by serverId or serverCode.
 * Falls back to default active server if not specified.
 */
export async function resolveServerAndProvider(serverId?: string): Promise<{
  server: any
  provider: IVtuProvider
}> {
  let server = null

  if (serverId) {
    server = await prisma.provider.findFirst({
      where: {
        OR: [{ id: serverId }, { serverCode: serverId }],
        status: true,
      },
    })
  }

  if (!server) {
    // Try default active server
    server = await prisma.provider.findFirst({
      where: { status: true, isDefault: true },
    })
  }

  if (!server) {
    // Fall back to first active server
    server = await prisma.provider.findFirst({
      where: { status: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })
  }

  if (!server) {
    // If no provider exists in DB, fallback to mock provider so app doesn't crash
    const mock = new MockProvider()
    mock.initialize({ apiKey: "", baseUrl: "" })
    return {
      server: {
        id: "default-mock",
        serverName: "Server 1 (Default)",
        serverCode: "server-1",
        providerName: "Sandbox Server",
        identifier: "MOCK",
      },
      provider: mock,
    }
  }

  const providerImpl = instantiateProviderFromRecord(server)
  return { server, provider: providerImpl }
}

/**
 * Backwards compatibility for single active provider callers
 */
export async function getActiveProvider(): Promise<IVtuProvider> {
  const { provider } = await resolveServerAndProvider()
  return provider
}
