/**
 * Nigerian phone number network detection utility.
 * Maps number prefixes to standardized network IDs.
 */

export interface NetworkInfo {
  id: string       // Standardized network ID ("01" = MTN, "02" = Glo, "03" = 9Mobile, "04" = Airtel)
  name: string     // Display name
  color: string    // Brand color for UI
}

export const NETWORKS: Record<string, NetworkInfo> = {
  "01": { id: "01", name: "MTN", color: "#FFC300" },
  "02": { id: "02", name: "Glo", color: "#009A44" },
  "03": { id: "03", name: "9Mobile", color: "#006B3F" },
  "04": { id: "04", name: "Airtel", color: "#FF0000" },
}

// Complete map of 4-digit and 5-digit prefixes to standardized network IDs
const PREFIX_MAP: Record<string, string> = {
  // MTN ("01")
  "0803": "01", "0806": "01", "0703": "01", "0706": "01",
  "0813": "01", "0816": "01", "0810": "01", "0814": "01",
  "0903": "01", "0906": "01", "0913": "01", "0916": "01",
  "0704": "01", "0707": "01",
  "07025": "01", "07026": "01", "07028": "01", "07029": "01",

  // Airtel ("04")
  "0802": "04", "0808": "04", "0708": "04", "0812": "04",
  "0701": "04", "0902": "04", "0901": "04", "0904": "04",
  "0907": "04", "0912": "04", "0911": "04",

  // Glo ("02")
  "0805": "02", "0807": "02", "0815": "02", "0811": "02",
  "0905": "02", "0915": "02", "0705": "02",

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
    timeZone: "Africa/Lagos",
  })
  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  })
  return `${dateStr} • ${timeStr}`
}

/**
 * Split 12-hour date and time for flexible UI rendering.
 * Strictly uses Nigerian Timezone (Africa/Lagos, UTC+1).
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
    timeZone: "Africa/Lagos",
  })
  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  })
  return {
    dateStr,
    timeStr,
    full: `${dateStr} • ${timeStr}`,
  }
}

// Comprehensive mapping of known numerical plan IDs to their actual durations (days) for legacy and active orders
const KNOWN_PLAN_ID_VALIDITY: Record<string, number> = {
  // Common short codes & ClubKonnect
  "4": 7,    // MTN 1GB Weekly SME (7 days)
  "8": 3,    // Glo 1GB SME (3 days)
  "19": 7,   // Airtel Weekly Bundle (7 days)

  // Pairgate Airtel CG Weekly Plans (IDs 89, 90, 91, 94, 96, 98, 101)
  "89": 7,   // Airtel 500MB (CG) - 7 Days
  "90": 7,   // Airtel 1GB (CG) - 7 Days
  "91": 7,   // Airtel 1.5GB (CG) - 7 Days
  "94": 7,   // Airtel 3.5GB (CG) - 7 Days
  "96": 7,   // Airtel 6GB (CG) - 7 Days
  "98": 7,   // Airtel 10GB (CG) - 7 Days
  "101": 7,  // Airtel 18GB (CG) - 7 Days

  // Airtel Awoof, Binge & Weekly Plans
  "121": 1, "122": 2, "123": 2, "124": 1, "125": 2, "126": 2,
  "189": 1, "193": 7, "196": 7, "197": 2, "198": 1, "200": 7,
  "204": 2, "206": 7, "208": 7, "209": 7, "210": 3, "211": 2,
  "212": 1, "215": 2, "216": 2, "362": 1, "363": 7,

  // Glo Awoof, Specials, Collabo & Mega Plans
  "85": 1, "86": 1, "87": 2, "88": 7, "217": 15, "218": 10,
  "219": 7, "220": 3, "221": 1, "222": 1, "226": 7, "227": 2,
  "228": 1, "232": 15, "233": 90, "236": 365, "237": 2, "238": 2,
  "239": 60, "240": 60, "243": 2, "244": 1, "245": 14, "246": 7,
  "247": 7, "250": 7, "251": 7, "252": 2, "253": 3, "255": 1,
  "256": 1, "266": 7, "267": 2, "268": 1, "359": 14, "360": 7, "361": 7,

  // MTN Daily, Weekly, Gifting & Mega Plans
  "59": 14, "61": 3, "62": 7, "65": 3, "66": 7, "68": 3, "69": 7,
  "270": 2, "271": 2, "272": 1, "273": 7, "274": 1, "275": 90,
  "277": 60, "281": 7, "282": 90, "283": 2, "285": 2, "290": 7,
  "295": 7, "297": 2, "298": 2, "299": 7, "300": 1, "301": 1,
  "302": 1, "313": 2, "316": 7, "317": 365, "318": 7, "320": 7,
  "323": 2, "324": 14, "325": 14, "326": 14, "327": 7, "328": 14,
  "332": 1, "333": 7, "364": 1,

  // 9mobile
  "177": 7, "178": 1, "186": 7, "187": 1, "188": 1, "391": 1, "397": 7,
}

// Known human-readable names for numerical IDs so UI does not show raw numbers
const KNOWN_PLAN_DISPLAY_MAP: Record<string, string> = {
  "89": "500MB (CG) • 7 Days",
  "90": "1GB (CG) • 7 Days",
  "91": "1.5GB (CG) • 7 Days",
  "92": "2GB (CG) • 30 Days",
  "93": "3GB (CG) • 30 Days",
  "94": "3.5GB (CG) • 7 Days",
  "95": "4GB (CG) • 30 Days",
  "96": "6GB (CG) • 7 Days",
  "97": "8GB (CG) • 30 Days",
  "98": "10GB (CG) • 7 Days",
  "99": "10GB (CG) • 30 Days",
  "100": "13GB (CG) • 30 Days",
  "101": "18GB (CG) • 7 Days",
  "102": "18GB (CG) • 30 Days",
  "19": "500MB Weekly • 7 Days",
  "14": "500MB (CG) • 30 Days",
  "15": "1GB (CG) • 30 Days",
  "16": "2GB (CG) • 30 Days",
  "17": "3GB (CG) • 30 Days",
  "18": "5GB (CG) • 30 Days",
  "4": "1GB Weekly SME • 7 Days",
  "8": "1GB SME • 3 Days",
  "7": "500MB SME • 30 Days",
}

/**
 * Extracts bundle validity in days from plan name, description, or plan ID.
 * Accurately parses daily (1 day), multi-day (2d, 3d), weekly (7d, 14d), monthly (30d), and extended plans.
 */
