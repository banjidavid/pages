/*
  Password-protects a PDF in the browser.

  Implements the standard PDF security handler, version 4 / revision 4
  (AES-128, "AESV2"), which every PDF reader supports. It works on top of
  plain `pdf-lib`, so no extra encryption package is needed.
*/
import {
  PDFDocument,
  PDFDict,
  PDFArray,
  PDFString,
  PDFHexString,
  PDFStream,
  PDFRawStream
} from 'pdf-lib'

/* ---------- small crypto helpers ---------- */

// PDF's fixed password padding string (ISO 32000-1, algorithm 2)
const PAD = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56,
  0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a
])

const MD5_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
  9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
  16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
  15, 21
]
const MD5_K = Array.from({ length: 64 }, (_, i) =>
  Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0
)

// WebCrypto has no MD5, and the PDF format needs it.
export function md5(bytes) {
  const total = Math.ceil((bytes.length + 9) / 64) * 64
  const buf = new Uint8Array(total)
  buf.set(bytes)
  buf[bytes.length] = 0x80
  const view = new DataView(buf.buffer)
  view.setUint32(total - 8, (bytes.length * 8) >>> 0, true)
  view.setUint32(total - 4, Math.floor((bytes.length * 8) / 4294967296), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476
  const M = new Uint32Array(16)

  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(off + i * 4, true)

    let A = a0
    let B = b0
    let C = c0
    let D = d0

    for (let i = 0; i < 64; i++) {
      let F
      let g
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + MD5_K[i] + M[g]) >>> 0
      A = D
      D = C
      C = B
      const s = MD5_SHIFTS[i]
      B = (B + (((F << s) | (F >>> (32 - s))) >>> 0)) >>> 0
    }

    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }

  const out = new Uint8Array(16)
  const outView = new DataView(out.buffer)
  outView.setUint32(0, a0, true)
  outView.setUint32(4, b0, true)
  outView.setUint32(8, c0, true)
  outView.setUint32(12, d0, true)
  return out
}

export function rc4(key, data) {
  const s = new Uint8Array(256)
  for (let i = 0; i < 256; i++) s[i] = i
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  const out = new Uint8Array(data.length)
  let a = 0
  let b = 0
  for (let k = 0; k < data.length; k++) {
    a = (a + 1) & 255
    b = (b + s[a]) & 255
    ;[s[a], s[b]] = [s[b], s[a]]
    out[k] = data[k] ^ s[(s[a] + s[b]) & 255]
  }
  return out
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function randomBytes(length) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

// Passwords are limited to 32 bytes of Latin-1 characters in this format version
function padPassword(password) {
  const bytes = new Uint8Array(Math.min(password.length, 32))
  for (let i = 0; i < bytes.length; i++) {
    const code = password.charCodeAt(i)
    if (code > 255) {
      throw new Error(
        'The password can only use standard keyboard letters, numbers and symbols.'
      )
    }
    bytes[i] = code
  }
  return concat(bytes, PAD).slice(0, 32)
}

/* ---------- key and password values (ISO 32000-1, algorithms 2, 3, 5) ---------- */

function xorKey(key, n) {
  return key.map((b) => b ^ n)
}

function computeOwnerValue(ownerPassword, userPassword) {
  let hash = md5(padPassword(ownerPassword))
  for (let i = 0; i < 50; i++) hash = md5(hash)
  const key = hash.slice(0, 16)

  let result = rc4(key, padPassword(userPassword))
  for (let i = 1; i <= 19; i++) result = rc4(xorKey(key, i), result)
  return result
}

function computeEncryptionKey(userPassword, O, P, id) {
  const pBytes = new Uint8Array(4)
  new DataView(pBytes.buffer).setInt32(0, P, true)

  let hash = md5(concat(padPassword(userPassword), O, pBytes, id))
  for (let i = 0; i < 50; i++) hash = md5(hash.slice(0, 16))
  return hash.slice(0, 16)
}

function computeUserValue(key, id) {
  let result = rc4(key, md5(concat(PAD, id)))
  for (let i = 1; i <= 19; i++) result = rc4(xorKey(key, i), result)
  return concat(result, new Uint8Array(16)) // 16 arbitrary padding bytes
}

/* ---------- per-object AES encryption ---------- */

function objectKey(fileKey, objectNumber, generation) {
  return md5(
    concat(
      fileKey,
      new Uint8Array([
        objectNumber & 255,
        (objectNumber >> 8) & 255,
        (objectNumber >> 16) & 255,
        generation & 255,
        (generation >> 8) & 255
      ]),
      new Uint8Array([0x73, 0x41, 0x6c, 0x54]) // "sAlT" marks AES
    )
  ).slice(0, 16)
}

async function aesEncrypt(rawKey, data) {
  const iv = randomBytes(16)
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-CBC', false, [
    'encrypt'
  ])
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, data) // PKCS#7 padded
  )
  return concat(iv, encrypted)
}

