import { redirect } from "next/navigation"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { FundWalletView } from "./FundWalletView"

export default async function FundWalletPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      walletBalance: true,
      email: true,
      role: true,
    },
  })

  if (!user) {
    redirect("/login")
  }

  return (
    <FundWalletView
      walletBalance={user.walletBalance || 0}
      userEmail={user.email || session.user.email || "user@example.com"}
      userRole={user.role}
      virtualBankName={process.env.CLUBKONNECT_VIRTUAL_BANK_NAME || "MONIEPOINT MICROFINANCE BANK"}
      virtualAccountNo={process.env.CLUBKONNECT_VIRTUAL_ACCOUNT_NO || "6990056172"}
      virtualAccountName={process.env.CLUBKONNECT_VIRTUAL_ACCOUNT_NAME || "NELLOBYTE-AYOMIDE ABIODUN AYOOLA"}
    />
  )
}

