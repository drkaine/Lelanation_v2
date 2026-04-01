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

  clone.querySelectorAll('style').forEach(styleEl => {
    let css = styleEl.textContent || ''
    if (!css.includes('border-image-source') || css.includes('border-image-source: none')) return
    const srcMatch = css.match(/border-image-source:\s*([^;]+);/)
    if (!srcMatch) return
    const gradient = srcMatch[1].trim()
    if (gradient === 'none' || gradient === 'initial') return

    const colorMatch = gradient.match(/(?:rgba?\([^)]+\))|(?:#[0-9a-fA-F]{3,8})/)
    const solidColor = colorMatch ? colorMatch[0] : 'rgba(192, 168, 130, 0.8)'

    css = css.replace(/border-image-source:\s*[^;]+;/g, 'border-image-source: none;')
    css = css.replace(/border-image-slice:\s*[^;]+;/g, '')
    css = css.replace(/border-image-width:\s*[^;]+;/g, '')
    css = css.replace(/border-image-outset:\s*[^;]+;/g, '')
    css = css.replace(/border-image-repeat:\s*[^;]+;/g, '')
    css = css.replace(/\}/, `border-color: ${solidColor} !important; }`)
    styleEl.textContent = css
  })

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
