export type DiffOp = "equal" | "insert" | "delete"

export interface DiffRow {
  left: string | null
  right: string | null
  type: DiffOp
}

/**
 * Line-based diff using a longest-common-subsequence backtrack.
 * Produces aligned rows suitable for a two-column side-by-side view.
 */
export function diffLines(a: string, b: string): DiffRow[] {
  const left = a.split("\n")
  const right = b.split("\n")
  const n = left.length
  const m = right.length

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  )
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (left[i] === right[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1])
      }
    }
  }

  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      rows.push({ left: left[i], right: right[j], type: "equal" })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ left: left[i], right: null, type: "delete" })
      i++
    } else {
      rows.push({ left: null, right: right[j], type: "insert" })
      j++
    }
  }
  while (i < n) {
    rows.push({ left: left[i], right: null, type: "delete" })
    i++
  }
  while (j < m) {
    rows.push({ left: null, right: right[j], type: "insert" })
    j++
  }
  return rows
}

export interface DiffStats {
  added: number
  removed: number
  unchanged: number
}

export function diffStats(rows: DiffRow[]): DiffStats {
  return rows.reduce(
    (acc, r) => {
      if (r.type === "insert") acc.added++
      else if (r.type === "delete") acc.removed++
      else acc.unchanged++
      return acc
    },
    { added: 0, removed: 0, unchanged: 0 },
  )
}
