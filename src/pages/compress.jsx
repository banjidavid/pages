
import { useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import {
  ArrowLeft,
  UploadCloud,
  FileText,
  FileArchive,
  Download,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  LoaderCircle,
  RefreshCw
} from 'lucide-react'
import { formatSize } from '../utils/pdf.js'

GlobalWorkerOptions.workerSrc = pdfWorker

export default function Compress({ onBack }) {
  const [file, setFile] = useState(null)
  const [quality, setQuality] = useState('medium')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const inputRef = useRef(null)

  const qualities = {
    low: { scale: 1.1, jpeg: 0.45 },
    medium: { scale: 1.5, jpeg: 0.65 },
    high: { scale: 2, jpeg: 0.85 }
  }

  function selectFile(selectedFile) {
    if (!selectedFile) return

    if (
      selectedFile.type !== 'application/pdf' &&
      !selectedFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('Please select a valid PDF file.')
      return
    }

    setFile(selectedFile)
    setResult(null)
    setError('')
    setProgress(0)
  }

  function reset() {
    setFile(null)
    setResult(null)
    setError('')
    setProgress(0)

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  async function compressPDF() {
    if (!file) return

    setProcessing(true)
    setError('')
    setProgress(0)
    setResult(null)

    let pdf = null

    try {
      const settings = qualities[quality]
      const originalBytes = await file.arrayBuffer()

      // Read the original PDF
      pdf = await getDocument({
        data: new Uint8Array(originalBytes)
      }).promise

      // Create a new PDF
      const outputPDF = await PDFDocument.create()

      // Process every page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)

        const viewport = page.getViewport({
          scale: settings.scale
        })

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', {
          alpha: false
        })

        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)

        context.fillStyle = '#FFFFFF'
        context.fillRect(0, 0, canvas.width, canvas.height)

        await page.render({
          canvas,
          canvasContext: context,
          viewport
        }).promise

        // Convert page into optimized JPEG
        const imageBlob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            blob => {
              if (blob) resolve(blob)
              else reject(new Error('Could not optimize PDF page.'))
            },
            'image/jpeg',
            settings.jpeg
          )
        })

        const imageBytes = await imageBlob.arrayBuffer()

        // Insert the optimized image into the new PDF
        const embeddedImage = await outputPDF.embedJpg(imageBytes)

        const pageWidth = viewport.width / settings.scale
        const pageHeight = viewport.height / settings.scale

        const newPage = outputPDF.addPage([
          pageWidth,
          pageHeight
        ])

        newPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight
        })

        // Update progress
        setProgress(Math.round((i / pdf.numPages) * 100))

        page.cleanup()
        canvas.width = 0
        canvas.height = 0
      }

      // Save compressed PDF
      const compressedBytes = await outputPDF.save({
        useObjectStreams: true
      })

      const compressedBlob = new Blob(
        [compressedBytes],
        { type: 'application/pdf' }
      )

      const compressedURL = URL.createObjectURL(compressedBlob)

      const difference = file.size - compressedBlob.size

      setResult({
        url: compressedURL,
        originalSize: file.size,
        compressedSize: compressedBlob.size,
        saved: difference,
        percentage: Math.round(
          (difference / file.size) * 100
        ),
        filename: file.name.replace(/\.pdf$/i, '') + '-compressed.pdf'
      })

    } catch (err) {
      console.error(err)
      setError(
        'Something went wrong while compressing this PDF. Try another file or a lower page count.'
      )
    } finally {
      if (pdf) {
        await pdf.destroy()
      }

      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-ivory">

      {/* HEADER */}
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">

          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
          >
            <ArrowLeft size={19} />
            Back to PAGES
          </button>

          <div className="flex items-center gap-2 font-extrabold text-xl">
            <FileArchive className="text-gold-deep" />
            PAGES<span className="text-gold-deep">.</span>
          </div>

        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-3xl px-6 py-14">

        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-tint-2">
            <FileArchive size={30} className="text-gold-deep" />
          </div>

          <p className="text-xs font-bold tracking-[0.2em] text-gold-deep">
            PAGES PDF TOOLS
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Compress PDF
          </h1>

          <p className="mx-auto mt-4 max-w-lg leading-7 text-muted">
            Reduce your PDF file size while choosing the quality
            that works best for your documents.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-white p-6 shadow-[0_15px_45px_rgba(16,24,39,0.05)] sm:p-9">

          {/* FILE UPLOAD */}
          {!file && (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                selectFile(e.dataTransfer.files[0])
              }}
              className="cursor-pointer rounded-2xl border-2 border-dashed border-line-strong bg-paper px-5 py-14 text-center transition hover:border-gold"
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-tint">
                <UploadCloud size={32} className="text-gold-deep" />
              </div>

              <h3 className="text-lg font-bold">
                Drop your PDF here
              </h3>

              <p className="mt-2 text-sm text-subtle">
                Or click to browse your device
              </p>

              <span className="mt-6 inline-block rounded-full bg-ink px-7 py-3 text-sm font-semibold text-white">
                Select PDF
              </span>

              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={e => selectFile(e.target.files[0])}
              />
            </div>
          )}

          {/* SELECTED FILE */}
          {file && (
            <div className="rounded-2xl border border-gold-tint-2 bg-paper p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-xl bg-gold-tint-2 p-3">
                    <FileText className="text-gold-deep" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-bold">{file.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {formatSize(file.size)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={reset}
                  disabled={processing}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                  aria-label="Remove PDF"
                >
                  <Trash2 size={19} />
                </button>
              </div>
            </div>
          )}

          {/* QUALITY OPTIONS */}
          {file && !result && (
            <div className="mt-8">
              <h3 className="mb-4 font-bold">
                Choose compression quality
              </h3>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    id: 'low',
                    name: 'Smallest size',
                    description: 'More compression'
                  },
                  {
                    id: 'medium',
                    name: 'Recommended',
                    description: 'Balanced quality'
                  },
                  {
                    id: 'high',
                    name: 'Best quality',
                    description: 'Less compression'
                  }
                ].map(option => (
                  <button
                    key={option.id}
                    disabled={processing}
                    onClick={() => setQuality(option.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      quality === option.id
                        ? 'border-gold bg-gold-tint'
                        : 'border-line hover:border-gold'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-bold">
                        {option.name}
                      </span>

                      {quality === option.id && (
                        <CheckCircle2
                          size={17}
                          className="text-gold-deep"
                        />
                      )}
                    </div>

                    <p className="text-xs text-muted">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PROGRESS */}
          {processing && (
            <div className="mt-8">
              <div className="mb-3 flex justify-between text-sm">
                <span className="font-semibold">
                  Compressing your document...
                </span>
                <span className="font-bold text-gold-deep">
                  {progress}%
                </span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-line-soft">
                <div
                  className="h-full rounded-full bg-gold transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* ERROR */}
          {error && (
            <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* COMPRESS BUTTON */}
          {file && !result && (
            <button
              onClick={compressPDF}
              disabled={processing}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-4 font-bold text-white transition hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing ? (
                <>
                  <LoaderCircle className="animate-spin" size={19} />
                  Processing...
                </>
              ) : (
                <>
                  <FileArchive size={19} />
                  Compress PDF
                </>
              )}
            </button>
          )}

          {/* RESULT */}
          {result && (
            <div className="mt-8">
              <div className="rounded-2xl bg-gold-tint p-6 text-center">
                <CheckCircle2
                  size={38}
                  className="mx-auto text-gold-deep"
                />

                <h3 className="mt-3 text-xl font-bold">
                  Compression complete!
                </h3>

                {result.saved > 0 ? (
                  <>
                    <p className="mt-2 text-sm text-gold-deep">
                      Reduced by {result.percentage}%
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Saved {formatSize(result.saved)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    This document did not become smaller. The compressed version
                    is still available below.
                  </p>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-line p-4">
                  <p className="text-xs text-subtle">Original size</p>
                  <p className="mt-2 font-bold">
                    {formatSize(result.originalSize)}
                  </p>
                </div>

                <div className="rounded-xl border border-line p-4">
                  <p className="text-xs text-subtle">New size</p>
                  <p className="mt-2 font-bold text-gold-deep">
                    {formatSize(result.compressedSize)}
                  </p>
                </div>
              </div>

              <a
                href={result.url}
                download={result.filename}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-4 font-bold text-white transition hover:bg-ink-hover"
              >
                <Download size={19} />
                Download compressed PDF
              </a>

              <button
                onClick={reset}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-line px-6 py-4 font-semibold hover:bg-paper"
              >
                <RefreshCw size={17} />
                Compress another PDF
              </button>
            </div>
          )}

        </div>

        <div className="mt-7 flex items-start justify-center gap-3 text-center text-xs leading-6 text-on-dark-subtle">
          <ShieldCheck size={17} className="mt-1 shrink-0 text-gold-deep" />
          <p>
            Your documents are processed locally in your browser.
            They are not uploaded to a server. This compressor converts
            pages into images, so selectable text and interactive elements
            are not retained.
          </p>
        </div>

      </main>
    </div>
  )
}


