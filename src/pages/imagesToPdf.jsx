import { useEffect, useRef, useState } from 'react'
import {
  ImagePlus,
  Download,
  ArrowUp,
  ArrowDown,
  X,
  UploadCloud
} from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import ConverterShell, {
  Toggle,
  Segmented,
  ResultBar,
  ActionButton
} from '../components/ConverterShell.jsx'
import { friendlyError, downloadBlob, formatSize, tick } from '../utils/pdf.js'

const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792]
}
const MAX_SIDE = 4000 // pixels; larger images are scaled down
const MAX_FIT_PAGE = 1200 // points; longest side of a "same as image" page

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not process an image.'))),
      type,
      quality
    )
  )
}

// Draws the image on a canvas first so phone photos keep the right rotation.
async function prepareImage(file) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(
      `"${file.name}" could not be read. Use JPG, PNG, WebP, GIF or BMP images.`
    )
  }

  const k = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * k)
  const height = Math.round(bitmap.height * k)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  const isJpeg = file.type === 'image/jpeg'
  if (isJpeg) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await canvasToBlob(
    canvas,
    isJpeg ? 'image/jpeg' : 'image/png',
    0.92
  )
  canvas.width = 0
  canvas.height = 0

  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    isJpeg,
    width,
    height
  }
}

export default function ImagesToPdf({ onBack }) {
  const [items, setItems] = useState([])
  const [pageSize, setPageSize] = useState('a4')
  const [margins, setMargins] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [dragging, setDragging] = useState(false)
  const input = useRef(null)
  const itemsRef = useRef([])

  useEffect(() => {
    itemsRef.current = items
  }, [items])
  useEffect(
    () => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)),
    []
  )

  function addFiles(fileList) {
    const files = Array.from(fileList || [])
    const images = files.filter((f) => f.type.startsWith('image/'))
    setResult(null)
    setError(
      images.length < files.length
        ? 'Some files were skipped because they are not images.'
        : ''
    )
    setItems((prev) => [
      ...prev,
      ...images.map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file)
      }))
    ])
  }

  function remove(id) {
    setResult(null)
    setItems((prev) => {
      const target = prev.find((i) => i.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((i) => i.id !== id)
    })
  }

  function move(index, direction) {
    setResult(null)
    setItems((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function convert() {
    setError('')
    setResult(null)
    setBusy(true)
    setProgress(0)

    try {
      const pdf = await PDFDocument.create()

      for (let i = 0; i < items.length; i++) {
        const data = await prepareImage(items[i].file)
        const image = data.isJpeg
          ? await pdf.embedJpg(data.bytes)
          : await pdf.embedPng(data.bytes)

        if (pageSize === 'fit') {
          const k = Math.min(
            1,
            MAX_FIT_PAGE / Math.max(data.width, data.height)
          )
          const w = data.width * k
          const h = data.height * k
          const page = pdf.addPage([w, h])
          page.drawImage(image, { x: 0, y: 0, width: w, height: h })
        } else {
          const [short, long] = PAGE_SIZES[pageSize]
          const landscape = data.width > data.height
          const W = landscape ? long : short
          const H = landscape ? short : long
          const m = margins ? 36 : 0
          const k = Math.min((W - 2 * m) / data.width, (H - 2 * m) / data.height)
          const w = data.width * k
          const h = data.height * k
          const page = pdf.addPage([W, H])
          page.drawImage(image, {
            x: (W - w) / 2,
            y: (H - h) / 2,
            width: w,
            height: h
          })
        }

        setProgress(Math.round(((i + 1) / items.length) * 100))
        await tick()
      }

      const bytes = await pdf.save()
      setResult({
        blob: new Blob([bytes], { type: 'application/pdf' }),
        name: 'images.pdf',
        pages: items.length
      })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const inputArea = (
    <div>
      <div
        onClick={() => input.current.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        className={`cursor-pointer rounded-2xl border-2 border-dashed text-center transition ${
          items.length ? 'p-5' : 'p-10'
        } ${
          dragging
            ? 'border-gold bg-gold-tint'
            : 'border-line-strong bg-paper hover:border-gold'
        }`}
      >
        {!items.length && (
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-tint">
            <UploadCloud size={32} className="text-gold-deep" />
          </div>
        )}
        <h3 className="font-bold">
          {items.length ? 'Add more images' : 'Drop your images here'}
        </h3>
        <p className="mt-1 text-sm text-subtle">
          JPG, PNG, WebP, GIF or BMP · click to browse
        </p>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="mt-5 divide-y divide-line-soft rounded-xl border border-line">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3 p-3">
              <span className="w-5 text-center text-xs font-bold text-subtle">
                {index + 1}
              </span>
              <img
                src={item.url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg border border-line bg-white object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.file.name}</p>
                <p className="text-xs text-subtle">{formatSize(item.file.size)}</p>
              </div>
              <button
                onClick={() => move(index, -1)}
                disabled={busy || index === 0}
                aria-label="Move up"
                className="rounded-lg p-2 hover:bg-ivory disabled:opacity-30"
              >
                <ArrowUp size={16} />
              </button>
              <button
                onClick={() => move(index, 1)}
                disabled={busy || index === items.length - 1}
                aria-label="Move down"
                className="rounded-lg p-2 hover:bg-ivory disabled:opacity-30"
              >
                <ArrowDown size={16} />
              </button>
              <button
                onClick={() => remove(item.id)}
                disabled={busy}
                aria-label="Remove image"
                className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-30"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <ConverterShell
      title="Images → PDF"
      description="Combine your images into a single PDF, one image per page."
      icon={ImagePlus}
      color="peach"
      onBack={onBack}
      inputArea={inputArea}
      ready={items.length > 0}
      busy={busy}
      progress={progress}
      error={error}
      actionLabel={`Create PDF from ${items.length} ${items.length === 1 ? 'image' : 'images'}`}
      onConvert={convert}
      options={
        <>
          <Segmented
            label="Page size"
            value={pageSize}
            onChange={setPageSize}
            disabled={busy}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'US Letter' },
              { value: 'fit', label: 'Same as image' }
            ]}
          />
          {pageSize !== 'fit' && (
            <Toggle
              label="Add margins"
              hint="Leaves a small white border around each image."
              checked={margins}
              onChange={setMargins}
              disabled={busy}
            />
          )}
          <p className="text-xs leading-5 text-subtle">
            Pages are portrait or landscape to match each image. Very large
            images are scaled down to keep the PDF a reasonable size.
          </p>
        </>
      }
    >
      {result && (
        <ResultBar
          title="Your PDF is ready"
          detail={`${result.pages} ${result.pages === 1 ? 'page' : 'pages'} · ${formatSize(result.blob.size)}`}
          actions={
            <ActionButton onClick={() => downloadBlob(result.blob, result.name)}>
              <Download size={16} /> Download PDF
            </ActionButton>
          }
        />
      )}
    </ConverterShell>
  )
}
