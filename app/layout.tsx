import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { WelcomeDialog } from '@/components/router-dash/welcome-dialog'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://router-dash.vercel.app'

const title = 'RouterDash — LLM Benchmark Playground'
const description =
  'A high-density developer playground to test and compare LLM models side by side across OpenRouter, Groq, and Cerebras. Parallel execution, latency, token, and cost metrics.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    // Shared links fall back to this generic, brand-safe template.
    template: '%s | RouterDash',
  },
  description,
  applicationName: 'RouterDash',
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'RouterDash',
    title,
    description,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'RouterDash — compare LLMs side by side',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#1a1a1f',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark bg-background ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
        <WelcomeDialog />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
