export type BuildNotesLayout = 'simple' | 'detailed' | 'both'
export type BuildNotesMode = 'single' | 'multiple'
export type BuildNotesEntityType = 'item' | 'rune' | 'summoner' | 'spell' | 'skill' | 'shard'

export interface BuildNotesSimpleCard {
  id: string
  title: string
  body: string
}

export interface BuildNotesDetailed {
  howToTrade?: string
  whatToWatchOutFor?: string
  tips?: string
}

export interface BuildNotesContent {
  layout: BuildNotesLayout
  youtubeUrl?: string
  simpleCards: BuildNotesSimpleCard[]
  detailed: BuildNotesDetailed
}

export const BUILD_NOTES_SIMPLE_CARD_MAX_CHARS = 244
export const BUILD_NOTES_DETAILED_SECTION_MAX_CHARS = 999