// Encrypts every string inside a value (recursively). Returns the replacement.
async function encryptValue(value, key) {
  if (value instanceof PDFString || value instanceof PDFHexString) {
    return PDFHexString.of(toHex(await aesEncrypt(key, value.asBytes())))
  }

  if (value instanceof PDFDict) {
    for (const [name, child] of value.entries()) {
      value.set(name, await encryptValue(child, key))
    }
    return value
  }

  if (value instanceof PDFArray) {
    for (let i = 0; i < value.size(); i++) {
      value.set(i, await encryptValue(value.get(i), key))
    }
    return value
  }

  return value
}

/* ---------- public API ---------- */

// Permission flags (ISO 32000-1, table 22)
function permissionValue({ print, copy, edit }) {
  let flags = 0
  if (print) flags |= 4 | 2048 // print + high-quality print
  if (edit) flags |= 8 | 32 | 256 | 1024 // modify, annotate, fill forms, assemble
  if (copy) flags |= 16
  flags |= 512 // accessibility (screen readers) is always allowed
  return (0xfffff0c0 | flags) | 0 // reserved bits set, as a signed 32-bit integer
}

export async function encryptPdf(
  bytes,
  { userPassword, ownerPassword, permissions = {} }
) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const context = doc.context

  const id = randomBytes(16)
  const P = permissionValue({
    print: permissions.print !== false,
    copy: permissions.copy !== false,
    edit: permissions.edit !== false
  })

  const O = computeOwnerValue(ownerPassword, userPassword)
  const fileKey = computeEncryptionKey(userPassword, O, P, id)
  const U = computeUserValue(fileKey, id)

  // Encrypt every string and stream in the file.
  for (const [ref, object] of [...context.enumerateIndirectObjects()]) {
    const key = objectKey(fileKey, ref.objectNumber, ref.generationNumber)

    if (object instanceof PDFStream) {
      await encryptValue(object.dict, key)
      const encrypted = await aesEncrypt(key, object.getContents())
      context.assign(ref, PDFRawStream.of(object.dict, encrypted))
    } else {
      context.assign(ref, await encryptValue(object, key))
    }
  }

  // Add the encryption dictionary (its own strings stay unencrypted).
  const encryptRef = context.register(
    context.obj({
      Filter: 'Standard',
      V: 4,
      R: 4,
      Length: 128,
      P,
      O: PDFHexString.of(toHex(O)),
      U: PDFHexString.of(toHex(U)),
      CF: {
        StdCF: { AuthEvent: 'DocOpen', CFM: 'AESV2', Length: 16 }
      },
      StmF: 'StdCF',
      StrF: 'StdCF'
    })
  )

  context.trailerInfo.Encrypt = encryptRef
  context.trailerInfo.ID = context.obj([
    PDFHexString.of(toHex(id)),
    PDFHexString.of(toHex(id))
  ])

  // Object streams would hide objects from the encryption pass above.
  return doc.save({ useObjectStreams: false })
}

export function randomPassword(length = 24) {
  return Array.from(randomBytes(length), (b) => (b % 36).toString(36)).join('')
}
