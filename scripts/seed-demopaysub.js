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

    const existingDemo = res.rows.find(p => p.identifier === "DEMOPAYSUB" || p.serverCode === "server-4" || p.serverCode === "demopaysub")

    if (existingDemo) {
      console.log("Demopaysub server already exists, updating API key and status...")
      await pool.query(
        `UPDATE "Provider" SET "apiKey" = $1, "baseUrl" = $2, "status" = true WHERE "id" = $3`,
        ["f4d3ae19b3c160898d5d18dd485b6743adae614a", "https://demopaysub.com/api", existingDemo.id]
      )
      console.log("Demopaysub server updated successfully!")
    } else {
      const nextSortOrder = res.rows.length + 1
      const serverCode = "server-4"
      const serverName = "Server 4 (Demopaysub)"

      const insertRes = await pool.query(
        `INSERT INTO "Provider" ("id", "serverName", "serverCode", "providerName", "identifier", "baseUrl", "apiKey", "status", "isDefault", "sortOrder", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING id, "serverName", "serverCode"`,
        [
          serverName,
          serverCode,
          "Demopaysub",
          "DEMOPAYSUB",
          "https://demopaysub.com/api",
          "f4d3ae19b3c160898d5d18dd485b6743adae614a",
          true,
          false,
          nextSortOrder
        ]
      )
      console.log("Demopaysub server inserted successfully:", insertRes.rows[0])
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
