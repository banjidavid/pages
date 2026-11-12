import { useState } from 'react'
import { Lock, Download } from 'lucide-react'
// pdf-lib itself cannot encrypt, so this page uses a fork that adds encrypt().
import { PDFDocument } from 'pdf-lib-plus-encrypt'
import ConverterShell, {
  Toggle,
  ResultBar,
  ActionButton
} from '../components/ConverterShell.jsx'
import { usePdfFile } from '../utils/usePdfFile.js'
import {
  readBytes,
  friendlyError,
  downloadBlob,
  baseName,
  formatSize
} from '../utils/pdf.js'

// The owner password controls the permissions. Nobody needs to know it,
// so it is random and never shown.
function randomPassword(length = 24) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('')
}

const inputClass =
  'w-full rounded-xl border border-line-strong bg-paper px-4 py-3 text-sm outline-none transition focus:border-gold'

export default function Protect({ onBack }) {
  const pdfFile = usePdfFile()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [allowPrint, setAllowPrint] = useState(true)
  const [allowCopy, setAllowCopy] = useState(true)
  const [allowEdit, setAllowEdit] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)

  async function convert() {
    pdfFile.setError('')
    setResult(null)

    if (password.length < 4) {
      pdfFile.setError('Use a password with at least 4 characters.')
      return
    }
    if (password !== confirm) {
      pdfFile.setError('The two passwords do not match.')
      return
    }

    setBusy(true)
    setProgress(30)

    try {
      const doc = await PDFDocument.load(await readBytes(pdfFile.file))
      setProgress(60)

      await doc.encrypt({
        userPassword: password,
        ownerPassword: randomPassword(),
        permissions: {
          printing: allowPrint ? 'highResolution' : false,
          copying: allowCopy,
          modifying: allowEdit,
          annotating: allowEdit,
          fillingForms: allowEdit,
          contentAccessibility: true,
          documentAssembly: allowEdit
        }
      })

      const bytes = await doc.save()
      setProgress(100)
      setResult({
        blob: new Blob([bytes], { type: 'application/pdf' }),
        name: `${baseName(pdfFile.file)}-protected.pdf`
      })
    } catch (err) {
      pdfFile.setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConverterShell
      title="Protect PDF"
      description="Lock your PDF with a password so only people who know it can open it."
      icon={Lock}
      color="mint"
      onBack={onBack}
      file={pdfFile.file}
      pages={pdfFile.pages}
      onFile={(f) => {
        setResult(null)
        pdfFile.select(f)
      }}
      onClear={() => {
        setResult(null)
        setPassword('')
        setConfirm('')
        pdfFile.clear()
      }}
      busy={busy}
      progress={progress}
      error={pdfFile.error}
      actionLabel="Protect PDF"
      onConvert={convert}
      options={
        <>
          <div>
            <label htmlFor="pw" className="mb-2 block text-sm font-semibold">
              Password
            </label>
            <input
              id="pw"
              type={show ? 'text' : 'password'}
              value={password}
              disabled={busy}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="pw2" className="mb-2 block text-sm font-semibold">
              Confirm password
            </label>
            <input
              id="pw2"
              type={show ? 'text' : 'password'}
              value={confirm}
              disabled={busy}
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>

          <Toggle label="Show passwords" checked={show} onChange={setShow} disabled={busy} />

          <div className="space-y-4 rounded-xl border border-line bg-paper p-4">
            <p className="text-sm font-semibold">What people can do after opening it</p>
            <Toggle label="Print" checked={allowPrint} onChange={setAllowPrint} disabled={busy} />
            <Toggle
              label="Copy text"
              checked={allowCopy}
              onChange={setAllowCopy}
              disabled={busy}
            />
            <Toggle
              label="Edit and annotate"
              checked={allowEdit}
              onChange={setAllowEdit}
              disabled={busy}
            />
            <p className="text-xs leading-5 text-subtle">
              Some PDF apps ignore these limits. The password itself is what
              keeps the file private.
            </p>
          </div>

          <p className="text-xs leading-5 text-subtle">
            Keep your password safe. It cannot be recovered, and the PDF cannot
            be opened without it.
          </p>
        </>
      }
    >
      {result && (
        <ResultBar
          title="Your PDF is protected"
          detail={`${result.name} · ${formatSize(result.blob.size)}`}
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
