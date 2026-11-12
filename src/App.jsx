import { useEffect, useMemo, useState } from 'react'
import {
  Files,
  FileArchive,
  Layers,
  FilePenLine,
  Scissors,
  FileType,
  FileSpreadsheet,
  FileText,
  FileImage,
  ImagePlus,
  Lock,
  Wrench,
  ArrowRight,
  ShieldCheck,
  Zap,
  Download,
  LockKeyhole,
  Menu,
  X,
  CheckCircle2,
  Search
} from 'lucide-react'

import Compress from './pages/compress.jsx'
import Merge from './pages/merge.jsx'
import Organize from './pages/organize.jsx'
import Edit from './pages/edit.jsx'

import PdfToWord from './pages/pdfToWord.jsx'
import PdfToExcel from './pages/pdfToExcel.jsx'
import PdfToText from './pages/pdfToText.jsx'
import PdfToImages from './pages/pdfToImages.jsx'

import Split from './pages/split.jsx'
import ImagesToPdf from './pages/imagesToPdf.jsx'
import Protect from './pages/protect.jsx'
import Repair from './pages/repair.jsx'

// ---- All tools live here ----
const TOOLS = [
  {
    id: 'merge',
    category: 'Organize',
    title: 'Merge PDFs',
    description: 'Combine multiple PDFs into one file.',
    icon: Files,
    color: 'blue',
    page: Merge
  },
  {
    id: 'compress',
    category: 'Edit',
    title: 'Compress PDF',
    description: 'Reduce file size while preserving quality.',
    icon: FileArchive,
    color: 'mint',
    page: Compress
  },
  {
    id: 'organize',
    category: 'Organize',
    title: 'Organize PDF',
    description: 'Reorder, delete, or rotate pages.',
    icon: Layers,
    color: 'peach',
    page: Organize
  },
  {
    id: 'edit',
    category: 'Edit',
    title: 'Edit PDF',
    description: 'Add text, images, and page numbers.',
    icon: FilePenLine,
    color: 'purple',
    page: Edit
  },

  {
    id: 'split',
    category: 'Organize',
    title: 'Split PDF',
    description: 'Split a PDF into individual pages or ranges.',
    icon: Scissors,
    color: 'peach',
    page: Split
  },
  {
    id: 'pdf-to-word',
    category: 'Convert',
    title: 'PDF → Word',
    description: 'Convert a PDF to an editable Word document.',
    icon: FileType,
    color: 'blue',
    page: PdfToWord
  },
  {
    id: 'pdf-to-excel',
    category: 'Convert',
    title: 'PDF → Excel',
    description: 'Extract tables and data from a PDF when possible.',
    icon: FileSpreadsheet,
    color: 'mint',
    page: PdfToExcel
  },
  {
    id: 'pdf-to-text',
    category: 'Convert',
    title: 'PDF → Text',
    description: 'Extract plain text from a PDF.',
    icon: FileText,
    color: 'purple',
    page: PdfToText
  },
  {
    id: 'images-to-pdf',
    category: 'Convert',
    title: 'Images → PDF',
    description: 'Convert images into a single PDF.',
    icon: ImagePlus,
    color: 'peach',
    page: ImagesToPdf
  },
  {
    id: 'pdf-to-images',
    category: 'Convert',
    title: 'PDF → Images',
    description: 'Export PDF pages as PNG or JPG images.',
    icon: FileImage,
    color: 'blue',
    page: PdfToImages
  },
  {
    id: 'protect',
    category: 'Secure & fix',
    title: 'Protect PDF',
    description: 'Add password protection and encryption.',
    icon: Lock,
    color: 'mint',
    page: Protect
  },
  {
    id: 'repair',
    category: 'Secure & fix',
    title: 'Repair PDF',
    description: 'Attempt to fix damaged or corrupted PDFs.',
    icon: Wrench,
    color: 'purple',
    page: Repair
  }
]

const CATEGORIES = ['All', 'Organize', 'Edit', 'Convert', 'Secure & fix']
const POPULAR = ['merge', 'compress', 'split', 'pdf-to-word']

// Tiny hash router so the browser Back button works and tools are linkable
function readHash() {
  const id = window.location.hash.replace('#/', '')
  return TOOLS.some((t) => t.id === id) ? id : 'home'
}

