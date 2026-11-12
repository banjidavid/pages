
import { useRef, useState } from 'react'
import { PDFDocument, degrees, StandardFonts, rgb } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  ArrowLeft,
  Upload,
  Download,
  FileText,
  Trash2,
  RotateCw,
  LoaderCircle,
  X,
  Type,
  Check,
  Plus
} from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

export default function Edit({ onBack }) {
  const [file, setFile] = useState(null)
  const [pages, setPages] = useState([])
  const [selectedPage, setSelectedPage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [text, setText] = useState('')
  const [fontSize, setFontSize] = useState(18)
  const [position, setPosition] = useState('middle')
  const [textItems, setTextItems] = useState([])

  const fileInput = useRef(null)

  async function loadPDF(uploadedFile) {
    if (
      !uploadedFile ||
      (
        uploadedFile.type !== 'application/pdf' &&
        !uploadedFile.name.toLowerCase().endsWith('.pdf')
      )
    ) {
      setError('Please select a valid PDF file.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    setPages([])
    setTextItems([])
    setSelectedPage(null)
    setFile(uploadedFile)

    try {
      const buffer = await uploadedFile.arrayBuffer()

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer)
      })

      const pdf = await loadingTask.promise
      const loadedPages = []

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 0.35 })

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')

        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({
          canvasContext: context,
          viewport
        }).promise

        loadedPages.push({
          id: i,
          originalIndex: i - 1,
          thumbnail: canvas.toDataURL('image/jpeg', 0.8),
          rotation: 0
        })
      }

      setPages(loadedPages)
      setSelectedPage(loadedPages[0]?.id ?? null)

      await loadingTask.destroy()

    } catch (err) {
      console.error(err)
      setError('Could not open this PDF. Please try another file.')
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  function rotatePage(id) {
    setPages(current =>
      current.map(page =>
        page.id === id
          ? {
              ...page,
              rotation: (page.rotation + 90) % 360
            }
          : page
      )
    )
  }

  function deletePage(id) {
    setPages(current =>
      current.filter(page => page.id !== id)
    )

    setTextItems(current =>
      current.filter(item => item.pageId !== id)
    )

    if (selectedPage === id) {
      const remaining = pages.filter(page => page.id !== id)
      setSelectedPage(remaining[0]?.id ?? null)
    }

    setSuccess('Page removed.')
  }

  function addText() {
    if (!text.trim()) {
      setError('Please enter some text first.')
      return
    }

    if (selectedPage === null) {
      setError('Please select a page.')
      return
    }

    setTextItems(current => [
      ...current,
      {
        id: Date.now() + Math.random(),
        pageId: selectedPage,
        text: text.trim(),
        fontSize: Math.max(8, Math.min(72, Number(fontSize) || 18)),
        position
      }
    ])

    setText('')
    setError('')
    setSuccess(`Text added to page ${selectedPage}.`)
  }

  function removeText(id) {
    setTextItems(current =>
      current.filter(item => item.id !== id)
    )
  }

  async function downloadPDF() {
    if (!file || pages.length === 0) return

    setProcessing(true)
    setError('')
    setSuccess('')

    try {
      const buffer = await file.arrayBuffer()
      const originalPDF = await PDFDocument.load(buffer)
      const newPDF = await PDFDocument.create()

      const copiedPages = await newPDF.copyPages(
        originalPDF,
        pages.map(page => page.originalIndex)
      )

      const font = await newPDF.embedFont(StandardFonts.Helvetica)

      copiedPages.forEach((page, index) => {
        const currentPage = pages[index]
        const pageWidth = page.getWidth()
        const pageHeight = page.getHeight()

        const pageTexts = textItems.filter(
          item => item.pageId === currentPage.id
        )

        pageTexts.forEach(item => {
          const textWidth = font.widthOfTextAtSize(
            item.text,
            item.fontSize
          )

          const x = Math.max(10, (pageWidth - textWidth) / 2)

          let y

          if (item.position === 'top') {
            y = pageHeight - item.fontSize - 40
          } else if (item.position === 'bottom') {
            y = 40
          } else {
            y = (pageHeight - item.fontSize) / 2
          }

          page.drawText(item.text, {
            x,
            y,
            size: item.fontSize,
            font,
            color: rgb(0, 0, 0)
          })
        })

        const originalRotation = page.getRotation().angle

        page.setRotation(
          degrees((originalRotation + currentPage.rotation) % 360)
        )

        newPDF.addPage(page)
      })

      const pdfBytes = await newPDF.save()

      const blob = new Blob([pdfBytes], {
        type: 'application/pdf'
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `edited-${file.name}`
      link.click()

      setTimeout(() => URL.revokeObjectURL(url), 1000)

      setSuccess('Your edited PDF has been downloaded.')

    } catch (err) {
      console.error(err)
      setError('Something went wrong while editing your PDF.')
    } finally {
      setProcessing(false)
    }
  }

  function resetEditor() {
    setFile(null)
    setPages([])
    setSelectedPage(null)
    setTextItems([])
    setText('')
    setError('')
    setSuccess('')

    if (fileInput.current) {
      fileInput.current.value = ''
    }
  }

  return (
    <div className="min-h-screen bg-ivory text-ink">

      {/* HEADER */}
      <header className="border-b border-line bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium text-muted hover:text-ink"
          >
            <ArrowLeft size={18} />
            Back to PAGES
          </button>

          <h1 className="text-xl font-bold tracking-wide">PAGES</h1>

          <span className="text-sm text-muted">PDF Editor</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">

        {/* INTRO */}
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-gold-deep">
            Edit your document
          </p>

          <h2 className="text-3xl font-bold">PDF Editor</h2>

          <p className="mt-2 text-muted">
            Remove pages, rotate documents and add text to specific pages.
          </p>
        </div>

        {/* UPLOAD */}
        {!file && (
          <button
            onClick={() => fileInput.current?.click()}
            className="flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gold bg-white p-8 text-center transition hover:bg-champagne/20"
          >
            <div className="mb-4 rounded-full bg-champagne p-5">
              <Upload size={30} />
            </div>

            <h3 className="text-lg font-semibold">Upload a PDF</h3>

            <p className="mt-2 text-sm text-muted">
              Select the PDF document you want to edit.
            </p>

            <span className="mt-5 rounded-lg bg-ink px-6 py-3 text-sm font-semibold text-white">
              Choose PDF
            </span>
          </button>
        )}

        <input
          ref={fileInput}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={e => loadPDF(e.target.files?.[0])}
        />

        {/* LOADING */}
        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-xl bg-white p-10">
            <LoaderCircle className="animate-spin" />
            Loading your PDF...
          </div>
        )}

        {file && !loading && (
          <>
            {/* FILE INFORMATION */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-champagne p-3">
                  <FileText size={23} />
                </div>

                <div>
                  <p className="font-semibold">{file.name}</p>
                  <p className="text-sm text-muted">
                    {pages.length} pages remaining
                  </p>
                </div>
              </div>

              <button
                onClick={resetEditor}
                className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm hover:bg-paper"
              >
                <X size={16} />
                Change PDF
              </button>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_340px]">

              {/* PAGE PREVIEWS */}
              <section>
                <div className="mb-5">
                  <h3 className="text-lg font-bold">Your PDF pages</h3>
                  <p className="mt-1 text-sm text-muted">
                    Select a page to edit it.
                  </p>
                </div>

                {pages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {pages.map((page, index) => (
                      <div
                        key={page.id}
                        onClick={() => setSelectedPage(page.id)}
                        className={`cursor-pointer overflow-hidden rounded-xl border bg-white p-3 shadow-sm transition ${
                          selectedPage === page.id
                            ? 'border-gold ring-2 ring-champagne'
                            : 'border-line hover:border-gold'
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            Page {index + 1}
                          </span>

                          {selectedPage === page.id && (
                            <Check size={17} className="text-gold-deep" />
                          )}
                        </div>

                        <div className="flex h-48 items-center justify-center overflow-hidden rounded-lg bg-line-soft p-2">
                          <img
                            src={page.thumbnail}
                            alt={`Page ${index + 1}`}
                            className="max-h-full max-w-full object-contain shadow-sm"
                            style={{
                              transform: `rotate(${page.rotation}deg)`
                            }}
                          />
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              rotatePage(page.id)
                            }}
                            title="Rotate page"
                            className="rounded-md p-2 text-muted hover:bg-line-soft"
                          >
                            <RotateCw size={17} />
                          </button>

                          <button
                            onClick={e => {
                              e.stopPropagation()
                              deletePage(page.id)
                            }}
                            title="Delete page"
                            className="rounded-md p-2 text-red-500 hover:bg-red-50"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-white p-10 text-center">
                    <p className="font-semibold">No pages remaining.</p>
                    <p className="mt-2 text-sm text-muted">
                      Upload another PDF to continue.
                    </p>
                  </div>
                )}
              </section>

              {/* TEXT EDITOR */}
              <aside className="h-fit rounded-2xl border border-line bg-white p-6">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-champagne p-3">
                    <Type size={22} />
                  </div>

                  <div>
                    <h3 className="font-bold">Add text</h3>
                    <p className="text-xs text-muted">
                      Insert text into your PDF.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">

                  <div>
                    <label className="mb-2 block text-sm font-semibold">
                      Select page
                    </label>

                    <select
                      value={selectedPage ?? ''}
                      onChange={e => setSelectedPage(Number(e.target.value))}
                      className="w-full rounded-lg border border-line bg-white px-3 py-3 text-sm outline-none focus:border-gold"
                    >
                      {pages.map((page, index) => (
                        <option key={page.id} value={page.id}>
                          Page {index + 1}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold">
                      Text content
                    </label>

                    <textarea
                      value={text}
                      onChange={e => setText(e.target.value)}
                      placeholder="Enter the text you want to add..."
                      rows={4}
                      className="w-full resize-y rounded-lg border border-line px-3 py-3 text-sm outline-none focus:border-gold"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold">
                      Font size
                    </label>

                    <input
                      type="number"
                      min="8"
                      max="72"
                      value={fontSize}
                      onChange={e => setFontSize(e.target.value)}
                      className="w-full rounded-lg border border-line px-3 py-3 text-sm outline-none focus:border-gold"
                    />
                    <p className="mt-1 text-xs text-subtle">
                      Choose between 8 and 72.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold">
                      Text position
                    </label>

                    <select
                      value={position}
                      onChange={e => setPosition(e.target.value)}
                      className="w-full rounded-lg border border-line bg-white px-3 py-3 text-sm outline-none focus:border-gold"
                    >
                      <option value="top">Top</option>
                      <option value="middle">Middle</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </div>

                  <button
                    onClick={addText}
                    disabled={pages.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-5 py-3 font-semibold text-white hover:bg-ink-hover disabled:opacity-40"
                  >
                    <Plus size={18} />
                    Add text to page
                  </button>
                </div>

                {/* ADDED TEXT */}
                <div className="mt-7 border-t border-line-soft pt-5">
                  <h4 className="mb-3 font-semibold">
                    Added text ({textItems.length})
                  </h4>

                  {textItems.length === 0 ? (
                    <p className="text-sm text-subtle">
                      No text added yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {textItems.map(item => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-lg bg-ivory p-3"
                        >
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium">
                              {item.text}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              Page {item.pageId} · {item.position}
                            </p>
                          </div>

                          <button
                            onClick={() => removeText(item.id)}
                            title="Remove text"
                            className="shrink-0 text-red-500 hover:text-red-700"
                          >
                            <X size={17} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            </div>

            {/* DOWNLOAD */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5">
              <div>
                <p className="font-semibold">
                  {pages.length} pages ready
                </p>
                <p className="text-sm text-muted">
                  {textItems.length} text additions
                </p>
              </div>

              <button
                onClick={downloadPDF}
                disabled={processing || pages.length === 0}
                className="flex items-center gap-2 rounded-lg bg-ink px-6 py-3 font-semibold text-white hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <Download size={18} />
                )}

                {processing ? 'Creating PDF...' : 'Download PDF'}
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-600">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-5 rounded-lg bg-green-50 p-4 text-sm text-green-700">
            {success}
          </p>
        )}

        <p className="mt-8 text-center text-xs text-muted">
          Your PDF is processed locally in your browser. Your files are not uploaded to a server.
        </p>
      </main>
    </div>
  )
}
