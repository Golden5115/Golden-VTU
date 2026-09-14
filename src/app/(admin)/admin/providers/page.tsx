import prisma from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminProviderActions } from "./AdminProviderActions"
import { AddProviderModal } from "./AddProviderModal"
import { Server, Zap, Shield, Key } from "lucide-react"

export default async function AdminProvidersPage() {
  const providers = await prisma.provider.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Server className="w-7 h-7 text-primary" />
            VTU Servers & Multi-Provider APIs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your VTU backend servers (Server 1, Server 2, etc.). Users can switch among active servers on the platform with dynamic pricing.
          </p>
        </div>
        <AddProviderModal nextServerNumber={providers.length + 1} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider: any) => (
          <Card key={provider.id} className="relative overflow-hidden border shadow-sm">
            <div
              className={`h-1.5 w-full ${
                provider.status ? "bg-green-500" : "bg-muted-foreground/30"
              }`}
            />
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-bold">
                    {provider.serverName}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                    {provider.identifier}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {provider.providerName}
                  </span>
                </div>
              </div>
              <div
                className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                  provider.status
                    ? "bg-green-500 ring-4 ring-green-100"
                    : "bg-red-400 ring-4 ring-red-100"
                }`}
                title={provider.status ? "Active & Visible to Users" : "Disabled"}
              />
            </CardHeader>
            <CardContent>
              <div className="space-y-3 pt-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Base Endpoint</p>
                  <p className="font-mono text-xs text-foreground truncate" title={provider.baseUrl}>
                    {provider.baseUrl}
                  </p>
                </div>

                {provider.userId && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">User ID</p>
                    <p className="font-mono text-xs text-foreground">{provider.userId}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-muted-foreground">API Credentials</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {provider.apiKey ? `${provider.apiKey.substring(0, 8)}••••••••••••` : "Not configured"}
                  </p>
                </div>

                <div className="border-t pt-3">
                  <AdminProviderActions
                    provider={{
                      id: provider.id,
                      status: provider.status,
                      serverName: provider.serverName,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {providers.length === 0 && (
          <div className="col-span-full p-12 text-center border-2 border-dashed rounded-2xl bg-muted/20 space-y-3">
            <Server className="w-10 h-10 mx-auto text-muted-foreground/60" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold">No VTU API Servers Configured</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Click &quot;Add VTU Server&quot; above to connect ClubKonnect, VTPass, Husmodata, or a Sandbox test server.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
