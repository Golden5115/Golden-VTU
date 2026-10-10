import dns from "node:dns"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first")
}

const prismaClientSingleton = () => {
  let dbUrl = process.env.DATABASE_URL || ""
  if (dbUrl.includes("sslmode=require") && !dbUrl.includes("uselibpqcompat")) {
    dbUrl = dbUrl.replace("sslmode=require", "sslmode=verify-full")
  }
  const adapter = new PrismaPg(dbUrl)
  return new PrismaClient({ adapter })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma
