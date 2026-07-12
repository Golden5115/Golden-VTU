import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { initializePayment } from "@/services/paystack.service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default async function FundWalletPage() {
  const session = await auth()
  
  if (!session?.user?.email) {
    redirect("/login")
  }

  async function fundWalletAction(formData: FormData) {
    "use server"
    const amountStr = formData.get("amount") as string
    const amount = parseFloat(amountStr)

    if (!amount || amount <= 0) {
      throw new Error("Invalid amount")
    }

    const { authorization_url } = await initializePayment(session!.user!.email!, amount)
    
    // Redirect user to Paystack checkout
    redirect(authorization_url)
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <Card>
        <CardHeader>
          <CardTitle>Fund Wallet</CardTitle>
          <CardDescription>Enter the amount you wish to add to your wallet.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={fundWalletAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₦)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="100"
                step="100"
                placeholder="e.g 1000"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Proceed to Pay
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
