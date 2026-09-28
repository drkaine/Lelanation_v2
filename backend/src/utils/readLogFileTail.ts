import { promises as fs } from 'node:fs'

/** Read the last `maxBytes` of a log file (for admin tail views). */
export async function readLogFileTail(filePath: string, maxBytes = 512 * 1024): Promise<string> {
  let fh: Awaited<ReturnType<typeof fs.open>> | undefined
  try {
    fh = await fs.open(filePath, 'r')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw e
  }
  try {
    const st = await fh.stat()
    if (st.size === 0) return ''
    const readLen = Math.min(Number(st.size), maxBytes)
    const pos = Number(st.size) - readLen
    const buf = Buffer.alloc(readLen)
    await fh.read(buf, 0, readLen, pos)
    let s = buf.toString('utf-8')
    if (pos > 0) {
      const firstNl = s.indexOf('\n')
      if (firstNl !== -1) s = s.slice(firstNl + 1)
    }
    return s
  } finally {
    await fh.close()
  }
}
