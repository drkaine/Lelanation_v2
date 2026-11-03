import { describe, expect, it } from 'vitest'
import { notesChipPlacement, tagColumnVisible } from '../buildCardNotesChip'

describe('notesChipPlacement', () => {
  it('stays_in_the_summoner_row_when_the_tag_column_is_short', () => {
    expect(notesChipPlacement(0)).toBe('row')
    expect(notesChipPlacement(3)).toBe('row')
  })

  it('goes_below_the_other_tags_when_the_column_reaches_the_summoner_row', () => {
    expect(notesChipPlacement(4)).toBe('stack')
    expect(notesChipPlacement(6)).toBe('stack')
  })
})

describe('tagColumnVisible', () => {
  it('shows_the_column_for_a_guide_chip_even_without_tags', () => {
    const none = { readonly: true, tagCount: 0, lelariva: false, guide: false }
    expect(tagColumnVisible(none)).toBe(false)
    expect(tagColumnVisible({ ...none, guide: true })).toBe(true)
    expect(tagColumnVisible({ ...none, tagCount: 1 })).toBe(true)
    expect(tagColumnVisible({ ...none, readonly: false })).toBe(true)
  })
})
