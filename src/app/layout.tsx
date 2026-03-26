import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SnowDesk — Daily Avalanche Briefings',
  description: 'Daily avalanche briefings for the Swiss Alps, sourced from the SLF bulletin.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
