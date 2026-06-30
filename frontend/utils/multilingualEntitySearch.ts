import { useMultilingualSearchStore } from '~/stores/MultilingualSearchStore'
import { searchAnyIncludes } from '~/utils/searchText'

export function matchesChampionSearch(
  query: string,
  opts: {
    id?: string | null
    key?: string | number | null
    championId?: string | number | null
    name?: string | null
  } = {}
): boolean {
  return useMultilingualSearchStore().championMatches(query, opts)
}

export function matchesItemSearch(
  query: string,
  opts: {
    id?: string | number | null
    name?: string | null
    colloq?: string | null
    plaintext?: string | null
  } = {}
): boolean {
  return useMultilingualSearchStore().itemMatches(query, opts)
}

export function matchesLocalizedTextSearch(
  query: string,
  parts: Array<string | null | undefined>
): boolean {
  return searchAnyIncludes(query, parts)
}
