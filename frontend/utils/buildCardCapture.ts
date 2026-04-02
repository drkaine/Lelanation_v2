import html2canvas from 'html2canvas'

function extractUrl(value: string): string | null {
  const match = value.match(/url\((['"]?)(.*?)\1\)/)
  return match?.[2] ?? null
}

async function tintIconToDataUrl(url: string, color: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)

    const image = new Image()
    image.decoding = 'sync'
    image.src = objectUrl
    await new Promise<void>(resolve => {
      const done = () => resolve()
      image.addEventListener('load', done, { once: true })
      image.addEventListener('error', done, { once: true })
    })

    const w = image.naturalWidth || 32
    const h = image.naturalHeight || 32
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      URL.revokeObjectURL(objectUrl)
      return null
    }

    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(image, 0, 0, w, h)
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'

    const dataUrl = canvas.toDataURL('image/png')
    URL.revokeObjectURL(objectUrl)
    return dataUrl
  } catch {
    return null
  }
}

async function inlineMaskedIcons(root: HTMLElement): Promise<void> {
  const targets = Array.from(root.querySelectorAll('.secondary-path-icon-mask')) as HTMLElement[]
  const tasks = targets.map(async el => {
    const computed = getComputedStyle(el)
    const maskValue = computed.maskImage || computed.webkitMaskImage || ''
    const url = extractUrl(maskValue)
    if (!url) return

    try {
      const tintColor = computed.backgroundColor || '#2aa4d8'
      const dataUrl = await tintIconToDataUrl(url, tintColor)
      if (!dataUrl) return

      el.style.maskImage = 'none'
      el.style.webkitMaskImage = 'none'
      el.style.backgroundColor = 'transparent'
      el.style.backgroundImage = `url("${dataUrl}")`
      el.style.backgroundRepeat = 'no-repeat'
      el.style.backgroundPosition = 'center'
      el.style.backgroundSize = 'contain'
    } catch {
      // ignore icon inlining failures
    }
  })
  await Promise.all(tasks)
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'))
  const waits = images.map(
    img =>
      new Promise<void>(resolve => {
        const image = img as HTMLImageElement
        if (image.complete && image.naturalWidth > 0) {
          resolve()
          return
        }
        const done = () => resolve()
        image.addEventListener('load', done, { once: true })
        image.addEventListener('error', done, { once: true })
      })
  )
  await Promise.all(waits)
}

function applyCaptureStyleFixes(root: HTMLElement, sourceWrapper: HTMLElement): void {
  const sourceComputed = getComputedStyle(sourceWrapper)
  const borderColor =
    sourceComputed.getPropertyValue('--card-border-color').trim() || 'rgba(192, 168, 130, 0.9)'
  const softBorderColor =
    sourceComputed.getPropertyValue('--card-border-color-soft').trim() ||
    'rgba(192, 168, 130, 0.55)'

  root.querySelectorAll('.build-card').forEach(node => {
    const el = node as HTMLElement
    el.style.borderWidth = '3px'
    el.style.borderColor = borderColor
  })

  root.querySelectorAll('.shard-icon-strip, .shard-icon-small').forEach(node => {
    const el = node as HTMLElement
    el.style.borderWidth = '2px'
  })

  root.querySelectorAll('.item-icon').forEach(node => {
    const el = node as HTMLElement
    el.style.borderColor = softBorderColor
    el.style.boxShadow = `inset 0 0 0 1px ${softBorderColor}`
  })

  root.querySelectorAll('.skill-key, .level-badge, .max-badge').forEach(node => {
    const el = node as HTMLElement
    el.style.display = 'flex'
    el.style.alignItems = 'center'
    el.style.justifyContent = 'center'
    el.style.textAlign = 'center'
    el.style.lineHeight = '1'
  })

  root.querySelectorAll('.champion-portrait-container').forEach(node => {
    const el = node as HTMLElement
    el.style.boxShadow = 'none'
    el.style.outline = 'none'
  })
}

export async function captureBuildCardBlob(buildCardWrapper: HTMLElement): Promise<Blob | null> {
  const rect = buildCardWrapper.getBoundingClientRect()
  const width = Math.max(1, Math.ceil(rect.width) + 8)
  const height = Math.max(1, Math.ceil(rect.height) + 8)

  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = `${width}px`
  host.style.height = `${height}px`
  host.style.pointerEvents = 'none'
  host.style.opacity = '0'
  host.style.overflow = 'hidden'
  host.style.zIndex = '-1'

  const clone = buildCardWrapper.cloneNode(true) as HTMLElement
  clone.style.width = `${width}px`
  clone.style.height = `${height}px`
  clone.style.transform = 'none'
  clone.style.transformOrigin = 'top left'
  clone.querySelectorAll('.flip-container').forEach(fc => fc.classList.remove('flipped'))
  clone
    .querySelectorAll('.build-card-back')
    .forEach(el => ((el as HTMLElement).style.display = 'none'))

  host.appendChild(clone)
  document.body.appendChild(host)

  try {
    applyCaptureStyleFixes(clone, buildCardWrapper)
    await inlineMaskedIcons(clone)
    await waitForImages(clone)
    await new Promise(resolve => setTimeout(resolve, 40))

    const canvas = await html2canvas(clone, {
      backgroundColor: '#091428',
      width,
      height,
      scale: 1,
      useCORS: true,
      allowTaint: false,
      logging: false,
      foreignObjectRendering: false,
      removeContainer: true,
      imageTimeout: 0,
    })

    return await new Promise<Blob | null>(resolve =>
      canvas.toBlob(blob => resolve(blob), 'image/png', 1)
    )
  } catch {
    return null
  } finally {
    host.remove()
  }
}
