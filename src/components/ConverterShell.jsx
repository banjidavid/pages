import { useRef, useState } from 'react'
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { formatSize } from '../utils/pdf.js'

/* ---------- small building blocks used by the tool pages ---------- */

export function Toggle({ label, hint, checked, onChange, disabled }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-gold-deep"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-subtle">{hint}</span>}
      </span>
    </label>
  )
}

export function Segmented({ label, value, onChange, options, disabled }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div className="inline-flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              value === o.value
                ? 'border-ink bg-ink text-white'
                : 'border-line-strong bg-white hover:border-gold'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ActionButton({ children, onClick, variant = 'dark' }) {
  const styles =
    variant === 'dark'
      ? 'bg-ink text-white hover:bg-ink-hover'
      : 'border border-line-strong bg-white hover:bg-paper'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${styles}`}
    >
      {children}
    </button>
  )
}

export function ResultBar({ title, detail, actions }) {
  return (
    <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-gold-line bg-gold-wash p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="shrink-0 text-gold-deep" />
        <div>
          <p className="font-bold">{title}</p>
          {detail && <p className="text-sm text-muted">{detail}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">{actions}</div>
    </div>
  )
}

/* ---------- the page layout ---------- */

export default function ConverterShell({
  title,
  description,
  icon: Icon,
  color,
  onBack,
  file,
  pages,
  inputArea,
  ready,
  onFile,
  onClear,
  busy,
  progress,
  error,
  options,
  actionLabel,
  onConvert,
  children
}) {
  const input = useRef(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div className="min-h-screen bg-ivory text-ink">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <button
          onClick={onBack}
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-ink"
        >
          <ArrowLeft size={16} /> Back to tools
        </button>

        <div className="mb-8 flex items-center gap-4">
          <div
            className={`icon-box ${color} flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl`}
          >
            <Icon size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-muted">{description}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-white p-7 shadow-[0_20px_60px_rgba(16,24,39,0.07)] sm:p-9">
          {inputArea ? (
            inputArea
          ) : !file ? (
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
                onFile(e.dataTransfer.files[0])
              }}
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition ${
                dragging
                  ? 'border-gold bg-gold-tint'
                  : 'border-line-strong bg-paper hover:border-gold'
              }`}
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-tint">
                <UploadCloud size={32} className="text-gold-deep" />
              </div>
              <h3 className="font-bold">Drop your PDF here</h3>
              <p className="mt-2 text-sm text-subtle">
                or click to browse your files
              </p>
              <input
                ref={input}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  onFile(e.target.files[0])
                  e.target.value = ''
                }}
              />
              <div className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">
                Choose PDF
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-gold-line bg-gold-wash p-4">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="shrink-0 text-gold-deep" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{file.name}</p>
                  <p className="text-xs text-muted">
                    {formatSize(file.size)}
                    {pages > 0 && ` · ${pages} ${pages === 1 ? 'page' : 'pages'}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClear}
                disabled={busy}
                aria-label="Remove file"
                className="disabled:opacity-40"
              >
                <Trash2 size={18} className="text-red-500" />
              </button>
            </div>
          )}

          {error && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {(inputArea ? ready : file) && (
            <>
              {options && <div className="mt-7 space-y-5">{options}</div>}

              <button
                onClick={onConvert}
                disabled={busy}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 font-semibold text-white transition hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {busy ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Working… {progress}%
                  </>
                ) : (
                  actionLabel
                )}
              </button>

              {busy && (
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-line-soft">
                  <div
                    className="h-full bg-gold transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </>
          )}

          {children}
        </div>

        <p className="mt-6 text-center text-xs text-subtle">
          Your files are processed in your browser and never uploaded.
        </p>
      </div>
    </div>
  )
}
