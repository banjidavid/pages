import { useState } from 'react'
import { loadPdf, friendlyError, isPdf } from './pdf.js'

// Handles picking a PDF, validating it and reading its page count.
// lenient: accept PDFs that pdf.js cannot open (used by Repair)
export function usePdfFile({ lenient = false } = {}) {
  const [file, setFile] = useState(null)
  const [pages, setPages] = useState(0)
  const [error, setError] = useState('')

  async function select(selected) {
    if (!selected) return
    setError('')

    if (!isPdf(selected)) {
      setError('Please select a PDF file.')
      return
    }

    try {
      const pdf = await loadPdf(selected)
      setPages(pdf.numPages)
      setFile(selected)
      pdf.destroy()
    } catch (err) {
      if (lenient && err?.name !== 'PasswordException') {
        setPages(0)
        setFile(selected)
        return
      }
      setError(friendlyError(err))
    }
  }

  function clear() {
    setFile(null)
    setPages(0)
    setError('')
  }

  return { file, pages, error, setError, select, clear }
}
