import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { purchaseData } from "@/services/vtu.service"
import { ckGetDataPlans } from "@/services/clubkonnect.service"
import { DataPurchaseForm } from "./DataPurchaseForm"

export default async function DataPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Fetch real data plans from ClubKonnect
  let plans: any[] = []
  try {
    plans = await ckGetDataPlans()
  } catch (error) {
    console.error("[DataPage] Failed to fetch data plans:", error)
  }

  async function buyDataAction(formData: FormData) {
    "use server"
    const networkId = formData.get("network") as string
    const planId = formData.get("plan") as string
    const phone = formData.get("phone") as string
    const amountStr = formData.get("amount") as string
    const amount = parseFloat(amountStr)

    if (!networkId || !planId || !phone || !amount || amount <= 0) {
      throw new Error("Invalid input. Please select a valid plan and phone number.")
    }

    let success = false;
    try {
      await purchaseData(session!.user!.id!, networkId, planId, phone, amount)
      success = true;
    } catch (e: any) {
      console.error(e)
      throw new Error(e.message)
    }

    if (success) {
      redirect("/transactions")
    }
  }

  return <DataPurchaseForm plans={plans} buyDataAction={buyDataAction} />
}
