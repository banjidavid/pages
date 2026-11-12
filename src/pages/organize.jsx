
import { useRef, useState } from 'react'
import { PDFDocument, degrees } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  ArrowLeft,
  Upload,
  RotateCw,
  Trash2,
  Download,
  FileText,
  GripVertical,
  LoaderCircle,
  X,
  MoveUp,
  MoveDown
} from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

export default function Organize({ onBack }) {
  const [file, setFile] = useState(null)
  const [pages, setPages] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [draggedId, setDraggedId] = useState(null)

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
    setSelected([])
    setPages([])
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
          ? { ...page, rotation: (page.rotation + 90) % 360 }
          : page
      )
    )
  }

  function toggleSelected(id) {
    setSelected(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    )
  }

  function deleteSelected() {
    if (selected.length === 0) return

    setPages(current =>
      current.filter(page => !selected.includes(page.id))
    )
    setSelected([])
    setSuccess('Selected pages removed.')
  }

  function movePage(id, direction) {
    setPages(current => {
      const index = current.findIndex(page => page.id === id)
      const newIndex = index + direction

      if (newIndex < 0 || newIndex >= current.length) return current

      const updated = [...current]
      const [page] = updated.splice(index, 1)
      updated.splice(newIndex, 0, page)

      return updated
    })
  }

  function handleDrop(targetId) {
    if (!draggedId || draggedId === targetId) return

    setPages(current => {
      const updated = [...current]
      const fromIndex = updated.findIndex(p => p.id === draggedId)
      const toIndex = updated.findIndex(p => p.id === targetId)

      if (fromIndex === -1 || toIndex === -1) return current

      const [movedPage] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, movedPage)

      return updated
    })

    setDraggedId(null)
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

      copiedPages.forEach((page, index) => {
        const originalRotation = page.getRotation().angle
        const addedRotation = pages[index].rotation

        page.setRotation(
          degrees((originalRotation + addedRotation) % 360)
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
      link.download = `organized-${file.name}`
      link.click()

      URL.revokeObjectURL(url)
      setSuccess('Your organized PDF has been downloaded.')
    } catch (err) {
      console.error(err)
      setError('Something went wrong while creating your PDF.')
    } finally {
      setProcessing(false)
    }
  }

  function resetOrganizer() {
    setFile(null)
    setPages([])
    setSelected([])
    setError('')
    setSuccess('')
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className="min-h-screen bg-ivory text-ink">
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

          <span className="text-sm text-muted">PDF Organizer</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-gold-deep">
            Organize your document
          </p>
          <h2 className="text-3xl font-bold">PDF Organizer</h2>
          <p className="mt-2 text-muted">
            Rearrange, rotate and remove pages from your PDF.
          </p>
        </div>

        {!file && (
          <button
            onClick={() => fileInput.current?.click()}
            className="flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gold bg-white p-8 text-center transition hover:bg-champagne/20"
          >
            <div className="mb-4 rounded-full bg-champagne p-5">
              <Upload size={30} className="text-ink" />
            </div>
            <h3 className="text-lg font-semibold">Upload a PDF</h3>
            <p className="mt-2 text-sm text-muted">
              Click here to select the PDF you want to organize.
            </p>
            <span className="mt-5 rounded-lg bg-ink px-6 py-3 text-sm font-semibold text-white">
              Choose PDF
            </span>
          </button>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => loadPDF(e.target.files?.[0])}
        />

        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-xl bg-white p-10">
            <LoaderCircle className="animate-spin" />
            <span>Loading your PDF pages...</span>
          </div>
        )}

        {file && !loading && (
          <>
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
                onClick={resetOrganizer}
                className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm hover:bg-paper"
              >
                <X size={16} />
                Change PDF
              </button>
            </div>

            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Drag pages to rearrange them. Use the controls to rotate or remove pages.
              </p>

              <button
                onClick={deleteSelected}
                disabled={selected.length === 0}
                className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={16} />
                Delete selected ({selected.length})
              </button>
            </div>

            {pages.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {pages.map((page, index) => (
                  <div
                    key={page.id}
                    draggable
                    onDragStart={() => setDraggedId(page.id)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDrop(page.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={`overflow-hidden rounded-xl border bg-white p-3 shadow-sm transition ${
                      selected.includes(page.id)
                        ? 'border-gold ring-2 ring-champagne'
                        : 'border-line'
                    } ${
                      draggedId === page.id ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={selected.includes(page.id)}
                          onChange={() => toggleSelected(page.id)}
                          className="h-4 w-4 accent-gold"
                        />
                        Page {index + 1}
                      </label>

                      <GripVertical
                        size={18}
                        className="cursor-grab text-subtle"
                      />
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

                    <div className="mt-3 flex items-center justify-between gap-1">
                      <button
                        onClick={() => movePage(page.id, -1)}
                        disabled={index === 0}
                        title="Move up"
                        className="rounded-md p-2 text-muted hover:bg-line-soft disabled:opacity-30"
                      >
                        <MoveUp size={17} />
                      </button>

                      <button
                        onClick={() => rotatePage(page.id)}
                        title="Rotate page"
                        className="rounded-md p-2 text-muted hover:bg-line-soft"
                      >
                        <RotateCw size={17} />
                      </button>

                      <button
                        onClick={() => movePage(page.id, 1)}
                        disabled={index === pages.length - 1}
                        title="Move down"
                        className="rounded-md p-2 text-muted hover:bg-line-soft disabled:opacity-30"
                      >
                        <MoveDown size={17} />
                      </button>

                      <button
                        onClick={() => {
                          setPages(current =>
                            current.filter(p => p.id !== page.id)
                          )
                          setSelected(current =>
                            current.filter(id => id !== page.id)
                          )
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
                <p className="font-semibold">No pages left.</p>
                <p className="mt-2 text-sm text-muted">
                  Upload another PDF to get started.
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5">
              <div>
                <p className="font-semibold">
                  {pages.length} pages ready
                </p>
                <p className="text-sm text-muted">
                  Your original PDF will not be changed.
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
