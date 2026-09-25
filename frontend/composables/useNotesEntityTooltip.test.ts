import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import type { Champion } from '@lelanation/shared-types'
import { useNotesEntityTooltip } from './useNotesEntityTooltip'
import { useItemsStore } from '~/stores/ItemsStore'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ locale: ref('fr'), t: (key: string, fallback?: string) => fallback ?? key }),
}))

/** Minimal stand-in for a `.notes-entity` element (node test env has no DOM). */
function entityTarget(type: string, id: string) {
  const el = { getAttribute: (name: string) => (name === 'data-entity-type' ? type : id) }
  return { closest: () => el } as unknown as EventTarget
}
const outside = { closest: () => null } as unknown as EventTarget

function hover(target: EventTarget, relatedTarget: EventTarget | null = null) {
  return { target, relatedTarget, clientX: 10, clientY: 20 } as unknown as MouseEvent
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useNotesEntityTooltip', () => {
  it('shows an item tooltip on hover and hides it when leaving the entity', () => {
    useItemsStore().items = [{ id: '1001', name: 'Boots', description: 'Fast' }] as never
    const tip = useNotesEntityTooltip(() => null)
    tip.onEntityMouseOver(hover(entityTarget('item', '1001')))
    expect(tip.entityTooltip.value.pointer).toEqual({ x: 10, y: 20 })
    expect(tip.entityTooltipResolved.value?.name).toBe('Boots')
    tip.onEntityMouseOut(hover(entityTarget('item', '1001'), outside))
    expect(tip.entityTooltipResolved.value).toBeNull()
  })

  it('resolves champion spells from the given champion', () => {
    const champion = {
      id: 'Ahri',
      spells: [{ id: 'AhriQ', name: 'Orb', description: 'Throws' }],
    } as unknown as Champion
    const tip = useNotesEntityTooltip(() => champion)
    tip.onEntityMouseOver(hover(entityTarget('spell', 'AhriQ')))
    expect(tip.entityTooltipResolved.value).toEqual({ name: 'Orb', html: 'Throws' })
  })

  it('shows skill labels as-is and ignores targets outside entities', () => {
    const tip = useNotesEntityTooltip(() => null)
    tip.onEntityMouseOver(hover(outside))
    expect(tip.entityTooltip.value.show).toBe(false)
    tip.onEntityMouseOver(hover(entityTarget('skill', 'Q')))
    expect(tip.entityTooltipResolved.value).toEqual({ name: 'Q', html: null })
    tip.hide()
    expect(tip.entityTooltip.value.show).toBe(false)
  })
})
