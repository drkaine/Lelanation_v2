declare module 'dom-to-image-more' {
  export interface CorsImgOptions {
    url: string
    method?: string
    headers?: Record<string, string>
    data?: unknown
  }

  export interface Options {
    filter?: (node: Node) => boolean
    onclone?: (clone: HTMLElement) => void | Promise<void>
    adjustClonedNode?: (originalNode: Node, clonedNode: Node, afterChildren: boolean) => Node | void
    filterStyles?: (node: HTMLElement, propertyName: string) => boolean
    bgcolor?: string
    width?: number
    height?: number
    scale?: number
    style?: Record<string, string>
    quality?: number
    imagePlaceholder?: string
    cacheBust?: boolean
    corsImg?: CorsImgOptions
  }

  export function toPng(node: HTMLElement, options?: Options): Promise<string>
  export function toJpeg(node: HTMLElement, options?: Options): Promise<string>
  export function toBlob(node: HTMLElement, options?: Options): Promise<Blob>
  export function toPixelData(node: HTMLElement, options?: Options): Promise<Uint8Array>
  export function toSvg(node: HTMLElement, options?: Options): Promise<string>
  export function toCanvas(node: HTMLElement, options?: Options): Promise<HTMLCanvasElement>
}
