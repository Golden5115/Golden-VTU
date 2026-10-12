import { Loader2 } from "lucide-react"

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top indeterminate loading indicator bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-blue-100 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 w-full animate-pulse" />
      </div>

      {/* Screen Header Skeleton with Loading Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200/80 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-gray-100 rounded-md animate-pulse" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50/80 px-3 py-1.5 rounded-full border border-blue-200/60 w-fit shrink-0">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Loading screen...</span>
        </div>
      </div>

      {/* Quick Stats Skeleton Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="h-28 rounded-xl border border-gray-200/70 bg-white p-4 space-y-3 shadow-xs">
          <div className="flex justify-between items-center">
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse" />
          </div>
          <div className="h-7 w-32 bg-gray-200/70 rounded animate-pulse" />
        </div>
        <div className="h-28 rounded-xl border border-gray-200/70 bg-white p-4 space-y-3 shadow-xs">
          <div className="flex justify-between items-center">
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse" />
          </div>
          <div className="h-7 w-32 bg-gray-200/70 rounded animate-pulse" />
        </div>
        <div className="hidden lg:block h-28 rounded-xl border border-gray-200/70 bg-white p-4 space-y-3 shadow-xs">
          <div className="flex justify-between items-center">
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse" />
          </div>
          <div className="h-7 w-32 bg-gray-200/70 rounded animate-pulse" />
        </div>
      </div>

      {/* Main Table / Content Skeleton */}
      <div className="rounded-xl border border-gray-200/70 bg-white p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="h-5 w-36 bg-gray-200/70 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-50/70 border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-200/70 animate-pulse shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 sm:w-48 bg-gray-200/70 rounded animate-pulse" />
                  <div className="h-3 w-20 sm:w-28 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="space-y-1.5 text-right">
                <div className="h-4 w-16 bg-gray-200/70 rounded animate-pulse ml-auto" />
                <div className="h-3 w-12 bg-gray-100 rounded animate-pulse ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
