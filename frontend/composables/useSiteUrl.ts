import { resolveSiteUrl } from '~/utils/siteUrl'

export function useSiteUrl(): string {
  const config = useRuntimeConfig()
  return resolveSiteUrl(config.public.siteUrl as string | undefined)
}
