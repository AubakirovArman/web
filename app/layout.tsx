import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ApplicationProvider } from "@/lib/hooks/useApplications"
import { RulesProvider } from "@/lib/hooks/useRules"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' })

const fontMono = Geist_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <ThemeProvider>
          <RulesProvider>
            <ApplicationProvider>
              {children}
              <Toaster position="top-right" />
            </ApplicationProvider>
          </RulesProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
