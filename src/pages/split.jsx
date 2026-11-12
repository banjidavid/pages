import { useState } from 'react'
import { Scissors, Download } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import ConverterShell, {
  Segmented,
  ResultBar,
  ActionButton
} from '../components/ConverterShell.jsx'
import { usePdfFile } from '../utils/usePdfFile.js'
import {
  readBytes,
  parseRange,
  parseRangeGroups,
  describePages,
  friendlyError,
  downloadBlob,
  baseName,
  formatSize,
  tick
} from '../utils/pdf.js'

const MODES = [
  { value: 'extract', label: 'Extract pages' },
  { value: 'ranges', label: 'Split by ranges' },
  { value: 'each', label: 'Every page' },
  { value: 'every', label: 'Every N pages' }
]

const inputClass =
  'w-full rounded-xl border border-line-strong bg-paper px-4 py-3 text-sm outline-none transition focus:border-gold'

export default function Split({ onBack }) {
  const pdfFile = usePdfFile()
  const [mode, setMode] = useState('extract')
  const [range, setRange] = useState('')
  const [everyN, setEveryN] = useState('2')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [files, setFiles] = useState([])

  function buildGroups() {
    const total = pdfFile.pages

    if (mode === 'extract') {
      if (!range.trim()) {
        throw new Error('Enter the pages you want to extract. Example: 1-3, 5.')
      }
      return [parseRange(range, total)]
    }
    if (mode === 'ranges') return parseRangeGroups(range, total)

    const all = Array.from({ length: total }, (_, i) => i + 1)
    if (mode === 'each') return all.map((n) => [n])

    const n = parseInt(everyN, 10)
    if (!n || n < 1) throw new Error('Enter a number of pages greater than 0.')
    const groups = []
    for (let i = 0; i < all.length; i += n) groups.push(all.slice(i, i + n))
    return groups
  }

  async function convert() {
    pdfFile.setError('')
    setFiles([])
    setBusy(true)
    setProgress(0)

    try {
      const groups = buildGroups()
      const source = await PDFDocument.load(await readBytes(pdfFile.file))
      const base = baseName(pdfFile.file)
      const out = []

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i]
        const doc = await PDFDocument.create()
        const copied = await doc.copyPages(
          source,
          group.map((n) => n - 1)
        )
        copied.forEach((p) => doc.addPage(p))
        const bytes = await doc.save()

        const label = describePages(group)
        const name =
          mode === 'extract'
            ? `${base}-extracted.pdf`
            : `${base}-${group.length === 1 ? 'page' : 'pages'}-${label.replace(/,/g, '_')}.pdf`

        out.push({
          name,
          label: `${group.length === 1 ? 'Page' : 'Pages'} ${label.replace(/,/g, ', ')}`,
          blob: new Blob([bytes], { type: 'application/pdf' })
        })

        setProgress(Math.round(((i + 1) / groups.length) * 100))
        await tick()
      }

      setFiles(out)
    } catch (err) {
      pdfFile.setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function downloadZip() {
    const zip = new JSZip()
    files.forEach((f) => zip.file(f.name, f.blob))
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
    downloadBlob(blob, `${baseName(pdfFile.file)}-split.zip`)
  }

  const rangeMode = mode === 'extract' || mode === 'ranges'

  return (
    <ConverterShell
      title="Split PDF"
      description="Split a PDF into separate pages or page ranges."
      icon={Scissors}
      color="peach"
      onBack={onBack}
      file={pdfFile.file}
      pages={pdfFile.pages}
      onFile={(f) => {
        setFiles([])
        setRange('')
        pdfFile.select(f)
      }}
      onClear={() => {
        setFiles([])
        pdfFile.clear()
      }}
      busy={busy}
      progress={progress}
      error={pdfFile.error}
      actionLabel="Split PDF"
      onConvert={convert}
      options={
        <>
          <Segmented
            label="How do you want to split it?"
            value={mode}
            onChange={(m) => {
              setMode(m)
              setFiles([])
            }}
            disabled={busy}
            options={MODES}
          />

          {rangeMode && (
            <div>
              <label htmlFor="split-range" className="mb-2 block text-sm font-semibold">
                {mode === 'extract' ? 'Pages to extract' : 'Page ranges'}
              </label>
              <input
                id="split-range"
                type="text"
                value={range}
                disabled={busy}
                onChange={(e) => setRange(e.target.value)}
                placeholder={
                  mode === 'extract'
                    ? 'e.g. 1-3, 5 (one PDF with these pages)'
                    : 'e.g. 1-3, 4-6, 7 (one PDF for each range)'
                }
                className={inputClass}
              />
              <p className="mt-2 text-xs text-subtle">
                This PDF has {pdfFile.pages} {pdfFile.pages === 1 ? 'page' : 'pages'}.
              </p>
            </div>
          )}

          {mode === 'every' && (
            <div>
              <label htmlFor="split-n" className="mb-2 block text-sm font-semibold">
                Pages in each file
              </label>
              <input
                id="split-n"
                type="number"
                min="1"
                value={everyN}
                disabled={busy}
                onChange={(e) => setEveryN(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          {mode === 'each' && (
            <p className="text-sm text-muted">
              You will get {pdfFile.pages} separate PDFs, one for each page.
            </p>
          )}
        </>
      }
    >
      {files.length > 0 && (
        <>
          <ResultBar
            title={files.length === 1 ? 'Your PDF is ready' : `${files.length} PDFs ready`}
            actions={
              files.length === 1 ? (
                <ActionButton onClick={() => downloadBlob(files[0].blob, files[0].name)}>
                  <Download size={16} /> Download PDF
                </ActionButton>
              ) : (
                <ActionButton onClick={downloadZip}>
                  <Download size={16} /> Download all (.zip)
                </ActionButton>
              )
            }
          />

          {files.length > 1 && (
            <ul className="mt-5 max-h-80 divide-y divide-line-soft overflow-y-auto rounded-xl border border-line">
              {files.map((f) => (
                <li key={f.name} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{f.label}</p>
                    <p className="text-xs text-subtle">{formatSize(f.blob.size)}</p>
                  </div>
                  <button
                    onClick={() => downloadBlob(f.blob, f.name)}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-gold-deep hover:underline"
                  >
                    <Download size={13} /> Save
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </ConverterShell>
  )
}
