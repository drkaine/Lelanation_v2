import { defineStore } from 'pinia'
import type { YouTubeChannelData, YouTubeChannelStatus } from '~/types/youtube'
import { apiUrl } from '~/utils/apiUrl'
import { getYouTubeChannelDataUrl, getYouTubeChannelsConfigUrl } from '~/utils/staticDataUrl'

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
        // Try static file first (only in browser, not SSR)
        let data: ChannelsStatusResponse | null = null
        let useStatic = false

        if (process.client) {
          try {
            const configUrl = getYouTubeChannelsConfigUrl()
            const configRes = await fetch(configUrl, { cache: 'no-cache' })
            if (configRes.ok) {
              const config = (await configRes.json()) as {
                channels: Array<{ channelId: string; channelName?: string } | string>
              }

              // Only use static files if we have channels configured
              if (config.channels && config.channels.length > 0) {
                // Build status from static files
                const statusPromises = (config.channels || []).map(async entry => {
                  const channelId = typeof entry === 'string' ? entry : entry.channelId
                  const channelName = typeof entry === 'string' ? undefined : entry.channelName
                  const channelUrl = getYouTubeChannelDataUrl(channelId)

                  try {
                    const channelRes = await fetch(channelUrl, { cache: 'no-cache' })
                    if (channelRes.ok) {
                      const channelData = (await channelRes.json()) as YouTubeChannelData
                      return {
                        channelId: channelData.channelId || channelId,
                        channelName: channelData.channelName || channelName,
                        synced: true,
                        lastSync: channelData.lastSync || null,
                        videoCount: Array.isArray(channelData.videos)
                          ? channelData.videos.length
                          : 0,
                      } as YouTubeChannelStatus
                    }
                  } catch (channelError) {
                    // Channel file not found or network error - silently continue
                  }

                  // Return status even if channel data file is not available
                  // This ensures creators are shown even if videos aren't loaded yet
                  return {
                    channelId,
                    channelName: channelName || channelId,
                    synced: false,
                    lastSync: null,
                    videoCount: 0,
                  } as YouTubeChannelStatus
                })

                const status = await Promise.all(statusPromises)
                // Always set data if we have channels configured, even if some files failed
                if (status.length > 0) {
                  data = { channels: status }
                  useStatic = true
                }
              }
            }
          } catch (staticError) {
            // Static files not available, will try API - silently continue
          }
        }

        // Fallback to API if static files not available
        if (!useStatic) {
          try {
            const res = await fetch(apiUrl('/api/youtube/status'), {
              signal: AbortSignal.timeout(5000),
            })
            if (!res.ok) {
              // If API returns error, try to load at least the config file as fallback
              if (
                process.client &&
                (res.status === 502 || res.status === 503 || res.status >= 500)
              ) {
                try {
                  const configUrl = getYouTubeChannelsConfigUrl()
                  const configRes = await fetch(configUrl, { cache: 'no-cache' })
                  if (configRes.ok) {
                    const config = (await configRes.json()) as {
                      channels: Array<{ channelId: string; channelName?: string } | string>
                    }
                    if (config.channels && config.channels.length > 0) {
                      // Return basic status from config (without video counts)
                      data = {
                        channels: config.channels.map(entry => {
                          const channelId = typeof entry === 'string' ? entry : entry.channelId
                          const channelName =
                            typeof entry === 'string' ? undefined : entry.channelName
                          return {
                            channelId,
                            channelName: channelName || channelId,
                            synced: false,
                            lastSync: null,
                            videoCount: 0,
                          } as YouTubeChannelStatus
                        }),
                      }
                      useStatic = true
                    }
                  }
                } catch (configError) {
                  // Failed to load config file as fallback - silently continue
                }
              }

              // If we still don't have data, check if it's because no channels are configured
              if (!useStatic && (res.status === 400 || res.status === 404)) {
                // No channels configured, return empty array
                this.status = []
                this.loadingStatus = false
                return
              }

              // If we have data from fallback, use it; otherwise throw error
              if (!useStatic) {
                throw new Error(`API returned ${res.status}`)
              }
            } else {
              data = (await res.json()) as ChannelsStatusResponse
            }
          } catch (apiError) {
            // If API fails and we don't have static data, try config file one more time
            if (!useStatic && process.client) {
              try {
                const configUrl = getYouTubeChannelsConfigUrl()
                const configRes = await fetch(configUrl, { cache: 'no-cache' })
                if (configRes.ok) {
                  const config = (await configRes.json()) as {
                    channels: Array<{ channelId: string; channelName?: string } | string>
                  }
                  if (config.channels && config.channels.length > 0) {
                    // Return basic status from config (without video counts)
                    data = {
                      channels: config.channels.map(entry => {
                        const channelId = typeof entry === 'string' ? entry : entry.channelId
                        const channelName =
                          typeof entry === 'string' ? undefined : entry.channelName
                        return {
                          channelId,
                          channelName: channelName || channelId,
                          synced: false,
                          lastSync: null,
                          videoCount: 0,
                        } as YouTubeChannelStatus
                      }),
                    }
                    useStatic = true
                  }
                }
              } catch (configError) {
                // Failed to load config file as last resort - silently continue
              }
            }

            // If we still don't have data, return empty array
            if (!useStatic) {
              this.status = []
              this.loadingStatus = false
              return
            }
          }
        }

        this.status = data && Array.isArray(data.channels) ? data.channels : []
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
        let data: YouTubeChannelData | null = null
        let useStatic = false

        // Try static file first (only in browser, not SSR)
        if (process.client) {
          try {
            const staticUrl = getYouTubeChannelDataUrl(channelId)
            const staticRes = await fetch(staticUrl, { cache: 'no-cache' })
            if (staticRes.ok) {
              data = (await staticRes.json()) as YouTubeChannelData
              useStatic = true
            }
          } catch (staticError) {
            // Static file not available, will try API - silently continue
          }
        }

        // Fallback to API if static file not available
        if (!useStatic) {
          try {
            const res = await fetch(
              apiUrl(`/api/youtube/channels/${encodeURIComponent(channelId)}`),
              {
                signal: AbortSignal.timeout(5000),
              }
            )
            if (!res.ok) {
              // If API fails, don't set data - will be undefined
            } else {
              data = (await res.json()) as YouTubeChannelData
            }
          } catch (apiError) {
            // API error - silently continue
          }
        }

        if (data) {
          this.channelDataById[channelId] = data
        } else {
          // Don't set data - allows page to show creators even without video data
          this.channelDataById[channelId] = undefined
        }
      } catch (e) {
        // Don't set global error for individual channel failures
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
