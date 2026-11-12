import { useState } from 'react'
import { FileSpreadsheet, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import ConverterShell, {
  Toggle,
  Segmented,
  ResultBar,
  ActionButton
} from '../components/ConverterShell.jsx'
import { usePdfFile } from '../utils/usePdfFile.js'
import {
  loadPdf,
  getPageLines,
  friendlyError,
  downloadBlob,
  baseName,
  formatSize,
  tick,
  NO_TEXT_MESSAGE
} from '../utils/pdf.js'

/* ---------- table detection ---------- */

// Splits one line of text into cells wherever there is a wide horizontal gap.
function lineToCells(line) {
  const cells = []
  for (const item of line.items) {
    const last = cells[cells.length - 1]
    if (last) {
      const gap = item.x - last.end
      if (gap <= Math.max(6, item.h * 0.9)) {
        last.text += (gap > item.h * 0.15 ? ' ' : '') + item.str
        last.end = item.x + item.w
        continue
      }
    }
    cells.push({ text: item.str, x: item.x, end: item.x + item.w })
  }
  return cells.map((c) => ({ ...c, text: c.text.trim() }))
}

// Consecutive lines with 2+ cells form a table. Other lines are plain text.
function buildSegments(lines) {
  const segments = []
  for (const line of lines) {
    const cells = lineToCells(line)
    if (cells.length === 0) continue

    if (cells.length >= 2) {
      const last = segments[segments.length - 1]
      if (last && last.type === 'table') last.rows.push(cells)
      else segments.push({ type: 'table', rows: [cells] })
    } else {
      segments.push({ type: 'text', text: cells[0].text })
    }
  }
  return segments
}

// Lines up each cell with a column, based on where the cells start.
function assignColumns(rows) {
  const xs = rows
    .flat()
    .map((c) => c.x)
    .sort((a, b) => a - b)

  const starts = []
  for (const x of xs) {
    if (starts.length === 0 || x - starts[starts.length - 1] > 12) starts.push(x)
  }

  return rows.map((cells) => {
    const row = Array(starts.length).fill('')
    for (const cell of cells) {
      let best = 0
      for (let i = 1; i < starts.length; i++) {
        if (Math.abs(starts[i] - cell.x) < Math.abs(starts[best] - cell.x)) best = i
      }
      row[best] = row[best] ? `${row[best]} ${cell.text}` : cell.text
    }
    return row
  })
}

// "1,234.50" -> 1234.5 ; "007" stays text so leading zeros are kept
function toValue(text) {
  const t = text.trim()
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ''))
  if (/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(t)) return Number(t)
  return t
}

// Turns one page's lines into spreadsheet rows.
function pageToRows(lines, includeText) {
  const rows = []
  let tables = 0

  const addBlank = () => {
    if (rows.length > 0 && rows[rows.length - 1].length > 0) rows.push([])
  }

  for (const segment of buildSegments(lines)) {
    if (segment.type === 'table' && segment.rows.length >= 2) {
      addBlank()
      assignColumns(segment.rows).forEach((r) => rows.push(r.map(toValue)))
      rows.push([])
      tables++
    } else if (includeText) {
      if (segment.type === 'text') rows.push([segment.text])
      else rows.push(segment.rows[0].map((c) => toValue(c.text)))
    }
  }

  while (rows.length && rows[rows.length - 1].length === 0) rows.pop()
  return { rows, tables }
}

function makeSheet(rows) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const widths = []
  rows.forEach((row) =>
    row.forEach((value, col) => {
      const length = String(value ?? '').length
      widths[col] = Math.min(60, Math.max(widths[col] || 8, length + 2))
    })
  )
  sheet['!cols'] = widths.map((wch) => ({ wch }))
  return sheet
}

/* ---------- the page ---------- */

export default function PdfToExcel({ onBack }) {
  const pdfFile = usePdfFile()
  const [sheets, setSheets] = useState('perPage')
  const [includeText, setIncludeText] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)

  async function convert() {
    pdfFile.setError('')
    setResult(null)
    setBusy(true)
    setProgress(0)

    try {
      const pdf = await loadPdf(pdfFile.file)
      const pages = []
      let totalLines = 0

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const lines = await getPageLines(page)
        page.cleanup()

        totalLines += lines.length
        pages.push(pageToRows(lines, includeText))

        setProgress(Math.round((i / pdf.numPages) * 100))
        await tick()
      }
      pdf.destroy()

      if (totalLines === 0) throw new Error(NO_TEXT_MESSAGE)

      const withData = pages
        .map((p, i) => ({ ...p, page: i + 1 }))
        .filter((p) => p.rows.length > 0)

      if (withData.length === 0) {
        throw new Error(
          'No tables were found in this PDF. Try turning on “Include text that is not in a table”.'
        )
      }

      const workbook = XLSX.utils.book_new()

      if (sheets === 'perPage') {
        withData.forEach((p) =>
          XLSX.utils.book_append_sheet(workbook, makeSheet(p.rows), `Page ${p.page}`)
        )
      } else {
        const combined = []
        withData.forEach((p, idx) => {
          if (idx > 0) combined.push([])
          combined.push(...p.rows)
        })
        XLSX.utils.book_append_sheet(workbook, makeSheet(combined), 'Data')
      }

      const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([out], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })

      setResult({
        blob,
        name: `${baseName(pdfFile.file)}.xlsx`,
        tables: withData.reduce((sum, p) => sum + p.tables, 0)
      })
    } catch (err) {
      pdfFile.setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConverterShell
      title="PDF → Excel"
      description="Extract tables and data from your PDF into a spreadsheet."
      icon={FileSpreadsheet}
      color="mint"
      onBack={onBack}
      file={pdfFile.file}
      pages={pdfFile.pages}
      onFile={(f) => {
        setResult(null)
        pdfFile.select(f)
      }}
      onClear={() => {
        setResult(null)
        pdfFile.clear()
      }}
      busy={busy}
      progress={progress}
      error={pdfFile.error}
      actionLabel="Convert to Excel"
      onConvert={convert}
      options={
        <>
          <Segmented
            label="Sheets"
            value={sheets}
            onChange={setSheets}
            disabled={busy}
            options={[
              { value: 'perPage', label: 'One sheet per page' },
              { value: 'single', label: 'Everything in one sheet' }
            ]}
          />
          <Toggle
            label="Include text that is not in a table"
            hint="Adds headings and paragraphs as extra rows."
            checked={includeText}
            onChange={setIncludeText}
            disabled={busy}
          />
          <p className="text-xs leading-5 text-subtle">
            Tables are detected from how the text is spaced, so results work
            best on clean, text-based tables. Check the numbers after
            converting.
          </p>
        </>
      }
    >
      {result && (
        <ResultBar
          title="Your spreadsheet is ready"
          detail={`${result.tables} ${result.tables === 1 ? 'table' : 'tables'} found · ${formatSize(result.blob.size)}`}
          actions={
            <ActionButton onClick={() => downloadBlob(result.blob, result.name)}>
              <Download size={16} /> Download .xlsx
            </ActionButton>
          }
        />
      )}
    </ConverterShell>
  )
}
