import { useState } from 'react'
import { Wrench, Download } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import ConverterShell, {
  ResultBar,
  ActionButton
} from '../components/ConverterShell.jsx'
import { usePdfFile } from '../utils/usePdfFile.js'
import {
  loadPdf,
  readBytes,
  friendlyError,
  downloadBlob,
  baseName,
  formatSize,
  tick
} from '../utils/pdf.js'

// Step 1: re-save the PDF into a clean new file, page by page.
// Pages that cannot be copied are skipped.
async function repairStructure(bytes, onProgress) {
  const source = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false
  })
  const out = await PDFDocument.create()
  const indices = source.getPageIndices()
  let recovered = 0

  for (let i = 0; i < indices.length; i++) {
    try {
      const [page] = await out.copyPages(source, [indices[i]])
      out.addPage(page)
      recovered++
    } catch {
      // skip a page that is too damaged to copy
    }
    onProgress(Math.round(((i + 1) / indices.length) * 100))
    if (i % 5 === 0) await tick()
  }

  if (recovered === 0) throw new Error('No pages could be recovered.')
  return { bytes: await out.save(), recovered, total: indices.length }
}

// Step 2 (fallback): pdf.js is very forgiving. If it can draw the pages,
// rebuild the PDF from page pictures. Text will no longer be selectable.
async function rebuildFromImages(file, onProgress) {
  const pdf = await loadPdf(file)
  const out = await PDFDocument.create()
  let recovered = 0

  for (let n = 1; n <= pdf.numPages; n++) {
    try {
      const page = await pdf.getPage(n)
      const size = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: 2 })

      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise

      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject()), 'image/jpeg', 0.9)
      )
      canvas.width = 0
      canvas.height = 0
      page.cleanup()

      const image = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
      const outPage = out.addPage([size.width, size.height])
      outPage.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height })
      recovered++
    } catch {
      // skip a page that cannot be drawn
    }
    onProgress(Math.round((n / pdf.numPages) * 100))
    await tick()
  }

  const total = pdf.numPages
  pdf.destroy()
  if (recovered === 0) throw new Error('No pages could be recovered.')
  return { bytes: await out.save(), recovered, total }
}

export default function Repair({ onBack }) {
  const pdfFile = usePdfFile({ lenient: true })
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)

  async function convert() {
    pdfFile.setError('')
    setResult(null)
    setBusy(true)
    setProgress(0)

    try {
      let repaired
      let mode = 'structure'

      try {
        repaired = await repairStructure(await readBytes(pdfFile.file), setProgress)
      } catch {
        setProgress(0)
        mode = 'images'
        try {
          repaired = await rebuildFromImages(pdfFile.file, setProgress)
        } catch {
          throw new Error(
            'This PDF is too damaged to recover here. Try re-downloading or re-exporting the original file.'
          )
        }
      }

      setResult({
        blob: new Blob([repaired.bytes], { type: 'application/pdf' }),
        name: `${baseName(pdfFile.file)}-repaired.pdf`,
        mode,
        recovered: repaired.recovered,
        total: repaired.total
      })
    } catch (err) {
      pdfFile.setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const skipped = result ? result.total - result.recovered : 0

  return (
    <ConverterShell
      title="Repair PDF"
      description="Try to fix a damaged or corrupted PDF that will not open."
      icon={Wrench}
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
      actionLabel="Repair PDF"
      onConvert={convert}
      options={
        <p className="text-sm leading-6 text-muted">
          First we rebuild the PDF into a clean new file. If that does not
          work, we try redrawing each page as a picture instead. Some badly
          damaged files cannot be recovered.
        </p>
      }
    >
      {result && (
        <>
          <ResultBar
            title={skipped === 0 ? 'Your PDF was repaired' : 'Your PDF was partly repaired'}
            detail={`${result.recovered} of ${result.total} ${result.total === 1 ? 'page' : 'pages'} recovered · ${formatSize(result.blob.size)}`}
            actions={
              <ActionButton onClick={() => downloadBlob(result.blob, result.name)}>
                <Download size={16} /> Download PDF
              </ActionButton>
            }
          />
          {result.mode === 'images' && (
            <p className="mt-4 text-sm leading-6 text-muted">
              The file could not be fixed directly, so its pages were redrawn
              as pictures. It will open normally, but the text can no longer be
              selected or searched.
            </p>
          )}
          {skipped > 0 && (
            <p className="mt-2 text-sm leading-6 text-muted">
              {skipped} {skipped === 1 ? 'page was' : 'pages were'} too
              damaged to recover and {skipped === 1 ? 'was' : 'were'} left out.
            </p>
          )}
        </>
      )}
    </ConverterShell>
  )
}
