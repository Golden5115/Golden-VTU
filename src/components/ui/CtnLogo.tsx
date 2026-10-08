import React from "react"
import Image from "next/image"

interface CtnLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  showText?: boolean
  subtitle?: string
  theme?: "light" | "dark"
  className?: string
  useImage?: boolean
}

const sizeMap = {
  xs: { box: "w-6 h-6", icon: 24, font: "text-sm", sub: "text-[9px]" },
  sm: { box: "w-8 h-8", icon: 32, font: "text-base", sub: "text-[10px]" },
  md: { box: "w-10 h-10", icon: 40, font: "text-lg", sub: "text-xs" },
  lg: { box: "w-12 h-12", icon: 48, font: "text-xl", sub: "text-xs" },
  xl: { box: "w-16 h-16", icon: 64, font: "text-2xl", sub: "text-sm" },
}

export function CtnLogo({
  size = "sm",
  showText = true,
  subtitle = "VTU & SIM Station",
  theme = "light",
  className = "",
  useImage = false,
}: CtnLogoProps) {
  const cfg = sizeMap[size]

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Icon Glyph */}
      <div
        className={`${cfg.box} relative rounded-xl overflow-hidden shadow-xs shrink-0 flex items-center justify-center transition-transform hover:scale-105`}
      >
        {useImage ? (
          <Image
            src="/icon.png"
            alt="CTN Wallet"
            width={cfg.icon}
            height={cfg.icon}
            className="w-full h-full object-cover"
            priority
          />
        ) : (
          <svg
            viewBox="0 0 128 128"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="ctn-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00E5FF" />
                <stop offset="50%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
              <linearGradient id="ctn-card-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Background container */}
            <rect width="128" height="128" rx="28" fill="#0B132B" />

            {/* Stylized 'C' monogram */}
            <path
              d="M86 36 C76 26, 44 26, 34 40 C22 56, 22 76, 34 92 C44 104, 76 104, 88 92"
              stroke="url(#ctn-brand-grad)"
              strokeWidth="12"
              strokeLinecap="round"
            />

            {/* Internal wallet card graphic */}
            <rect
              x="52"
              y="48"
              width="46"
              height="32"
              rx="6"
              fill="url(#ctn-card-grad)"
              stroke="url(#ctn-brand-grad)"
              strokeWidth="3.5"
            />

            {/* Telecom Connectivity Wave */}
            <path
              d="M48 64 L58 64 L64 54 L72 74 L78 61 L84 64 L96 64"
              stroke="#00E5FF"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="96" cy="64" r="3" fill="#FFFFFF" />
          </svg>
        )}
      </div>

      {/* Typography */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1 leading-tight">
            <span
              className={`font-black tracking-tight ${cfg.font} ${
                theme === "dark" ? "text-white" : "text-gray-900"
              }`}
            >
              CTN <span className="text-blue-600">Wallet</span>
            </span>
          </div>
          {subtitle && (
            <span
              className={`font-medium tracking-normal ${cfg.sub} ${
                theme === "dark" ? "text-slate-400" : "text-gray-500"
              }`}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
