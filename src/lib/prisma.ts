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

import pg from "pg"
const { Pool } = pg

const prismaClientSingleton = () => {
  let dbUrl = process.env.DATABASE_URL || ""
  if (dbUrl.includes("sslmode=require") && !dbUrl.includes("uselibpqcompat")) {
    dbUrl = dbUrl.replace("sslmode=require", "sslmode=verify-full")
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  })

  // Prevent uncaught exceptions from dropped idle sockets by remote DB host
  pool.on("error", (err) => {
    console.warn("[Prisma pg.Pool] Idle connection dropped by remote server:", err.message)
  })

  const adapter = new PrismaPg(pool)
  const baseClient = new PrismaClient({ adapter })

  // Auto-retry extension: Catches transient closed connection / network resets from remote serverless Postgres and retries on a fresh connection
  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          let attempts = 0
          const maxAttempts = 3
          while (attempts < maxAttempts) {
            try {
              return await query(args)
            } catch (error: any) {
              attempts++
              const msg = String(error?.message || "")
              const isConnClosed =
                msg.includes("Server has closed the connection") ||
                msg.includes("Connection terminated") ||
                msg.includes("ECONNRESET") ||
                msg.includes("Connection lost") ||
                msg.includes("terminating connection")

              if (attempts < maxAttempts && isConnClosed) {
                console.warn(
                  `[Prisma AutoRetry] Retrying ${model}.${operation} after remote socket drop (attempt ${attempts}/${maxAttempts})...`
                )
                await new Promise((r) => setTimeout(r, 200 * attempts))
                continue
              }
              throw error
            }
          }
        },
      },
    },
  })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

// Invalidate stale in-memory dev singleton if offlineVehicle model is missing
if (globalThis.prismaGlobal && !(globalThis.prismaGlobal as any).offlineVehicle) {
  globalThis.prismaGlobal = undefined
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma

