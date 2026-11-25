import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBuildStore } from '~/stores/BuildStore'
import { getTheorycraftStorageScope } from '~/utils/theorycraftStorageScope'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v)
    },
    removeItem: (k: string) => {
      data.delete(k)
    },
  }
}

let storage: ReturnType<typeof memoryStorage>

beforeEach(() => {
  setActivePinia(createPinia())
  storage = memoryStorage()
  vi.stubGlobal('localStorage', storage)
})

function snapshot() {
  return new Map(storage.data)
}

describe('theorycraft autonome (Apprendre › Champion)', () => {
  it('part d’un build vierge sans toucher au brouillon du builder', () => {
    const store = useBuildStore()
    store.ensureCurrentBuild()
    store.currentBuild!.name = 'Mon brouillon'
    store.persistCurrentBuildDraft()
    store.setLastBuilderStep('item')
    const before = snapshot()

    store.startStandaloneTheorycraft()

    expect(store.currentBuild?.champion).toBeNull()
    expect(store.currentBuild?.name).not.toBe('Mon brouillon')
    expect(store.builderSession).toBe('theorycraft')
    expect(store.theorycraftLinkedToBuilder).toBe(false)
    expect(getTheorycraftStorageScope()).toBe('vs:learn:ally')

    store.currentBuild!.name = 'Modifié'
    store.persistCurrentBuildDraft()
    expect(snapshot()).toEqual(before)
  })

  it('en sortant, rend le brouillon du builder intact', () => {
    const store = useBuildStore()
    store.ensureCurrentBuild()
    store.currentBuild!.name = 'Mon brouillon'
    store.persistCurrentBuildDraft()

    store.startStandaloneTheorycraft()
    store.endStandaloneTheorycraft()

    expect(store.currentBuild).toBeNull()
    expect(store.builderSession).toBe('create')
    expect(store.draftPersistenceSuspended).toBe(false)
    expect(getTheorycraftStorageScope()).toBe('builder:default')
    store.ensureCurrentBuild()
    expect(store.currentBuild?.name).toBe('Mon brouillon')
  })
})
