import * as React from "react"
import { CodeBlock } from "@/components/code-block"

/** Parse inline markdown (code, bold, italic, links) into React nodes. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index))
    }
    const token = m[0]
    const key = `${keyPrefix}-${i++}`
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      )
    } else {
      const label = token.slice(1, token.indexOf("]"))
      const url = token.slice(token.indexOf("(") + 1, -1)
      nodes.push(
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {label}
        </a>,
      )
    }
    last = m.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

type Block =
  | { kind: "code"; lang?: string; content: string }
  | { kind: "heading"; level: number; content: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; content: string }
  | { kind: "hr" }
  | { kind: "p"; content: string }

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    const fence = line.match(/^```(\w+)?\s*$/)
    if (fence) {
      const lang = fence[1]
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++ // skip closing fence
      blocks.push({ kind: "code", lang, content: buf.join("\n") })
      continue
    }

    // Blank line
    if (line.trim() === "") {
      i++
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ kind: "hr" })
      i++
      continue
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        content: heading[2],
      })
      i++
      continue
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""))
        i++
      }
      blocks.push({ kind: "quote", content: buf.join(" ") })
      continue
    }

    // Lists
    const ordered = /^\s*\d+\.\s+/.test(line)
    const unordered = /^\s*[-*+]\s+/.test(line)
    if (ordered || unordered) {
      const items: string[] = []
      const itemRe = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/
      while (i < lines.length && itemRe.test(lines[i])) {
        items.push(lines[i].replace(itemRe, ""))
        i++
      }
      blocks.push({ kind: "list", ordered, items })
      continue
    }

    // Paragraph (gather consecutive non-blank, non-special lines)
    const buf: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i])
    ) {
      buf.push(lines[i])
      i++
    }
    blocks.push({ kind: "p", content: buf.join("\n") })
  }

  return blocks
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-lg font-semibold mt-4 mb-2",
  2: "text-base font-semibold mt-4 mb-2",
  3: "text-sm font-semibold mt-3 mb-1.5",
  4: "text-sm font-semibold mt-3 mb-1.5",
  5: "text-sm font-medium mt-2 mb-1",
  6: "text-xs font-medium mt-2 mb-1 uppercase tracking-wide text-muted-foreground",
}

export function Markdown({ content }: { content: string }) {
  const blocks = React.useMemo(() => parseBlocks(content), [content])

  return (
    <div className="text-[13.5px] leading-relaxed text-foreground/90">
      {blocks.map((b, idx) => {
        switch (b.kind) {
          case "code":
            return <CodeBlock key={idx} code={b.content} language={b.lang} />
          case "heading": {
            const Tag = `h${b.level}` as React.ElementType
            return (
              <Tag key={idx} className={HEADING_CLASS[b.level]}>
                {renderInline(b.content, `h${idx}`)}
              </Tag>
            )
          }
          case "list":
            return b.ordered ? (
              <ol
                key={idx}
                className="my-2 list-decimal space-y-1 pl-5 marker:text-muted-foreground"
              >
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `li${idx}-${j}`)}</li>
                ))}
              </ol>
            ) : (
              <ul
                key={idx}
                className="my-2 list-disc space-y-1 pl-5 marker:text-muted-foreground"
              >
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `li${idx}-${j}`)}</li>
                ))}
              </ul>
            )
          case "quote":
            return (
              <blockquote
                key={idx}
                className="my-2 border-l-2 border-primary/50 pl-3 text-muted-foreground italic"
              >
                {renderInline(b.content, `q${idx}`)}
              </blockquote>
            )
          case "hr":
            return <hr key={idx} className="my-3 border-border" />
          case "p":
          default:
            return (
              <p key={idx} className="my-2 whitespace-pre-wrap">
                {renderInline(b.content, `p${idx}`)}
              </p>
            )
        }
      })}
    </div>
  )
}
