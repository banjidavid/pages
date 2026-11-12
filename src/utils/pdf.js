import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

export const NO_TEXT_MESSAGE =
  'No selectable text was found. This PDF is probably a scan or made of images. Text recognition (OCR) is not supported yet.'

/* ---------- loading ---------- */

export async function loadPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer())
  return pdfjsLib.getDocument({ data }).promise
}

export function friendlyError(err) {
  if (err?.name === 'PasswordException') {
    return 'This PDF is password protected. Remove the password first, then try again.'
  }
  if (err?.name === 'InvalidPDFException') {
    return 'This file is not a valid PDF, or it is damaged.'
  }
  return err?.message || 'Something went wrong. Please try again.'
}

/* ---------- small utilities ---------- */

export function isPdf(file) {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  )
}

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function baseName(file) {
  return file.name.replace(/\.pdf$/i, '')
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Lets the browser repaint (progress bars) between heavy steps
export const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

// "1-3, 5" -> [1,2,3,5]. Empty input means every page.
export function parseRange(input, total) {
  const text = input.trim()
  if (!text) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = new Set()
  for (const part of text.split(',')) {
    const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!m) {
      throw new Error(
        `"${part.trim()}" is not a valid page range. Use a format like 1-3, 5.`
      )
    }
    const from = Number(m[1])
    const to = m[2] ? Number(m[2]) : from
    if (from < 1 || to < from || to > total) {
      throw new Error(
        `Page range ${part.trim()} is outside this PDF (it has ${total} pages).`
      )
    }
    for (let n = from; n <= to; n++) pages.add(n)
  }
  return [...pages].sort((a, b) => a - b)
}

export async function readBytes(file) {
  return new Uint8Array(await file.arrayBuffer())
}

// "1-3, 4-6, 7" -> [[1,2,3],[4,5,6],[7]]
export function parseRangeGroups(input, total) {
  const parts = input.split(',').map((p) => p.trim())
  if (!input.trim() || parts.some((p) => p === '')) {
    throw new Error('Enter the page ranges, separated by commas. Example: 1-3, 4-6, 7.')
  }
  return parts.map((part) => parseRange(part, total))
}

// [1,2,3,5] -> "1-3,5"
export function describePages(pages) {
  const parts = []
  let start = pages[0]
  let prev = pages[0]
  for (let i = 1; i <= pages.length; i++) {
    const n = pages[i]
    if (n === prev + 1) {
      prev = n
      continue
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = n
    prev = n
  }
  return parts.join(',')
}

/* ---------- text extraction ---------- */

// Returns the page's text grouped into lines, top to bottom.
// Each line: { y, h, items: [{ str, x, y, w, h }] } with items sorted left to right.
export async function getPageLines(page) {
  const content = await page.getTextContent()

  const items = content.items
    .filter((i) => typeof i.str === 'string' && i.str.trim() !== '')
    .map((i) => ({
      str: i.str,
      x: i.transform[4],
      y: i.transform[5],
      w: i.width,
      h: Math.abs(i.height) || Math.abs(i.transform[3]) || 10
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const lines = []
  for (const item of items) {
    const line = lines[lines.length - 1]
    const tolerance = Math.max(2, item.h * 0.4)
    if (line && Math.abs(line.y - item.y) <= tolerance) {
      line.items.push(item)
    } else {
      lines.push({ y: item.y, items: [item] })
    }
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x)
    line.h = Math.max(...line.items.map((i) => i.h))
  }

  return lines
}

export function lineText(line) {
  let out = ''
  let prev = null
  for (const item of line.items) {
    if (prev) {
      const gap = item.x - (prev.x + prev.w)
      if (gap > prev.h * 0.15 && !out.endsWith(' ') && !item.str.startsWith(' ')) {
        out += ' '
      }
    }
    out += item.str
    prev = item
  }
  return out.trim()
}

// Turns lines into paragraphs.
// keepBreaks: true  -> every line stays its own paragraph
// keepBreaks: false -> lines are joined until a blank gap or a font-size change
// Each paragraph: { text, size, gap } (gap = starts after a blank gap or size change)
export function linesToParagraphs(lines, { keepBreaks = false } = {}) {
  const paragraphs = []
  let current = null
  let prev = null

  for (const line of lines) {
    const text = lineText(line)
    if (!text) continue

    const bigGap = prev ? prev.y - line.y > Math.max(prev.h, line.h) * 1.6 : false
    const sizeChanged = prev ? Math.abs(prev.h - line.h) > 1.5 : false

    if (!keepBreaks && current && !bigGap && !sizeChanged) {
      if (/[a-z]-$/.test(current.text) && /^[a-z]/.test(text)) {
        current.text = current.text.slice(0, -1) + text // rejoin hyphenated word
      } else {
        current.text += ' ' + text
      }
    } else {
      current = { text, size: line.h, gap: bigGap || sizeChanged }
      paragraphs.push(current)
    }
    prev = line
  }

  return paragraphs
}
