import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Golden VTU",
  description: "Instant Airtime and Data VTU Portal",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
