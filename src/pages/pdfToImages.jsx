import { useEffect, useRef, useState } from 'react'
import { FileImage, Download } from 'lucide-react'
import JSZip from 'jszip'
import ConverterShell, {
  Segmented,
  ResultBar,
  ActionButton
} from '../components/ConverterShell.jsx'
import { usePdfFile } from '../utils/usePdfFile.js'
import {
  loadPdf,
  friendlyError,
  downloadBlob,
  baseName,
  parseRange,
  tick
} from '../utils/pdf.js'

// Keeps very large pages from exceeding the browser's canvas limits
const MAX_PIXELS = 36_000_000

export default function PdfToImages({ onBack }) {
  const pdfFile = usePdfFile()
  const [format, setFormat] = useState('png')
  const [scale, setScale] = useState(2)
  const [range, setRange] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [images, setImages] = useState([])
  const urlsRef = useRef([])

  function releaseImages() {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    urlsRef.current = []
    setImages([])
  }

  // free the image memory when leaving the page
  useEffect(
    () => () => urlsRef.current.forEach((url) => URL.revokeObjectURL(url)),
    []
  )

  async function convert() {
    pdfFile.setError('')
    releaseImages()
    setBusy(true)
    setProgress(0)

    try {
      const pageList = parseRange(range, pdfFile.pages)
      const pdf = await loadPdf(pdfFile.file)
      const mime = format === 'png' ? 'image/png' : 'image/jpeg'
      const ext = format === 'png' ? 'png' : 'jpg'
      const digits = String(pdfFile.pages).length
      const out = []

      for (let i = 0; i < pageList.length; i++) {
        const number = pageList[i]
        const page = await pdf.getPage(number)

        const natural = page.getViewport({ scale: 1 })
        const safeScale = Math.min(
          scale,
          Math.sqrt(MAX_PIXELS / (natural.width * natural.height))
        )
        const viewport = page.getViewport({ scale: safeScale })

        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        await page.render({ canvasContext: ctx, viewport }).promise

        const blob = await new Promise((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Could not create the image.'))),
            mime,
            0.92
          )
        )

        canvas.width = 0
        canvas.height = 0
        page.cleanup()

        out.push({
          page: number,
          blob,
          url: URL.createObjectURL(blob),
          name: `${baseName(pdfFile.file)}-page-${String(number).padStart(digits, '0')}.${ext}`
        })

        setProgress(Math.round(((i + 1) / pageList.length) * 100))
        await tick()
      }
      pdf.destroy()

      urlsRef.current = out.map((o) => o.url)
      setImages(out)
    } catch (err) {
      pdfFile.setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function downloadZip() {
    const zip = new JSZip()
    images.forEach((img) => zip.file(img.name, img.blob))
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
    downloadBlob(blob, `${baseName(pdfFile.file)}-images.zip`)
  }

  return (
    <ConverterShell
      title="PDF → Images"
      description="Export your PDF pages as PNG or JPG images."
      icon={FileImage}
      color="blue"
      onBack={onBack}
      file={pdfFile.file}
      pages={pdfFile.pages}
      onFile={(f) => {
        releaseImages()
        setRange('')
        pdfFile.select(f)
      }}
      onClear={() => {
        releaseImages()
        pdfFile.clear()
      }}
      busy={busy}
      progress={progress}
      error={pdfFile.error}
      actionLabel="Convert to images"
      onConvert={convert}
      options={
        <>
          <Segmented
            label="Format"
            value={format}
            onChange={setFormat}
            disabled={busy}
            options={[
              { value: 'png', label: 'PNG (sharpest)' },
              { value: 'jpg', label: 'JPG (smaller)' }
            ]}
          />
          <Segmented
            label="Quality"
            value={scale}
            onChange={setScale}
            disabled={busy}
            options={[
              { value: 1, label: 'Screen (1×)' },
              { value: 2, label: 'Standard (2×)' },
              { value: 3, label: 'Print (3×)' }
            ]}
          />
          <div>
            <label htmlFor="range" className="mb-2 block text-sm font-semibold">
              Pages
            </label>
            <input
              id="range"
              type="text"
              value={range}
              disabled={busy}
              onChange={(e) => setRange(e.target.value)}
              placeholder={`All pages, or e.g. 1-3, 5 (this PDF has ${pdfFile.pages})`}
              className="w-full rounded-xl border border-line-strong bg-paper px-4 py-3 text-sm outline-none transition focus:border-gold"
            />
          </div>
        </>
      }
    >
      {images.length > 0 && (
        <>
          <ResultBar
            title={`${images.length} ${images.length === 1 ? 'image' : 'images'} ready`}
            actions={
              images.length > 1 && (
                <ActionButton onClick={downloadZip}>
                  <Download size={16} /> Download all (.zip)
                </ActionButton>
              )
            }
          />

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {images.map((img) => (
              <div
                key={img.name}
                className="overflow-hidden rounded-xl border border-line bg-paper"
              >
                <img
                  src={img.url}
                  alt={`Page ${img.page}`}
                  className="aspect-[3/4] w-full bg-white object-contain"
                />
                <div className="flex items-center justify-between gap-2 p-3">
                  <span className="text-xs font-semibold">Page {img.page}</span>
                  <a
                    href={img.url}
                    download={img.name}
                    className="inline-flex items-center gap-1 text-xs font-bold text-gold-deep hover:underline"
                  >
                    <Download size={13} /> Save
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </ConverterShell>
  )
}
