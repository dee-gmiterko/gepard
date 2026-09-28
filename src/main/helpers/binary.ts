// git treats content as binary when a NUL byte appears in the first 8000 bytes.
export function looksBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000)
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true
  }
  return false
}