export function extractValidityDays(planNameOrValidity?: string | null, fallbackDays: number = 30): number {
  if (!planNameOrValidity) return fallbackDays
  const text = planNameOrValidity.toLowerCase().trim()

  // Match known numerical code
  if (KNOWN_PLAN_ID_VALIDITY[text] !== undefined) {
    return KNOWN_PLAN_ID_VALIDITY[text]
  }

  // 1. Explicit regex for days: e.g. "1 day", "2 days", "3-day", "7 days", "14 days", "30 days", "60 days"
  const dayMatch = text.match(/(\d+)\s*(?:day|days|d\b)/i)
  if (dayMatch && dayMatch[1]) {
    const parsed = parseInt(dayMatch[1], 10)
    if (parsed > 0 && parsed <= 365) return parsed
  }

  // 2. Explicit regex for weeks: e.g. "1 week", "2 weeks"
  const weekMatch = text.match(/(\d+)\s*(?:week|weeks|wk|wks\b)/i)
  if (weekMatch && weekMatch[1]) {
    const parsedWeeks = parseInt(weekMatch[1], 10)
    if (parsedWeeks > 0 && parsedWeeks <= 52) return parsedWeeks * 7
  }

  // 3. Explicit regex for months: e.g. "1 month", "2 months", "3 months"
  const monthMatch = text.match(/(\d+)\s*(?:month|months|mo|mos\b)/i)
  if (monthMatch && monthMatch[1]) {
    const parsedMonths = parseInt(monthMatch[1], 10)
    if (parsedMonths > 0 && parsedMonths <= 12) return parsedMonths * 30
  }

  // 4. Specific keywords
  if (text.includes("daily") || text.includes("24 hr") || text.includes("24hr") || text.includes("24 hours") || text.includes("1day")) {
    return 1
  }
  if (text.includes("2day") || text.includes("48 hr") || text.includes("48hr")) {
    return 2
  }
  if (text.includes("3day") || text.includes("72 hr") || text.includes("72hr")) {
    return 3
  }
  if (text.includes("weekly") || text.includes("7day")) {
    return 7
  }
  if (text.includes("bi-weekly") || text.includes("14day") || text.includes("fortnight")) {
    return 14
  }
  if (text.includes("monthly") || text.includes("30day")) {
    return 30
  }
  if (text.includes("quarterly") || text.includes("90day")) {
    return 90
  }
  if (text.includes("yearly") || text.includes("annual") || text.includes("365day") || text.includes("1 year")) {
    return 365
  }

  // 5. Common telecom bundles that omit "7 days" from their name (e.g. Pairgate Airtel CG 7-day tiers)
  if (text.includes("(cg)")) {
    if (
      text.includes("500mb") ||
      text.includes("1gb") ||
      text.includes("1.5gb") ||
      text.includes("3.5gb") ||
      text.includes("6gb")
    ) {
      return 7
    }
  }

  return fallbackDays
}

/**
 * Format plan label for user/admin display.
 * If the stored plan is a raw ID (e.g. "89"), converts to "500MB (CG) • 7 Days".
 * If the stored plan does not have validity, appends its duration.
 */
export function formatPlanDisplayName(planNameOrId?: string | null, networkId?: string | null): string {
  if (!planNameOrId || !planNameOrId.trim()) return "Data Bundle"
  const trimmed = planNameOrId.trim()

  // Match known numerical ID
  if (KNOWN_PLAN_DISPLAY_MAP[trimmed]) {
    return KNOWN_PLAN_DISPLAY_MAP[trimmed]
  }

  // If already formatted with days/weeks, return cleaned
  if (/\b(?:days?|weeks?|months?|d\b|hrs?)\b/i.test(trimmed)) {
    return trimmed
  }

  // Derive validity and append
  const days = extractValidityDays(trimmed, 30)
  const durationLabel = days === 1 ? "1 Day" : `${days} Days`

  return `${trimmed} • ${durationLabel}`
}



