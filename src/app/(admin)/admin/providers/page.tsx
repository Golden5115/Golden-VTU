import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminProviderActions } from "./AdminProviderActions"
import { AddProviderModal } from "./AddProviderModal"

export default async function AdminProvidersPage() {
  const providers = await prisma.provider.findMany({
    orderBy: { providerName: "asc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">API Providers</h1>
        <AddProviderModal />
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider: any) => (
          <Card key={provider.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle>{provider.providerName}</CardTitle>
                <CardDescription className="font-mono text-xs break-all">
                  {provider.baseUrl}
                </CardDescription>
              </div>
              <div className={`w-3 h-3 rounded-full ${provider.status ? 'bg-green-500' : 'bg-red-500'}`} />
            </CardHeader>
            <CardContent>
              <div className="pt-4 space-y-4">
                <div>
                  <p className="text-sm font-medium">API Key</p>
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    {provider.apiKey.substring(0, 10)}******************
                  </p>
                </div>
                <AdminProviderActions provider={provider} />
              </div>
            </CardContent>
          </Card>
        ))}

        {providers.length === 0 && (
          <div className="col-span-full p-8 text-center border rounded-lg bg-gray-50 text-muted-foreground">
            No API providers configured yet.
          </div>
        )}
      </div>
    </div>
  )
}
