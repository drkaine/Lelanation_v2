import { computed, type Ref } from 'vue'

/** Injecte un ou plusieurs blocs JSON-LD dans <head>. */
export function useJsonLdHead(
  key: string,
  document: Ref<Record<string, unknown> | null> | (() => Record<string, unknown> | null)
) {
  useHead({
    script: computed(() => {
      const value = typeof document === 'function' ? document() : document.value
      if (!value) return []
      return [
        {
          type: 'application/ld+json',
          key: `jsonld-${key}`,
          children: JSON.stringify(value),
        },
      ]
    }),
  })
}
