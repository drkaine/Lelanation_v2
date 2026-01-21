import { defineStore } from 'pinia'
import type { YouTubeChannelData, YouTubeChannelStatus } from '~/types/youtube'
import { apiUrl } from '~/utils/apiUrl'

type ChannelsConfig = {
  channels: Array<{ channelId: string; channelName: string } | string>
}

type ChannelsStatusResponse = {
  channels: YouTubeChannelStatus[]
}

export const useYouTubeStore = defineStore('youtube', {
  state: () => ({
    status: [] as YouTubeChannelStatus[],
    config: [] as ChannelsConfig['channels'],
    channelDataById: {} as Record<string, YouTubeChannelData | undefined>,
    loadingStatus: false,
    loadingConfig: false,
    loadingChannelIds: new Set<string>(),
    error: null as string | null,
    lastSyncTriggerResult: null as { syncedChannels: number; totalVideos: number } | null,
  }),

  getters: {
    creators(): YouTubeChannelStatus[] {
      // Sort by name (fallback to id)
      return [...this.status].sort((a, b) =>
        (a.channelName || a.channelId).localeCompare(b.channelName || b.channelId)
      )
    },
  },

  actions: {
    clearChannelCache() {
      this.channelDataById = {}
      this.loadingChannelIds = new Set<string>()
    },

    async loadStatus() {
      this.loadingStatus = true
      this.error = null
      try {
        const res = await fetch(apiUrl('/api/youtube/status'))
        if (!res.ok) throw new Error('Failed to load YouTube status')
        const data = (await res.json()) as ChannelsStatusResponse
        this.status = Array.isArray(data.channels) ? data.channels : []
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load YouTube status'
        this.status = []
      } finally {
        this.loadingStatus = false
      }
    },

    async loadAllChannelsData() {
      // Ensure we have a status list first.
      if (!this.status.length) {
        await this.loadStatus()
      }
      await Promise.all(this.status.map(s => this.loadChannelData(s.channelId)))
    },

    async loadConfig() {
      this.loadingConfig = true
      this.error = null
      try {
        const res = await fetch(apiUrl('/api/youtube/channels'))
        if (!res.ok) throw new Error('Failed to load YouTube channels config')
        const data = (await res.json()) as ChannelsConfig
        this.config = Array.isArray(data.channels) ? data.channels : []
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load YouTube channels config'
        this.config = []
      } finally {
        this.loadingConfig = false
      }
    },

    async loadChannelData(channelId: string) {
      if (!channelId) return
      if (this.channelDataById[channelId]) return

      this.loadingChannelIds.add(channelId)
      this.error = null
      try {
        const res = await fetch(apiUrl(`/api/youtube/channels/${encodeURIComponent(channelId)}`))
        if (!res.ok) throw new Error('Failed to load channel videos')
        const data = (await res.json()) as YouTubeChannelData
        this.channelDataById[channelId] = data
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load channel videos'
        this.channelDataById[channelId] = undefined
      } finally {
        this.loadingChannelIds.delete(channelId)
      }
    },

    async addCreator(input: string) {
      const channel = input.trim()
      if (!channel) return

      this.error = null
      try {
        const res = await fetch(apiUrl('/api/youtube/channels'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Failed to add creator')
        await this.loadConfig()
        await this.loadStatus()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to add creator'
      }
    },

    async removeCreator(channelId: string) {
      if (!channelId) return

      this.error = null
      try {
        const res = await fetch(apiUrl(`/api/youtube/channels/${encodeURIComponent(channelId)}`), {
          method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Failed to remove creator')
        delete this.channelDataById[channelId]
        await this.loadConfig()
        await this.loadStatus()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to remove creator'
      }
    },

    async triggerSync() {
      this.error = null
      this.lastSyncTriggerResult = null
      try {
        const res = await fetch(apiUrl('/api/youtube/trigger'), { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Failed to trigger YouTube sync')
        this.lastSyncTriggerResult = {
          syncedChannels: Number(data.syncedChannels) || 0,
          totalVideos: Number(data.totalVideos) || 0,
        }
        await this.loadStatus()
        // Keep existing channelData cache; user can refresh by hard reload / expand again
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to trigger YouTube sync'
      }
    },
  },
})
