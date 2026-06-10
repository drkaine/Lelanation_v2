/**
 * Data Dragon omits tooltip text for some items (e.g. World Atlas / 3865).
 * Keep in sync with backend/src/utils/itemDescriptionFallbacks.ts
 */
const ITEM_DESCRIPTION_FALLBACKS: Record<string, Record<string, string>> = {
  '3865': {
    fr_FR:
      "<mainText><stats><attention>+30</attention> PV<br><attention>+25%</attention> de régénération de base des PV<br><attention>+25%</attention> de régénération de base du mana<br><attention>+3</attention> PO toutes les 10 sec</stats><br><br><passive>Quête de support</passive><br>Gagnez <keywordMajor>400</keywordMajor> PO grâce à cet objet pour le transformer en <rarityGeneric>Boussole runique</rarityGeneric> et obtenir la possibilité de porter des balises.<br><br><passive>Richesses partagées</passive> (20 sec, max 3 charges)<br>Quand vous êtes à proximité d'un champion allié, infligez des dégâts à un champion ennemi ou tuez des sbires pour gagner des PO.</mainText>",
    en_US:
      '<mainText><stats><attention>30</attention> Health<br><attention>25%</attention> Base Health Regen<br><attention>25%</attention> Base Mana Regen<br><attention>3</attention> Gold Per 10 Seconds</stats><br><br><passive>Support Quest</passive><br>Earn <keywordMajor>400</keywordMajor> gold from this item to transform it into <rarityGeneric>Runic Compass</rarityGeneric> and gain the ability to hold wards.<br><br><passive>Shared Riches</passive> (20s, max 3 charges)<br>While near an ally champion, damage enemy champions or kill minions to gain gold.</mainText>',
  },
}

const ITEM_PLAINTEXT_FALLBACKS: Record<string, Record<string, string>> = {
  '3865': {
    fr_FR: 'Objet de départ du support.',
    en_US: 'Support starter item.',
  },
}

function normalizeItemLocale(language: string): 'fr_FR' | 'en_US' {
  return language.startsWith('fr') ? 'fr_FR' : 'en_US'
}

export function resolveItemDescription(
  item: { id?: string; description?: string } | null | undefined,
  language: string = 'en_US'
): string {
  if (!item) return ''
  const existing = typeof item.description === 'string' ? item.description.trim() : ''
  if (existing) return existing
  if (!item.id) return ''
  const locale = normalizeItemLocale(language)
  return ITEM_DESCRIPTION_FALLBACKS[item.id]?.[locale] ?? ''
}

export function resolveItemPlaintext(
  item: { id?: string; plaintext?: string } | null | undefined,
  language: string = 'en_US'
): string {
  if (!item) return ''
  const existing = typeof item.plaintext === 'string' ? item.plaintext.trim() : ''
  if (existing) return existing
  if (!item.id) return ''
  const locale = normalizeItemLocale(language)
  return ITEM_PLAINTEXT_FALLBACKS[item.id]?.[locale] ?? ''
}
