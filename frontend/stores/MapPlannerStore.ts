import { defineStore } from 'pinia'
import { MAP_PLANNER_MAPS } from '~/utils/mapPlannerAssets'

const STORAGE_KEY = 'lelanation_map_planner_boards'
const MAX_STORED_BOARDS = 20

export interface MapPlannerPoint {
  x: number
  y: number
}

export interface MapPlannerStroke {
  id: string
  color: string
  width: number
  eraser: boolean
  points: MapPlannerPoint[]
}

export interface MapPlannerIconInstance {
  id: string
  iconKey: string
  x: number
  y: number
  size: number
}

export interface MapPlannerLayer {
  id: string
  name: string
  visible: boolean
  strokes: MapPlannerStroke[]
  icons: MapPlannerIconInstance[]
}

export interface MapPlannerBoard {
  id: string
  name: string
  mapId: string
  activeLayerId: string
  layers: MapPlannerLayer[]
  createdAt: string
  updatedAt: string
}

interface MapPlannerState {
  currentBoard: MapPlannerBoard
  boards: MapPlannerBoard[]
  hydrated: boolean
}

function randomId(): string {
  return crypto.randomUUID()
}

function createDefaultLayer(name = 'Calque 1'): MapPlannerLayer {
  return {
    id: randomId(),
    name,
    visible: true,
    strokes: [],
    icons: [],
  }
}

function createDefaultBoard(name = 'Plan map'): MapPlannerBoard {
  const layer = createDefaultLayer()
  const mapId = MAP_PLANNER_MAPS[0]?.id ?? 'summoners-rift'
  const now = new Date().toISOString()
  return {
    id: randomId(),
    name,
    mapId,
    activeLayerId: layer.id,
    layers: [layer],
    createdAt: now,
    updatedAt: now,
  }
}

function cloneBoard(board: MapPlannerBoard): MapPlannerBoard {
  return JSON.parse(JSON.stringify(board)) as MapPlannerBoard
}

export const useMapPlannerStore = defineStore('mapPlanner', {
  state: (): MapPlannerState => ({
    currentBoard: createDefaultBoard(),
    boards: [],
    hydrated: false,
  }),
  getters: {
    activeLayer(state): MapPlannerLayer | null {
      return (
        state.currentBoard.layers.find(layer => layer.id === state.currentBoard.activeLayerId) ??
        null
      )
    },
  },
  actions: {
    hydrateFromStorage() {
      if (import.meta.server || this.hydrated) return
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
          this.hydrated = true
          return
        }
        const parsed = JSON.parse(raw) as MapPlannerBoard[]
        if (!Array.isArray(parsed)) {
          this.hydrated = true
          return
        }
        this.boards = parsed
        if (this.boards.length > 0) {
          this.currentBoard = cloneBoard(this.boards[0]!)
        }
      } catch {
        // Ignore invalid local state.
      } finally {
        this.hydrated = true
      }
    },
    touchBoard() {
      this.currentBoard.updatedAt = new Date().toISOString()
      this.persistBoards()
    },
    persistBoards() {
      if (import.meta.server) return
      const allBoards = [
        cloneBoard(this.currentBoard),
        ...this.boards
          .filter(board => board.id !== this.currentBoard.id)
          .map(board => cloneBoard(board)),
      ].slice(0, MAX_STORED_BOARDS)
      this.boards = allBoards
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allBoards))
    },
    createBoard(name?: string) {
      this.currentBoard = createDefaultBoard(name?.trim() || 'Plan map')
      this.persistBoards()
    },
    loadBoard(boardId: string) {
      const board = this.boards.find(item => item.id === boardId)
      if (!board) return false
      this.currentBoard = cloneBoard(board)
      return true
    },
    deleteBoard(boardId: string) {
      const remaining = this.boards.filter(board => board.id !== boardId)
      this.boards = remaining
      if (this.currentBoard.id === boardId) {
        this.currentBoard = remaining[0] ? cloneBoard(remaining[0]) : createDefaultBoard()
      }
      this.persistBoards()
    },
    renameCurrentBoard(name: string) {
      this.currentBoard.name = name.trim() || 'Plan map'
      this.touchBoard()
    },
    setMap(mapId: string) {
      this.currentBoard.mapId = mapId
      this.touchBoard()
    },
    setActiveLayer(layerId: string) {
      if (!this.currentBoard.layers.some(layer => layer.id === layerId)) return
      this.currentBoard.activeLayerId = layerId
      this.touchBoard()
    },
    addLayer() {
      const nextIndex = this.currentBoard.layers.length + 1
      const layer = createDefaultLayer(`Calque ${nextIndex}`)
      this.currentBoard.layers.unshift(layer)
      this.currentBoard.activeLayerId = layer.id
      this.touchBoard()
    },
    duplicateLayer(layerId: string) {
      const source = this.currentBoard.layers.find(layer => layer.id === layerId)
      if (!source) return
      const clone = cloneBoard({
        ...this.currentBoard,
        layers: [{ ...source, id: randomId(), name: `${source.name} (copie)` }],
      }).layers[0]
      if (!clone) return
      this.currentBoard.layers.unshift(clone)
      this.currentBoard.activeLayerId = clone.id
      this.touchBoard()
    },
    removeLayer(layerId: string) {
      if (this.currentBoard.layers.length <= 1) return
      this.currentBoard.layers = this.currentBoard.layers.filter(layer => layer.id !== layerId)
      if (!this.currentBoard.layers.some(layer => layer.id === this.currentBoard.activeLayerId)) {
        const firstLayer = this.currentBoard.layers[0]
        if (firstLayer) this.currentBoard.activeLayerId = firstLayer.id
      }
      this.touchBoard()
    },
    renameLayer(layerId: string, name: string) {
      const layer = this.currentBoard.layers.find(item => item.id === layerId)
      if (!layer) return
      layer.name = name.trim() || layer.name
      this.touchBoard()
    },
    setLayerVisibility(layerId: string, visible: boolean) {
      const layer = this.currentBoard.layers.find(item => item.id === layerId)
      if (!layer) return
      layer.visible = visible
      this.touchBoard()
    },
    replaceLayerStrokes(layerId: string, strokes: MapPlannerStroke[]) {
      const layer = this.currentBoard.layers.find(item => item.id === layerId)
      if (!layer) return
      layer.strokes = strokes
      this.touchBoard()
    },
    replaceLayerIcons(layerId: string, icons: MapPlannerIconInstance[]) {
      const layer = this.currentBoard.layers.find(item => item.id === layerId)
      if (!layer) return
      layer.icons = icons
      this.touchBoard()
    },
    clearLayer(layerId: string) {
      const layer = this.currentBoard.layers.find(item => item.id === layerId)
      if (!layer) return
      layer.strokes = []
      layer.icons = []
      this.touchBoard()
    },
    clearAllLayers() {
      for (const layer of this.currentBoard.layers) {
        layer.strokes = []
        layer.icons = []
      }
      this.touchBoard()
    },
    exportShareCode(): string {
      const json = JSON.stringify(cloneBoard(this.currentBoard))
      return btoa(unescape(encodeURIComponent(json)))
    },
    importShareCode(code: string): boolean {
      try {
        const decoded = decodeURIComponent(escape(atob(code)))
        const parsed = JSON.parse(decoded) as MapPlannerBoard
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.layers)) return false
        this.currentBoard = {
          ...parsed,
          id: randomId(),
          name: `${parsed.name || 'Plan map'} (import)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        this.persistBoards()
        return true
      } catch {
        return false
      }
    },
  },
})
