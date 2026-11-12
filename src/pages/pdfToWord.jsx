import { useState } from 'react'
import { FileType, Download } from 'lucide-react'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import ConverterShell, {
  Toggle,
  ResultBar,
  ActionButton
} from '../components/ConverterShell.jsx'
import { usePdfFile } from '../utils/usePdfFile.js'
import {
  loadPdf,
  getPageLines,
  linesToParagraphs,
  friendlyError,
  downloadBlob,
  baseName,
  formatSize,
  tick,
  NO_TEXT_MESSAGE
} from '../utils/pdf.js'

const BODY_SIZE = 22 // 11pt, in Word half-points

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] || 10
}

export default function PdfToWord({ onBack }) {
  const pdfFile = usePdfFile()
  const [keepBreaks, setKeepBreaks] = useState(false)
  const [keepPages, setKeepPages] = useState(true)
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
      const pagesLines = []

      // 1. read every page (first 80% of the progress bar)
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        pagesLines.push(await getPageLines(page))
        page.cleanup()
        setProgress(Math.round((i / pdf.numPages) * 80))
        await tick()
      }
      pdf.destroy()

      const allLines = pagesLines.flat()
      if (allLines.length === 0) throw new Error(NO_TEXT_MESSAGE)

      // 2. build the Word document
      const bodySize = median(allLines.map((l) => l.h))
      const children = []

      pagesLines.forEach((lines, pageIndex) => {
        const paragraphs = linesToParagraphs(lines, { keepBreaks })

        // keep the original page count even if a page has no text
        if (paragraphs.length === 0) {
          if (keepPages && pageIndex > 0) {
            children.push(new Paragraph({ pageBreakBefore: true }))
          }
          return
        }

        paragraphs.forEach((p, index) => {
          const ratio = p.size / bodySize
          const isHeading = ratio >= 1.25
          const size = isHeading
            ? Math.min(56, Math.max(24, Math.round(BODY_SIZE * ratio)))
            : BODY_SIZE

          children.push(
            new Paragraph({
              pageBreakBefore: keepPages && pageIndex > 0 && index === 0,
              spacing: { after: isHeading ? 200 : 120 },
              children: [
                new TextRun({
                  text: p.text,
                  bold: isHeading,
                  size,
                  font: 'Calibri'
                })
              ]
            })
          )
        })
      })

      const doc = new Document({ sections: [{ children }] })
      const blob = await Packer.toBlob(doc)
      setProgress(100)
      setResult({ blob, name: `${baseName(pdfFile.file)}.docx` })
    } catch (err) {
      pdfFile.setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConverterShell
      title="PDF → Word"
      description="Convert your PDF into an editable Word document."
      icon={FileType}
      color="blue"
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
      actionLabel="Convert to Word"
      onConvert={convert}
      options={
        <>
          <Toggle
            label="Keep original page breaks"
            hint="Each PDF page starts on a new page in Word."
            checked={keepPages}
            onChange={setKeepPages}
            disabled={busy}
          />
          <Toggle
            label="Keep original line breaks"
            hint="Turn on for lists, addresses or poems. Leave off for normal paragraphs."
            checked={keepBreaks}
            onChange={setKeepBreaks}
            disabled={busy}
          />
          <p className="text-xs leading-5 text-subtle">
            This converts the text and headings. Images, tables and exact
            layout are not carried over.
          </p>
        </>
      }
    >
      {result && (
        <ResultBar
          title="Your Word document is ready"
          detail={`${result.name} · ${formatSize(result.blob.size)}`}
          actions={
            <ActionButton onClick={() => downloadBlob(result.blob, result.name)}>
              <Download size={16} /> Download .docx
            </ActionButton>
          }
        />
      )}
    </ConverterShell>
  )
}
