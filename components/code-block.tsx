"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const KEYWORDS = new Set([
  "const","let","var","function","return","if","else","for","while","do","switch",
  "case","break","continue","new","class","extends","import","from","export","default",
  "async","await","try","catch","finally","throw","typeof","instanceof","in","of","this",
  "null","undefined","true","false","void","yield","static","public","private","protected",
  "def","elif","lambda","None","True","False","and","or","not","with","as","pass","raise",
  "print","int","str","float","bool","list","dict","self","interface","type","enum","struct",
  "func","package","fn","pub","use","match","impl","mut","string","number","boolean","any",
])

type Tok = { text: string; kind: "plain" | "str" | "com" | "num" | "kw" }

/** Lightweight, language-agnostic tokenizer for subtle syntax coloring. */
function tokenize(code: string): Tok[] {
  const toks: Tok[] = []
  const re =
    /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d[\d_.]*\b)|([A-Za-z_$][A-Za-z0-9_$]*)|([\s\S])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    if (m[1]) toks.push({ text: m[1], kind: "com" })
    else if (m[2]) toks.push({ text: m[2], kind: "str" })
    else if (m[3]) toks.push({ text: m[3], kind: "num" })
    else if (m[4])
      toks.push({ text: m[4], kind: KEYWORDS.has(m[4]) ? "kw" : "plain" })
    else if (m[5]) toks.push({ text: m[5], kind: "plain" })
  }
  return toks
}

const KIND_CLASS: Record<Tok["kind"], string> = {
  plain: "text-foreground/90",
  str: "text-[oklch(0.75_0.14_155)]",
  com: "text-muted-foreground/70 italic",
  num: "text-[oklch(0.78_0.13_75)]",
  kw: "text-[oklch(0.72_0.14_300)]",
}

export function CodeBlock({
  code,
  language,
}: {
  code: string
  language?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const tokens = React.useMemo(() => tokenize(code), [code])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // clipboard blocked
    }
  }

  return (
    <div className="group/code my-3 overflow-hidden rounded-lg border border-border bg-background/60">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? (
            <CheckIcon className="size-3 text-[color:var(--ok)]" />
          ) : (
            <CopyIcon className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scrollbar-thin overflow-x-auto p-3 text-[12.5px] leading-relaxed">
        <code className="font-mono">
          {tokens.map((t, i) => (
            <span key={i} className={cn(KIND_CLASS[t.kind])}>
              {t.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}
