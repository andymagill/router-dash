import Link from "next/link"

/** Footer shared by the text and voice playgrounds. */
export function SiteFooter() {
  return (
    <footer className="mt-4 border-t border-border/50 py-4 text-center">
      <div className="flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground">
        <a
          href="https://magill.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-foreground"
        >
          Built by Andrew Magill
        </a>
        <span>·</span>
        <Link
          href="/terms"
          className="transition-colors hover:text-foreground"
        >
          Terms
        </Link>
        <span>·</span>
        <a
          href="https://github.com/andymagill/router-dash/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-foreground"
        >
          Report an Issue
        </a>
      </div>
    </footer>
  )
}
