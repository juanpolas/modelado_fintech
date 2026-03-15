import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MiroFish AR Fintech Simulator',
  description: 'Argentina fintech behavior simulation dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
