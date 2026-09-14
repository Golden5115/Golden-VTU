/**
 * Nigerian phone number network detection utility.
 * Maps number prefixes to ClubKonnect network IDs.
 */

export interface NetworkInfo {
  id: string       // ClubKonnect network ID
  name: string     // Display name
  color: string    // Brand color for UI
}

export const NETWORKS: Record<string, NetworkInfo> = {
  "01": { id: "01", name: "MTN", color: "#FFC300" },
  "02": { id: "02", name: "Glo", color: "#009A44" },
  "03": { id: "03", name: "9Mobile", color: "#006B3F" },
  "04": { id: "04", name: "Airtel", color: "#FF0000" },
}

// Map of 4-digit prefixes to ClubKonnect network IDs
const PREFIX_MAP: Record<string, string> = {
  // MTN
  "0803": "01", "0806": "01", "0703": "01", "0706": "01",
  "0813": "01", "0816": "01", "0810": "01", "0814": "01",
  "0903": "01", "0906": "01", "0913": "01", "0916": "01",
  "07025": "01", "07026": "01",
  // Airtel
  "0802": "04", "0808": "04", "0708": "04", "0812": "04",
  "0701": "04", "0902": "04", "0901": "04", "0904": "04",
  "0907": "04", "0912": "04",
  // Glo
  "0805": "02", "0807": "02", "0815": "02", "0811": "02",
  "0905": "02", "0915": "02",
  // 9Mobile
  "0809": "03", "0818": "03", "0817": "03", "0819": "03",
  "0909": "03", "0908": "03",
}

/**
 * Detect the network from a Nigerian phone number.
 * Returns null if the number is unrecognised or too short.
 */
export function detectNetwork(phone: string): NetworkInfo | null {
  // Normalise: strip spaces, dashes
  const cleaned = phone.replace(/\D/g, "")

  // Must be at least 4 digits to check prefix
  if (cleaned.length < 4) return null

  const prefix4 = cleaned.substring(0, 4)
  const networkId = PREFIX_MAP[prefix4]

  if (!networkId) return null
  return NETWORKS[networkId] || null
}

/**
 * Validate a complete Nigerian phone number.
 * Returns an error string or null if valid.
 */
export function validatePhone(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, "")

  if (cleaned.length === 0) return "Phone number is required"
  if (cleaned.length !== 11) return "Phone number must be 11 digits"
  if (!cleaned.startsWith("0")) return "Phone number must start with 0"

  const prefix4 = cleaned.substring(0, 4)
  if (!PREFIX_MAP[prefix4]) return "Unrecognised network prefix"

  return null
}

/**
 * Normalise a single Nigerian phone number string.
 * Strips non-digits, translates +234/234 to 0, and trims to 11 digits.
 */
export function normalizePhoneNumber(raw: string): string {
  let cleaned = raw.replace(/\D/g, "")
  if (cleaned.startsWith("234") && cleaned.length >= 13) {
    cleaned = "0" + cleaned.substring(3)
  }
  return cleaned.substring(0, 11)
}

/**
 * Parse comma-separated (and/or newline-separated) phone numbers.
 * Supports: "08012345678, 08023456789, +2347012345678" or Excel column pastes.
 * Normalizes all numbers and returns unique, non-empty values.
 */
export function parseCommaSeparatedPhones(raw: string): string[] {
  if (!raw || !raw.trim()) return []

  // Split by comma, newline, carriage return, semicolon, or tabs
  const tokens = raw.split(/[\n\r,;\t]+/)
  const uniquePhones = new Set<string>()

  for (const token of tokens) {
    const trimmed = token.trim()
    if (!trimmed) continue
    const normalized = normalizePhoneNumber(trimmed)
    if (normalized.length >= 10) {
      uniquePhones.add(normalized)
    }
  }

  return Array.from(uniquePhones)
}

/**
 * Calculate the number of days ago a given date occurred.
 */
export function getDaysAgo(date: Date | string): number {
  const target = new Date(date).getTime()
  const now = Date.now()
  const diffMs = now - target
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

/**
 * Format relative time description: e.g. "Today", "Yesterday", "14 days ago".
 */
export function formatRelativeDays(days: number): string {
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  return `${days} days ago`
}

/**
 * Format a human-readable date & time: e.g. "12 Aug 2026, 03:30 PM".
 */
export function formatDisplayDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

