import type { Metadata } from "next"

// The page is a client component, which can't export metadata itself.
export const metadata: Metadata = {
  title: "Voice transcription",
  description:
    "Upload an audio file and compare speech-to-text models from Groq and OpenRouter side by side, with latency and word-count metrics.",
}

export default function TranscribeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
