import domtoimage from 'dom-to-image-more'

const CAPTURE_STYLE_ID = '__build-capture-override'

const CAPTURE_CSS = `
[data-capture] .champion-portrait-container::before {
  border-image: none !important;
  border-color: var(--card-border-color, rgba(192, 168, 130, 0.8)) !important;
}
`

export function enableCaptureMode(wrapper: HTMLElement): void {
  wrapper.setAttribute('data-capture', '')

  if (!document.getElementById(CAPTURE_STYLE_ID)) {
    const style = document.createElement('style')
    style.id = CAPTURE_STYLE_ID
    style.textContent = CAPTURE_CSS
    document.head.appendChild(style)
  }

  const _forceRecalc = wrapper.offsetHeight
}

export function disableCaptureMode(wrapper: HTMLElement): void {
  wrapper.removeAttribute('data-capture')
}

export async function fixCloneForCapture(clone: HTMLElement): Promise<void> {
  clone.querySelectorAll('.flip-container').forEach(fc => fc.classList.remove('flipped'))

  const allEls = [clone, ...Array.from(clone.querySelectorAll('*'))] as HTMLElement[]

  for (const el of allEls) {
    if (el.style.backgroundAttachment === 'fixed') {
      el.style.backgroundAttachment = 'scroll'
    }
  }

  const maskTasks: Promise<void>[] = []
  const urlRegex = /url\((['"]?)(.*?)\1\)/
  for (const el of allEls) {
    const maskValue = el.style.maskImage || el.style.webkitMaskImage
    if (!maskValue || maskValue.includes('data:')) continue
    const match = maskValue.match(urlRegex)
    const maskUrl = match?.[2]
    if (!maskUrl) continue

    maskTasks.push(
      fetch(maskUrl)
        .then(r => (r.ok ? r.blob() : null))
        .then(
          blob =>
            new Promise<void>(resolve => {
              if (!blob) {
                resolve()
                return
              }
              const reader = new FileReader()
              reader.onloadend = () => {
                const dataUrl = String(reader.result || '')
                if (dataUrl) {
                  el.style.maskImage = `url("${dataUrl}")`
                  el.style.webkitMaskImage = `url("${dataUrl}")`
                }
                resolve()
              }
              reader.readAsDataURL(blob)
            })
        )
        .catch(() => {})
    )
  }
  await Promise.all(maskTasks)
}

export async function captureBuildCardBlob(buildCardWrapper: HTMLElement): Promise<Blob | null> {
  try {
    enableCaptureMode(buildCardWrapper)
    await new Promise(resolve => setTimeout(resolve, 100))

    const rect = buildCardWrapper.getBoundingClientRect()
    const width = Math.max(1, Math.ceil(rect.width) + 2)
    const height = Math.max(1, Math.ceil(rect.height) + 2)
    const computed = getComputedStyle(buildCardWrapper)
    const strongGradient =
      computed.getPropertyValue('--card-border-gradient-strong').trim() ||
      'linear-gradient(130deg, #2aa4d8 0%, #4f9aa8 45%, #9ca84f 100%)'
    const softGradient =
      computed.getPropertyValue('--card-border-gradient-soft').trim() ||
      'linear-gradient(130deg, rgba(42, 164, 216, 0.7) 0%, rgba(79, 154, 168, 0.72) 45%, rgba(156, 168, 79, 0.82) 100%)'
    const baseBlue = computed.getPropertyValue('--color-blue-500').trim() || '#091428'

    const blob = await domtoimage.toBlob(buildCardWrapper, {
      bgcolor: '#091428',
      quality: 1.0,
      cacheBust: true,
      width,
      height,
      style: {
        transform: 'none',
        transformOrigin: 'top left',
      },
      filter: (node: Node) => {
        if (node instanceof HTMLElement && node.classList.contains('build-card-back')) {
          return false
        }
        return true
      },
      onclone: async (clone: HTMLElement) => {
        await fixCloneForCapture(clone)

        // Force border rendering inline in clone to avoid foreignObject white-border fallback.
        const setGradientBorder = (el: HTMLElement, gradient: string) => {
          el.style.borderImage = 'none'
          el.style.borderColor = 'transparent'
          el.style.backgroundImage = `linear-gradient(${baseBlue}, ${baseBlue}), ${gradient}`
          el.style.backgroundOrigin = 'padding-box, border-box'
          el.style.backgroundClip = 'padding-box, border-box'
          el.style.backgroundRepeat = 'no-repeat, no-repeat'
          el.style.backgroundSize = '100% 100%, 100% 100%'
        }

        clone
          .querySelectorAll('.build-card')
          .forEach(node => setGradientBorder(node as HTMLElement, strongGradient))
        clone
          .querySelectorAll('.summoner-spell-icon, .shard-icon-small, .shard-icon-strip')
          .forEach(node => setGradientBorder(node as HTMLElement, strongGradient))
        clone
          .querySelectorAll('.item-icon, .boots-slot--filled')
          .forEach(node => setGradientBorder(node as HTMLElement, softGradient))
      },
    })

    return blob
  } catch {
    return null
  } finally {
    disableCaptureMode(buildCardWrapper)
  }
}
