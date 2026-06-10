/**
 * Data Dragon omits tooltip text for some items (e.g. World Atlas / 3865).
 * Fallback copy matches in-game support starter wording (FR / EN).
 */
const ITEM_DESCRIPTION_FALLBACKS: Record<string, Record<string, string>> = {
  '3865': {
    fr_FR:
      '<mainText><stats><attention>+30</attention> PV<br><attention>+25%</attention> de régénération de base des PV<br><attention>+25%</attention> de régénération de base du mana<br><attention>+3</attention> PO toutes les 10 sec</stats><br><br><passive>Quête de support</passive><br>Gagnez <keywordMajor>400</keywordMajor> PO grâce à cet objet pour le transformer en <rarityGeneric>Boussole runique</rarityGeneric> et obtenir la possibilité de porter des balises.<br><br><passive>Richesses partagées</passive> (20 sec, max 3 charges)<br>Quand vous êtes à proximité d\'un champion allié, infligez des dégâts à un champion ennemi ou tuez des sbires pour gagner des PO.</mainText>',
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

export function getItemDescriptionFallback(
  itemId: string,
  language: string = 'en_US'
): string | undefined {
  const locale = normalizeItemLocale(language)
  return ITEM_DESCRIPTION_FALLBACKS[itemId]?.[locale]
}

export function getItemPlaintextFallback(
  itemId: string,
  language: string = 'en_US'
): string | undefined {
  const locale = normalizeItemLocale(language)
  return ITEM_PLAINTEXT_FALLBACKS[itemId]?.[locale]
}

export function resolveItemDescriptionFields(
  itemId: string,
  item: { description?: string; plaintext?: string },
  language: string = 'en_US'
): { description: string; plaintext?: string } {
  const description =
    (typeof item.description === 'string' && item.description.trim()) ||
    getItemDescriptionFallback(itemId, language) ||
    ''
  const plaintext =
    (typeof item.plaintext === 'string' && item.plaintext.trim()) ||
    getItemPlaintextFallback(itemId, language)
  return plaintext ? { description, plaintext } : { description }
}
