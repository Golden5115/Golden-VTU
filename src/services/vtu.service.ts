import prisma from "@/lib/prisma"

export async function purchaseAirtime(userId: string, network: string, phone: string, amount: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Check wallet balance
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user || user.walletBalance < amount) {
      throw new Error("Insufficient wallet balance")
    }

    // 2. Deduct wallet balance
    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { decrement: amount } },
    })

    // 3. Generate references
    const reference = `AIR-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    // 4. Create Wallet Transaction record
    await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        type: "DEBIT",
        reference,
        status: "SUCCESS",
      },
    })

    // 5. Mock External API Call (Replace with real provider later)
    // const providerResponse = await fetch("...");

    // 6. Create Airtime Purchase record
    const purchase = await tx.airtimePurchase.create({
      data: {
        userId,
        network,
        phone,
        amount,
        reference,
        status: "SUCCESS",
        providerReference: `MOCK-PROV-${Date.now()}`
      },
    })

    return purchase
  })
}

export async function purchaseData(userId: string, network: string, plan: string, phone: string, amount: number) {
  return await prisma.$transaction(async (tx) => {
    // 1. Check wallet balance
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user || user.walletBalance < amount) {
      throw new Error("Insufficient wallet balance")
    }

    // 2. Deduct wallet balance
    await tx.user.update({
      where: { id: userId },
      data: { walletBalance: { decrement: amount } },
    })

    // 3. Generate references
    const reference = `DAT-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    // 4. Create Wallet Transaction record
    await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        type: "DEBIT",
        reference,
        status: "SUCCESS",
      },
    })

    // 5. Mock External API Call
    // const providerResponse = await fetch("...");

    // 6. Create Data Purchase record
    const purchase = await tx.dataPurchase.create({
      data: {
        userId,
        network,
        plan,
        phone,
        amount,
        reference,
        status: "SUCCESS",
        providerReference: `MOCK-PROV-${Date.now()}`
      },
    })

    return purchase
  })
}
