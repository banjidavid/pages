import { useState } from 'react'
import { FileText, Copy, Check, Download } from 'lucide-react'
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
  linesToParagraphs,
  friendlyError,
  downloadBlob,
  baseName,
  tick,
  NO_TEXT_MESSAGE
} from '../utils/pdf.js'

export default function PdfToText({ onBack }) {
  const pdfFile = usePdfFile()
  const [layout, setLayout] = useState('lines')
  const [separators, setSeparators] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  async function convert() {
    pdfFile.setError('')
    setResult(null)
    setBusy(true)
    setProgress(0)

    try {
      const pdf = await loadPdf(pdfFile.file)
      const chunks = []

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const lines = await getPageLines(page)
        page.cleanup()

        const paragraphs = linesToParagraphs(lines, {
          keepBreaks: layout === 'lines'
        })

        let text = ''
        paragraphs.forEach((p, idx) => {
          if (idx > 0) text += layout === 'paragraphs' || p.gap ? '\n\n' : '\n'
          text += p.text
        })

        chunks.push(text)
        setProgress(Math.round((i / pdf.numPages) * 100))
        await tick()
      }
      pdf.destroy()

      if (!chunks.join('').trim()) throw new Error(NO_TEXT_MESSAGE)

      const text = chunks
        .map((t, i) => (separators ? `--- Page ${i + 1} ---\n\n${t}` : t))
        .join('\n\n')

      setResult({ text, words: text.trim().split(/\s+/).length })
    } catch (err) {
      pdfFile.setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      pdfFile.setError('Could not copy. Select the text and copy it manually.')
    }
  }

  function download() {
    const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' })
    downloadBlob(blob, `${baseName(pdfFile.file)}.txt`)
  }

  return (
    <ConverterShell
      title="PDF → Text"
      description="Extract the plain text from your PDF."
      icon={FileText}
      color="purple"
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
      actionLabel="Extract text"
      onConvert={convert}
      options={
        <>
          <Segmented
            label="Layout"
            value={layout}
            onChange={setLayout}
            disabled={busy}
            options={[
              { value: 'lines', label: 'Keep line breaks' },
              { value: 'paragraphs', label: 'Join into paragraphs' }
            ]}
          />
          <Toggle
            label="Add page separators"
            hint="Inserts “--- Page 1 ---” before each page."
            checked={separators}
            onChange={setSeparators}
            disabled={busy}
          />
        </>
      }
    >
      {result && (
        <>
          <ResultBar
            title="Text extracted"
            detail={`${result.words.toLocaleString()} words`}
            actions={
              <>
                <ActionButton onClick={copy} variant="light">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied' : 'Copy'}
                </ActionButton>
                <ActionButton onClick={download}>
                  <Download size={16} /> Download .txt
                </ActionButton>
              </>
            }
          />
          <textarea
            readOnly
            value={result.text}
            className="mt-5 h-80 w-full resize-y rounded-xl border border-line bg-paper p-4 font-mono text-sm leading-6 outline-none"
          />
        </>
      )}
    </ConverterShell>
  )
}
