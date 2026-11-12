
import { useEffect, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import {
  ArrowLeft,
  Files,
  UploadCloud,
  FileText,
  Trash2,
  Download,
  ArrowUp,
  ArrowDown,
  GripVertical,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck
} from 'lucide-react'
import { formatSize } from '../utils/pdf.js'

export default function Merge({ onBack }) {
  const [documents, setDocuments] = useState([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [draggedId, setDraggedId] = useState(null)

  const inputRef = useRef(null)

  // Release the previous download URL when the result changes
  useEffect(() => {
    return () => {
      if (result?.url) {
        URL.revokeObjectURL(result.url)
      }
    }
  }, [result])

  const totalPages = documents.reduce(
    (total, document) => total + document.pages,
    0
  )

  const totalSize = documents.reduce(
    (total, document) => total + document.file.size,
    0
  )

  async function addFiles(selectedFiles) {
    const pdfFiles = Array.from(selectedFiles).filter(file =>
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')
    )

    if (pdfFiles.length === 0) {
      setError('Please select valid PDF documents.')
      return
    }

    setLoadingFiles(true)
    setError('')
    setResult(null)

    const newDocuments = []

    for (const file of pdfFiles) {
      try {
        const bytes = await file.arrayBuffer()
        const pdf = await PDFDocument.load(bytes)

        newDocuments.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          pages: pdf.getPageCount()
        })
      } catch (err) {
        console.error(err)
        setError(
          `${file.name} could not be opened. It may be damaged or password-protected.`
        )
      }
    }

    setDocuments(previous => [...previous, ...newDocuments])
    setLoadingFiles(false)

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  function removeDocument(id) {
    setDocuments(previous =>
      previous.filter(document => document.id !== id)
    )
    setResult(null)
  }

  function moveDocument(index, direction) {
    const newIndex = index + direction

    if (newIndex < 0 || newIndex >= documents.length) return

    const updated = [...documents]

    const temporary = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temporary

    setDocuments(updated)
    setResult(null)
  }

  function reorderDocument(targetId) {
    if (!draggedId || draggedId === targetId) return

    const updated = [...documents]

    const fromIndex = updated.findIndex(
      document => document.id === draggedId
    )

    const toIndex = updated.findIndex(
      document => document.id === targetId
    )

    if (fromIndex === -1 || toIndex === -1) return

    const [movedDocument] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, movedDocument)

    setDocuments(updated)
    setDraggedId(null)
    setResult(null)
  }

  async function mergePDFs() {
    if (documents.length < 2) {
      setError('Please select at least two PDF documents.')
      return
    }

    setProcessing(true)
    setProgress(0)
    setError('')
    setResult(null)

    try {
      const mergedPDF = await PDFDocument.create()

      for (let i = 0; i < documents.length; i++) {
        const document = documents[i]

        const bytes = await document.file.arrayBuffer()

        const sourcePDF = await PDFDocument.load(bytes)

        const copiedPages = await mergedPDF.copyPages(
          sourcePDF,
          sourcePDF.getPageIndices()
        )

        copiedPages.forEach(page => {
          mergedPDF.addPage(page)
        })

        setProgress(
          Math.round(((i + 1) / documents.length) * 100)
        )
      }

      const mergedBytes = await mergedPDF.save()

      const mergedBlob = new Blob(
        [mergedBytes],
        { type: 'application/pdf' }
      )

      const downloadURL = URL.createObjectURL(mergedBlob)

      setResult({
        url: downloadURL,
        size: mergedBlob.size,
        pages: mergedPDF.getPageCount(),
        filename: 'pages-merged-document.pdf'
      })

    } catch (err) {
      console.error(err)
      setError(
        'Unable to merge these documents. Check that all PDFs are valid and not password-protected.'
      )
    } finally {
      setProcessing(false)
    }
  }

  function reset() {
    setDocuments([])
    setResult(null)
    setError('')
    setProgress(0)

    if (inputRef.current) {
      inputRef.current.value = ''
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

          <div className="flex items-center gap-2 text-xl font-extrabold">
            <Files className="text-gold-deep" />
            PAGES<span className="text-gold-deep">.</span>
          </div>

        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-3xl px-6 py-14">

        <div className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-tint-2">
            <Files size={30} className="text-gold-deep" />
          </div>

          <p className="text-xs font-bold tracking-[0.2em] text-gold-deep">
            PAGES PDF TOOLS
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Merge PDF
          </h1>

          <p className="mx-auto mt-4 max-w-lg leading-7 text-muted">
            Combine multiple PDF documents into one organized file.
            Arrange your documents in the order you want.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-white p-6 shadow-[0_15px_45px_rgba(16,24,39,0.05)] sm:p-9">

          {/* UPLOAD AREA */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setDragging(false)
              }
            }}
            onDrop={e => {
              e.preventDefault()
              setDragging(false)
              addFiles(e.dataTransfer.files)
            }}
            className={`cursor-pointer rounded-2xl border-2 border-dashed px-5 py-10 text-center transition ${
              dragging
                ? 'border-gold bg-gold-tint'
                : 'border-line-strong bg-paper hover:border-gold'
            }`}
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-tint">
              <UploadCloud size={32} className="text-gold-deep" />
            </div>

            <h3 className="text-lg font-bold">
              Drop your PDFs here
            </h3>

            <p className="mt-2 text-sm text-subtle">
              Select multiple documents at once
            </p>

            <span className="mt-6 inline-block rounded-full bg-ink px-7 py-3 text-sm font-semibold text-white">
              Add PDF files
            </span>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />
          </div>

          {/* LOADING FILES */}
          {loadingFiles && (
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gold-deep">
              <LoaderCircle size={18} className="animate-spin" />
              Reading your documents...
            </div>
          )}

          {/* DOCUMENT LIST */}
          {documents.length > 0 && (
            <div className="mt-8">

              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">Your documents</h3>
                  <p className="mt-1 text-xs text-subtle">
                    Drag or use the arrows to change order
                  </p>
                </div>

                <button
                  onClick={reset}
                  disabled={processing}
                  className="text-sm font-semibold text-red-500 hover:text-red-700"
                >
                  Clear all
                </button>
              </div>

              <div className="space-y-3">
                {documents.map((document, index) => (
                  <div
                    key={document.id}
                    draggable={!processing}
                    onDragStart={() => setDraggedId(document.id)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault()
                      reorderDocument(document.id)
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    className={`flex items-center gap-3 rounded-xl border p-4 transition ${
                      draggedId === document.id
                        ? 'border-gold bg-gold-tint'
                        : 'border-line bg-paper'
                    }`}
                  >
                    <GripVertical
                      size={19}
                      className="shrink-0 cursor-grab text-subtle"
                    />

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-tint">
                      <FileText size={21} className="text-gold-deep" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {document.file.name}
                      </p>

                      <p className="mt-1 text-xs text-subtle">
                        {document.pages} pages · {formatSize(document.file.size)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => moveDocument(index, -1)}
                        disabled={index === 0 || processing}
                        className="rounded-lg p-2 text-muted hover:bg-gold-tint disabled:opacity-30"
                        aria-label="Move document up"
                      >
                        <ArrowUp size={17} />
                      </button>

                      <button
                        onClick={() => moveDocument(index, 1)}
                        disabled={index === documents.length - 1 || processing}
                        className="rounded-lg p-2 text-muted hover:bg-gold-tint disabled:opacity-30"
                        aria-label="Move document down"
                      >
                        <ArrowDown size={17} />
                      </button>

                      <button
                        onClick={() => removeDocument(document.id)}
                        disabled={processing}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                        aria-label="Remove document"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* DOCUMENT SUMMARY */}
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-ivory p-3 text-center">
                  <p className="text-xl font-bold">{documents.length}</p>
                  <p className="mt-1 text-xs text-muted">Documents</p>
                </div>

                <div className="rounded-xl bg-ivory p-3 text-center">
                  <p className="text-xl font-bold">{totalPages}</p>
                  <p className="mt-1 text-xs text-muted">Total pages</p>
                </div>

                <div className="rounded-xl bg-ivory p-3 text-center">
                  <p className="text-xl font-bold">
                    {formatSize(totalSize)}
                  </p>
                  <p className="mt-1 text-xs text-muted">Total size</p>
                </div>
              </div>

            </div>
          )}

          {/* PROGRESS */}
          {processing && (
            <div className="mt-8">
              <div className="mb-3 flex justify-between text-sm">
                <span className="font-semibold">Merging documents...</span>
                <span className="font-bold text-gold-deep">{progress}%</span>
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

          {/* MERGE BUTTON */}
          {documents.length > 0 && !result && (
            <button
              onClick={mergePDFs}
              disabled={processing || loadingFiles || documents.length < 2}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-4 font-bold text-white transition hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processing ? (
                <>
                  <LoaderCircle size={19} className="animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <Files size={19} />
                  Merge PDF documents
                </>
              )}
            </button>
          )}

          {documents.length === 1 && (
            <p className="mt-3 text-center text-xs text-subtle">
              Add at least one more PDF to enable merging.
            </p>
          )}

          {/* SUCCESS RESULT */}
          {result && (
            <div className="mt-8">

              <div className="rounded-2xl bg-gold-tint p-6 text-center">
                <CheckCircle2
                  size={38}
                  className="mx-auto text-gold-deep"
                />

                <h3 className="mt-3 text-xl font-bold">
                  Documents merged successfully!
                </h3>

                <p className="mt-2 text-sm text-gold-deep">
                  Your new document contains {result.pages} pages.
                </p>
              </div>

              <div className="mt-5 rounded-xl border border-line p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">
                    Merged document
                  </span>
                  <span className="font-bold">
                    {formatSize(result.size)}
                  </span>
                </div>
              </div>

              <a
                href={result.url}
                download={result.filename}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-4 font-bold text-white transition hover:bg-ink-hover"
              >
                <Download size={19} />
                Download merged PDF
              </a>

              <button
                onClick={reset}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-line px-6 py-4 font-semibold hover:bg-paper"
              >
                <RefreshCw size={17} />
                Merge more documents
              </button>

            </div>
          )}

        </div>

        <div className="mt-7 flex items-start justify-center gap-3 text-center text-xs leading-6 text-on-dark-subtle">
          <ShieldCheck size={17} className="mt-1 shrink-0 text-gold-deep" />
          <p>
            Your documents are processed locally in your browser.
            They are not uploaded to a server. Original PDF pages are
            copied into the merged document without converting them
            into images.
          </p>
        </div>

      </main>
    </div>
  )
}


