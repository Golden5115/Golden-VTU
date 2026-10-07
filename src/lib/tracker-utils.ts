export type TrackerHealthStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "NEVER_TOPPED_UP"

export interface EnrichedTracker {
  id: string
  vehicleName: string
  plateNumber: string
  simNumber: string
  network: string
  deviceModel: string | null
  imei: string | null
  clientName: string | null
  clientPhone: string | null
  notes: string | null
  status: string
  lastAirtimeDate: Date | null
  lastAirtimeAmount: number | null
  lastAirtimeRef: string | null
  lastDataDate: Date | null
  lastDataPlan: string | null
  lastDataAmount: number | null
  lastDataRef: string | null
  dataValidityDays: number | null
  dataExpiryDate: Date | null
  createdAt: Date
  updatedAt: Date

  // Diagnostics computed for troubleshooting
  dataStatus: TrackerHealthStatus
  dataRemainingDays: number | null // Positive = days left, Negative = days expired
  airtimeDaysAgo: number | null
  isDataExpired: boolean
  isExpiringSoon: boolean
  needsAirtime: boolean
}

export function computeTrackerDiagnostics(tracker: any): EnrichedTracker {
  const now = new Date().getTime()
  let dataStatus: TrackerHealthStatus = "NEVER_TOPPED_UP"
  let dataRemainingDays: number | null = null
  let isDataExpired = false
  let isExpiringSoon = false

  if (tracker.dataExpiryDate) {
    const expiryTime = new Date(tracker.dataExpiryDate).getTime()
    const diffDays = Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24))
    dataRemainingDays = diffDays

    if (diffDays <= 0) {
      dataStatus = "EXPIRED"
      isDataExpired = true
    } else if (diffDays <= 3) {
      dataStatus = "EXPIRING_SOON"
      isExpiringSoon = true
    } else {
      dataStatus = "ACTIVE"
    }
  } else if (tracker.lastDataDate) {
    const lastTime = new Date(tracker.lastDataDate).getTime()
    const validity = tracker.dataValidityDays || 30
    const expiryTime = lastTime + validity * 24 * 60 * 60 * 1000
    const diffDays = Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24))
    dataRemainingDays = diffDays
    if (diffDays <= 0) {
      dataStatus = "EXPIRED"
      isDataExpired = true
    } else if (diffDays <= 3) {
      dataStatus = "EXPIRING_SOON"
      isExpiringSoon = true
    } else {
      dataStatus = "ACTIVE"
    }
  }

  let airtimeDaysAgo: number | null = null
  let needsAirtime = false

  if (tracker.lastAirtimeDate) {
    const lastAirTime = new Date(tracker.lastAirtimeDate).getTime()
    airtimeDaysAgo = Math.floor((now - lastAirTime) / (1000 * 60 * 60 * 24))
    if (airtimeDaysAgo > 45) {
      needsAirtime = true
    }
  } else {
    needsAirtime = true
  }

  return {
    ...tracker,
    dataStatus,
    dataRemainingDays,
    airtimeDaysAgo,
    isDataExpired,
    isExpiringSoon,
    needsAirtime,
  }
}
