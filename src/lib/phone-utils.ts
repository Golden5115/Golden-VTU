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

// Complete map of 4-digit and 5-digit prefixes to ClubKonnect network IDs
const PREFIX_MAP: Record<string, string> = {
  // MTN ("01")
  "0803": "01", "0806": "01", "0703": "01", "0706": "01",
  "0813": "01", "0816": "01", "0810": "01", "0814": "01",
  "0903": "01", "0906": "01", "0913": "01", "0916": "01",
  "0704": "01",
  "07025": "01", "07026": "01", "07028": "01", "07029": "01",

  // Airtel ("04")
  "0802": "04", "0808": "04", "0708": "04", "0812": "04",
  "0701": "04", "0902": "04", "0901": "04", "0904": "04",
  "0907": "04", "0912": "04", "0911": "04",

  // Glo ("02")
  "0805": "02", "0807": "02", "0815": "02", "0811": "02",
  "0905": "02", "0915": "02", "0705": "02", "0707": "02",

  // 9Mobile ("03")
  "0809": "03", "0818": "03", "0817": "03", "0819": "03",
  "0909": "03", "0908": "03",
}

/**
 * Normalise a single Nigerian phone number string.
 * Strips non-digits, translates +234/234 or 10-digit inputs to standard 11-digit 08... format.
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return ""
  let cleaned = raw.replace(/\D/g, "")
  if (cleaned.startsWith("234") && cleaned.length >= 13) {
    cleaned = "0" + cleaned.substring(3)
  } else if (cleaned.length === 10 && !cleaned.startsWith("0")) {
    cleaned = "0" + cleaned
  }
  return cleaned.substring(0, 11)
}

/**
 * Detect the network from a Nigerian phone number.
 * Returns null if the number is unrecognised or too short.
 */
export function detectNetwork(phone: string): NetworkInfo | null {
  const normalized = normalizePhoneNumber(phone)
  if (normalized.length < 4) return null

  // 1. Check 5-digit prefix (e.g., 07025, 07026)
  if (normalized.length >= 5) {
    const prefix5 = normalized.substring(0, 5)
    if (PREFIX_MAP[prefix5]) {
      return NETWORKS[PREFIX_MAP[prefix5]] || null
    }
  }

  // 2. Check 4-digit prefix
  const prefix4 = normalized.substring(0, 4)
  const networkId = PREFIX_MAP[prefix4]

  if (!networkId) return null
  return NETWORKS[networkId] || null
}

/**
 * Validate a complete Nigerian phone number.
 * Returns an error string or null if valid.
 */
export function validatePhone(phone: string): string | null {
  const normalized = normalizePhoneNumber(phone)

  if (normalized.length === 0) return "Phone number is required"
  if (normalized.length !== 11) return "Phone number must be 11 digits"
  if (!normalized.startsWith("0")) return "Phone number must start with 0"

  const prefix4 = normalized.substring(0, 4)
  if (!PREFIX_MAP[prefix4] && !PREFIX_MAP[normalized.substring(0, 5)]) {
    return "Unrecognised network prefix"
  }

  return null
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
 * Format a human-readable date & 12-hour time with AM/PM: e.g. "Oct 10, 2026 • 04:30 PM".
 */
export function formatDisplayDate(date: Date | string): string {
  const d = new Date(date)
  const dateStr = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  return `${dateStr} • ${timeStr}`
}

/**
 * Split 12-hour date and time for flexible UI rendering.
 */
export function format12HourDateTime(date: Date | string): {
  dateStr: string
  timeStr: string
  full: string
} {
  const d = new Date(date)
  const dateStr = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  return {
    dateStr,
    timeStr,
    full: `${dateStr} • ${timeStr}`,
  }
}