function App() {
  const [activeTool, setActiveTool] = useState(readHash)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => {
    const sync = () => setActiveTool(readHash())
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])

  useEffect(() => {
    if (activeTool !== 'home') window.scrollTo(0, 0)
  }, [activeTool])

  const openTool = (id) => {
    window.history.pushState(null, '', `#/${id}`)
    setActiveTool(id)
  }

  const goHome = () => {
    window.history.pushState(null, '', window.location.pathname)
    setActiveTool('home')
  }

  const visibleTools = useMemo(() => {
    const q = query.trim().toLowerCase()
    return TOOLS.filter(
      (t) =>
        (category === 'All' || t.category === category) &&
        (!q || `${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q))
    )
  }, [query, category])

  function scrollToTools() {
    document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenu(false)
  }

  const current = TOOLS.find((t) => t.id === activeTool)
  if (current) {
    const Page = current.page
    return <Page onBack={goHome} />
  }

  return (
    <div className="min-h-screen bg-ivory text-ink">
      <a
        href="#tools"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to tools
      </a>

      {/* NAVIGATION */}
      <nav className="sticky top-0 z-30 border-b border-line bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <a href="#" className="flex items-center gap-3" aria-label="PAGES home">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink">
              <Files size={22} color="#E2C98F" />
            </div>
            <span className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
              PAGES<span className="text-gold">.</span>
            </span>
          </a>

          <div className="hidden items-center gap-9 md:flex">
            <a href="#" className="nav-link">Home</a>
            <button onClick={scrollToTools} className="nav-link">All tools</button>
            <a href="#about" className="nav-link">About</a>
          </div>

          <div className="hidden md:block">
            <button
              onClick={scrollToTools}
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-ink-hover"
            >
              Get started <ArrowRight size={15} className="ml-2 inline" />
            </button>
          </div>

          <button
            className="md:hidden"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label="Toggle navigation"
            aria-expanded={mobileMenu}
          >
            {mobileMenu ? <X size={25} /> : <Menu size={25} />}
          </button>
        </div>

        {mobileMenu && (
          <div className="flex flex-col gap-5 border-t border-line px-6 py-6 md:hidden">
            <a href="#" onClick={() => setMobileMenu(false)}>Home</a>
            <button onClick={scrollToTools} className="text-left">All tools</button>
            <a href="#about" onClick={() => setMobileMenu(false)}>About</a>
          </div>
        )}
      </nav>

      <main>
        {/* HERO */}
        <section className="hero-section mx-auto grid max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-2 lg:px-10 lg:py-28">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-gold-line bg-gold-tint px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-gold"></span>
              <span className="text-xs font-bold tracking-widest text-gold-deeper">
                YOUR DOCUMENT WORKSPACE
              </span>
            </div>

            <h1 className="max-w-xl text-5xl font-semibold leading-[1.1] sm:text-6xl lg:text-7xl">
              Your PDFs.
              <br />
              Your way.
              <br />
              <span className="italic text-gold-deep">Made simple.</span>
            </h1>

            <p className="mt-7 max-w-lg text-lg leading-8 text-muted">
              Merge, split, compress, convert and protect your documents in one
              elegant place. Everything happens in your browser, so your files stay yours.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <button
                onClick={scrollToTools}
                className="rounded-full bg-ink px-7 py-4 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-ink-hover"
              >
                Explore tools <ArrowRight size={17} className="ml-2 inline" />
              </button>
              <a
                href="#about"
                className="rounded-full border border-line-strong px-7 py-4 font-semibold transition hover:bg-white"
              >
                Learn more
              </a>
            </div>

            <div className="mt-12 flex flex-wrap gap-7">
              <div className="flex items-center gap-2 text-sm text-muted">
                <ShieldCheck size={19} className="text-gold-deep" />
                Private processing
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <Zap size={19} className="text-gold-deep" />
                No sign-up needed
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <Download size={19} className="text-gold-deep" />
                Free to use
              </div>
            </div>
          </div>

          {/* QUICK START CARD */}
          <div className="relative">
            <div className="absolute -right-5 -top-5 h-32 w-32 rounded-full bg-gold-tint-2 blur-2xl"></div>
            <div className="relative rounded-3xl border border-line bg-white p-7 shadow-[0_20px_60px_rgba(18,26,43,0.08)] sm:p-9">
              <h2 className="text-2xl font-semibold">What would you like to do?</h2>
              <p className="mt-1 text-sm text-subtle">Pick a task to get started.</p>

              <div className="mt-6 grid gap-3">
                {POPULAR.map((id) => {
                  const tool = TOOLS.find((t) => t.id === id)
                  const Icon = tool.icon
                  return (
                    <button
                      key={id}
                      onClick={() => openTool(id)}
                      className="group flex items-center gap-4 rounded-2xl border border-line bg-paper p-4 text-left transition hover:border-gold-line-strong hover:bg-white hover:shadow-md"
                    >
                      <div className={`icon-box ${tool.color} flex h-12 w-12 shrink-0 items-center justify-center rounded-xl`}>
                        <Icon size={22} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{tool.title}</p>
                        <p className="truncate text-sm text-muted">{tool.description}</p>
                      </div>
                      <ArrowRight size={18} className="shrink-0 text-subtle transition group-hover:translate-x-1 group-hover:text-gold-deep" />
                    </button>
                  )
                })}
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-subtle">
                <LockKeyhole size={14} />
                Your files stay on your device
              </div>
            </div>
          </div>
        </section>

        {/* TOOLS */}
        <section id="tools" className="scroll-mt-16 bg-white px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <span className="text-xs font-bold tracking-[0.2em] text-gold-deep">
                  WHAT YOU CAN DO
                </span>
                <h2 className="mt-4 text-4xl font-semibold sm:text-5xl">
                  Everything in one place.
                </h2>
                <p className="mt-4 max-w-lg leading-7 text-muted">
                  Powerful PDF tools designed to make working with documents easier.
                </p>
              </div>

              <label className="relative block w-full md:w-72">
                <span className="sr-only">Search tools</span>
                <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tools…"
                  className="w-full rounded-full border border-line-strong bg-paper py-3 pl-11 pr-4 text-sm outline-none transition focus:border-gold focus:bg-white"
                />
              </label>
            </div>

            <div className="mb-10 flex flex-wrap gap-2" role="group" aria-label="Filter tools by category">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    category === c
                      ? 'border-ink bg-ink text-white'
                      : 'border-line-strong bg-white text-muted hover:border-gold hover:text-ink'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {visibleTools.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-strong bg-paper p-12 text-center">
                <p className="font-bold">No tools match “{query}”</p>
                <p className="mt-2 text-sm text-muted">Try a different word, like “merge” or “word”.</p>
                <button
                  onClick={() => { setQuery(''); setCategory('All') }}
                  className="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-hover"
                >
                  Show all tools
                </button>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {visibleTools.map((tool) => {
                  const Icon = tool.icon
                  return (
                    <button
                      key={tool.id}
                      onClick={() => openTool(tool.id)}
                      className="group rounded-2xl border border-line bg-paper p-7 text-left transition duration-300 hover:-translate-y-1.5 hover:border-gold-line-strong hover:bg-white hover:shadow-xl"
                    >
                      <div className={`icon-box ${tool.color} mb-8 flex h-14 w-14 items-center justify-center rounded-2xl`}>
                        <Icon size={26} />
                      </div>
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-subtle">
                        {tool.category}
                      </p>
                      <h3 className="text-xl font-bold">{tool.title}</h3>
                      <p className="mt-3 min-h-[72px] text-sm leading-6 text-muted">
                        {tool.description}
                      </p>
                      <div className="mt-7 flex items-center justify-between">
                        <span className="text-sm font-bold">Open tool</span>
                        <ArrowRight size={19} className="transition group-hover:translate-x-1" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="scroll-mt-16 bg-ivory px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-14 md:grid-cols-2 md:items-center">
              <div>
                <span className="text-xs font-bold tracking-[0.2em] text-gold-deep">
                  DOCUMENTS MADE EASY
                </span>
                <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
                  Less time managing files. More time getting things done.
                </h2>
                <p className="mt-6 leading-8 text-muted">
                  PAGES brings essential PDF tools together in a simple workspace.
                  Choose a tool, add your file, and download the result. No
                  complicated software and no unnecessary steps.
                </p>
              </div>

              <div className="space-y-7">
                {[
                  ['Your privacy matters', 'Documents are processed locally in your browser and never uploaded.'],
                  ['Easy to use', 'A straightforward experience without a learning curve.'],
                  ['All in one place', 'Every essential PDF tool, one workspace.']
                ].map(([title, description]) => (
                  <div key={title} className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-tint-2">
                      <CheckCircle2 size={22} className="text-gold-deep" />
                    </div>
                    <div>
                      <h3 className="font-bold">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-ink px-6 py-12 text-white lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-8 border-b border-white/10 pb-10 sm:flex-row">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-champagne">
                  <Files size={20} className="text-ink" />
                </div>
                <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
                  PAGES<span className="text-champagne">.</span>
                </span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-6 text-on-dark-muted">
                A simpler way to manage your PDF documents.
              </p>
            </div>

            <div className="flex flex-col gap-3 text-sm text-on-dark-muted">
              <span className="font-bold text-white">Explore</span>
              <a href="#" className="hover:text-white">Home</a>
              <a href="#tools" className="hover:text-white">Our tools</a>
              <a href="#about" className="hover:text-white">About PAGES</a>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 pt-7 text-xs text-on-dark-subtle sm:flex-row">
            <p>© {new Date().getFullYear()} PAGES. All rights reserved.</p>
            <p>Made for simpler document management.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
