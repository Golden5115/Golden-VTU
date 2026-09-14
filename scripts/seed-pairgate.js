const { Pool } = require("pg")
require("dotenv").config()

async function main() {
  const connectionString = process.env.DATABASE_URL
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })

  try {
    const res = await pool.query('SELECT id, "serverName", "serverCode", "identifier", status FROM "Provider" ORDER BY "sortOrder" ASC')
    console.log("Existing providers in DB:", res.rows)

    const existingPairgate = res.rows.find(p => p.identifier === "PAIRGATE" || p.serverCode === "server-3" || p.serverCode === "pairgate")

    if (existingPairgate) {
      console.log("Pairgate already exists, updating API key and status...")
      await pool.query(
        `UPDATE "Provider" SET "apiKey" = $1, "baseUrl" = $2, "status" = true WHERE "id" = $3`,
        ["PG_live_W4w588cpcLlKpZQ7HwCOX0K9tvZGoaAEejntgfdC7WZSc", "https://pairgate.com/api/v1", existingPairgate.id]
      )
      console.log("Pairgate server updated successfully!")
    } else {
      const nextSortOrder = res.rows.length + 1
      const serverCode = "server-3"
      const serverName = "Server 3 (Pairgate Live)"

      const insertRes = await pool.query(
        `INSERT INTO "Provider" ("id", "serverName", "serverCode", "providerName", "identifier", "baseUrl", "apiKey", "status", "isDefault", "sortOrder", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING id, "serverName", "serverCode"`,
        [
          serverName,
          serverCode,
          "Pairgate",
          "PAIRGATE",
          "https://pairgate.com/api/v1",
          "PG_live_W4w588cpcLlKpZQ7HwCOX0K9tvZGoaAEejntgfdC7WZSc",
          true,
          false,
          nextSortOrder
        ]
      )
      console.log("Pairgate server inserted successfully:", insertRes.rows[0])
    }

    const finalRes = await pool.query('SELECT id, "serverName", "serverCode", "identifier", status, "sortOrder" FROM "Provider" ORDER BY "sortOrder" ASC')
    console.log("Current active servers in DB:", finalRes.rows)
  } catch (err) {
    console.error("Error executing script:", err)
  } finally {
    await pool.end()
  }
}

main()
