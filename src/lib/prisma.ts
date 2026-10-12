import dns from "node:dns"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first")
}

try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4", "1.0.0.1"])
} catch {
  // Ignore if custom servers cannot be set in current environment
}

// Fallback resolver for Windows local network DNS timeouts/failures (EAI_AGAIN / ENOTFOUND)
const origLookup = dns.lookup
// @ts-ignore
dns.lookup = function (hostname: string, a: any, b: any) {
  const cb = typeof a === "function" ? a : b
  const opt = typeof a === "function" ? {} : a

  origLookup(hostname, opt, (err: any, addr: any, fam: any) => {
    if (err && (err.code === "EAI_AGAIN" || err.code === "ENOTFOUND") && hostname) {
      dns.resolve4(hostname, (rErr, addrs) => {
        if (!rErr && addrs && addrs.length > 0) {
          if (opt && opt.all) {
            return cb(null, addrs.map((ip) => ({ address: ip, family: 4 })))
          }
          return cb(null, addrs[0], 4)
        }
        cb(err, addr, fam)
      })
    } else {
      cb(err, addr, fam)
    }
  })
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
