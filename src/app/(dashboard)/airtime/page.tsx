import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { purchaseAirtime } from "@/services/vtu.service"

export default async function AirtimePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  async function buyAirtimeAction(formData: FormData) {
    "use server"
    const network = formData.get("network") as string
    const phone = formData.get("phone") as string
    const amountStr = formData.get("amount") as string
    const amount = parseFloat(amountStr)

    try {
      await purchaseAirtime(session!.user!.id!, network, phone, amount)
      redirect("/transactions")
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <Card>
        <CardHeader>
          <CardTitle>Buy Airtime</CardTitle>
          <CardDescription>Instant airtime top-up for any network.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={buyAirtimeAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="network">Network</Label>
              <select name="network" id="network" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" required>
                <option value="MTN">MTN</option>
                <option value="AIRTEL">Airtel</option>
                <option value="GLO">Glo</option>
                <option value="9MOBILE">9Mobile</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" name="phone" type="tel" placeholder="08012345678" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₦)</Label>
              <Input id="amount" name="amount" type="number" min="50" placeholder="100" required />
            </div>
            <Button type="submit" className="w-full">Buy Airtime</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
