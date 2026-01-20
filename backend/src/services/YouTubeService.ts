import axios, { AxiosInstance } from 'axios'
import { join } from 'path'
import { Result } from '../utils/Result.js'
import { ExternalApiError, AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'

export interface YouTubeVideo {
  id: string
  title: string
  description: string
  publishedAt: string
  thumbnailUrl: string
  channelId: string
  channelTitle: string
  url: string
}

export interface YouTubeChannelConfig {
  channelId: string
  channelName: string
}

export type YouTubeChannelConfigInput = YouTubeChannelConfig | string

interface StoredYouTubeChannelData {
  channelId: string
  channelName?: string
  lastSync?: string
  videos: YouTubeVideo[]
}

export class YouTubeService {
  private readonly api: AxiosInstance
  private readonly apiKey: string | null
  private readonly dataDir: string

  constructor(dataDir: string = join(process.cwd(), 'data', 'youtube')) {
    this.dataDir = dataDir
    this.apiKey = process.env.YOUTUBE_API_KEY || null
    this.api = axios.create({
      baseURL: 'https://www.googleapis.com/youtube/v3',
      timeout: 30000,
      params: { key: this.apiKey }
    })
  }

  private requireApiKey(): Result<void, AppError> {
    if (!this.apiKey) {
      return Result.err(new AppError('YouTube API key not configured', 'CONFIG_ERROR'))
    }
    return Result.ok(undefined)
  }

  /**
   * V2: supports channel config as:
   * - object: { channelId, channelName }
   * - string:
   *   - if starts with "UC": treated as a channelId
   *   - otherwise: treated as a search query, resolved to a channelId via YouTube Search API
   */
  private async resolveChannel(
    input: YouTubeChannelConfigInput
  ): Promise<Result<YouTubeChannelConfig, AppError>> {
    const keyOk = this.requireApiKey()
    if (keyOk.isErr()) return Result.err(keyOk.unwrapErr())

    if (typeof input !== 'string') {
      if (!input.channelId || typeof input.channelId !== 'string') {
        return Result.err(new AppError('Invalid YouTube channel config: missing channelId', 'VALIDATION_ERROR'))
      }
      if (!input.channelName || typeof input.channelName !== 'string') {
        return Result.err(new AppError('Invalid YouTube channel config: missing channelName', 'VALIDATION_ERROR'))
      }
      return Result.ok(input)
    }

    const q = input.trim()
    if (q.length === 0) {
      return Result.err(new AppError('Invalid YouTube channel config: empty string', 'VALIDATION_ERROR'))
    }

    if (q.startsWith('UC')) {
      return Result.ok({ channelId: q, channelName: q })
    }

    try {
      const searchResponse = await this.api.get('/search', {
        params: { part: 'snippet', q, type: 'channel', maxResults: 1 }
      })

      const item = searchResponse.data?.items?.[0]
      const channelId = item?.id?.channelId as string | undefined
      const channelName = item?.snippet?.channelTitle as string | undefined

      if (!channelId) {
        return Result.err(new ExternalApiError(`Unable to resolve channel from query: ${q}`))
      }

      return Result.ok({ channelId, channelName: channelName || q })
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return Result.err(
          new ExternalApiError(
            `Failed to resolve YouTube channel: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(new ExternalApiError('Failed to resolve YouTube channel', undefined, error))
    }
  }

  private async getUploadsPlaylistId(channelId: string): Promise<Result<string, AppError>> {
    const keyOk = this.requireApiKey()
    if (keyOk.isErr()) return Result.err(keyOk.unwrapErr())

    try {
      const channelResponse = await this.api.get('/channels', {
        params: { part: 'contentDetails', id: channelId }
      })

      if (!channelResponse.data?.items || channelResponse.data.items.length === 0) {
        return Result.err(new ExternalApiError(`Channel not found: ${channelId}`))
      }

      const uploadsPlaylistId =
        channelResponse.data.items[0].contentDetails?.relatedPlaylists?.uploads

      if (!uploadsPlaylistId) {
        return Result.err(new ExternalApiError(`No uploads playlist found for channel: ${channelId}`))
      }

      return Result.ok(uploadsPlaylistId)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return Result.err(
          new ExternalApiError(
            `Failed to fetch channel uploads playlist: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(new ExternalApiError('Failed to fetch channel uploads playlist', undefined, error))
    }
  }

  private async fetchUploadsVideoIds(params: {
    uploadsPlaylistId: string
    maxVideos: number
    stopWhenSeenIds?: Set<string>
  }): Promise<Result<string[], AppError>> {
    const keyOk = this.requireApiKey()
    if (keyOk.isErr()) return Result.err(keyOk.unwrapErr())

    const { uploadsPlaylistId, maxVideos, stopWhenSeenIds } = params
    const ids: string[] = []
    let pageToken: string | undefined

    try {
      while (ids.length < maxVideos) {
        const remaining = maxVideos - ids.length
        const pageSize = Math.min(50, remaining)

        const res = await this.api.get('/playlistItems', {
          params: {
            part: 'contentDetails',
            playlistId: uploadsPlaylistId,
            maxResults: pageSize,
            pageToken
          }
        })

        const items = res.data?.items
        if (!items || items.length === 0) break

        const pageIds: string[] = items
          .map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId)
          .filter((id: string | undefined): id is string => Boolean(id))

        if (pageIds.length === 0) break

        if (stopWhenSeenIds && stopWhenSeenIds.size > 0) {
          for (const id of pageIds) {
            if (stopWhenSeenIds.has(id)) return Result.ok(ids)
            ids.push(id)
            if (ids.length >= maxVideos) break
          }
        } else {
          ids.push(...pageIds)
        }

        pageToken = res.data?.nextPageToken
        if (!pageToken) break
      }

      return Result.ok(ids)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          return Result.err(new ExternalApiError('YouTube API rate limit exceeded. Please retry later.', 429, error))
        }
        if (error.response?.status === 403) {
          return Result.err(new ExternalApiError('YouTube API quota exceeded', 403, error))
        }
        return Result.err(
          new ExternalApiError(
            `Failed to fetch YouTube uploads list: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(new ExternalApiError('Failed to fetch YouTube uploads list', undefined, error))
    }
  }

  private async fetchVideoDetails(videoIds: string[]): Promise<Result<YouTubeVideo[], AppError>> {
    const keyOk = this.requireApiKey()
    if (keyOk.isErr()) return Result.err(keyOk.unwrapErr())
    if (videoIds.length === 0) return Result.ok([])

    try {
      const videos: YouTubeVideo[] = []
      for (let i = 0; i < videoIds.length; i += 50) {
        const chunk = videoIds.slice(i, i + 50)
        const res = await this.api.get('/videos', {
          params: { part: 'snippet,statistics', id: chunk.join(',') }
        })

        if (!res.data?.items) continue

        videos.push(
          ...res.data.items.map(
            (item: {
              id: string
              snippet?: {
                title?: string
                description?: string
                publishedAt?: string
                thumbnails?: {
                  default?: { url?: string }
                  medium?: { url?: string }
                  high?: { url?: string }
                }
                channelId?: string
                channelTitle?: string
              }
            }) => ({
              id: item.id,
              title: item.snippet?.title || 'Untitled',
              description: item.snippet?.description || '',
              publishedAt: item.snippet?.publishedAt || '',
              thumbnailUrl:
                item.snippet?.thumbnails?.high?.url ||
                item.snippet?.thumbnails?.medium?.url ||
                item.snippet?.thumbnails?.default?.url ||
                '',
              channelId: item.snippet?.channelId || '',
              channelTitle: item.snippet?.channelTitle || 'Unknown',
              url: `https://www.youtube.com/watch?v=${item.id}`
            })
          )
        )
      }

      return Result.ok(videos)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          return Result.err(new ExternalApiError('YouTube API rate limit exceeded. Please retry later.', 429, error))
        }
        if (error.response?.status === 403) {
          return Result.err(new ExternalApiError('YouTube API quota exceeded', 403, error))
        }
        return Result.err(
          new ExternalApiError(
            `Failed to fetch YouTube video details: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(new ExternalApiError('Failed to fetch YouTube video details', undefined, error))
    }
  }

  private async loadExistingChannelData(
    channelId: string
  ): Promise<Result<StoredYouTubeChannelData | null, AppError>> {
    const filePath = join(this.dataDir, `${channelId}.json`)
    const exists = await FileManager.exists(filePath)
    if (!exists) return Result.ok(null)

    const result = await FileManager.readJson<StoredYouTubeChannelData>(filePath)
    if (result.isErr()) return Result.err(result.unwrapErr())
    return Result.ok(result.unwrap())
  }

  async saveChannelData(params: {
    channelId: string
    channelName?: string
    videos: YouTubeVideo[]
    lastSync: string
  }): Promise<Result<void, AppError>> {
    const filePath = join(this.dataDir, `${params.channelId}.json`)
    return FileManager.writeJson(filePath, {
      channelId: params.channelId,
      channelName: params.channelName,
      videos: params.videos,
      lastSync: params.lastSync
    })
  }

  /**
   * V2 behavior:
   * - First sync: backfill up to YOUTUBE_BACKFILL_MAX_VIDEOS (default 500)
   * - Next syncs: only fetch newest videos until we hit a known video id,
   *   capped by YOUTUBE_INCREMENTAL_MAX_VIDEOS (default 200)
   */
  async syncChannels(
    channels: YouTubeChannelConfigInput[]
  ): Promise<Result<{ syncedChannels: number; totalVideos: number }, AppError>> {
    const keyOk = this.requireApiKey()
    if (keyOk.isErr()) return Result.err(keyOk.unwrapErr())

    let syncedChannels = 0
    let totalVideos = 0

    for (const input of channels) {
      const resolved = await this.resolveChannel(input)
      if (resolved.isErr()) return Result.err(resolved.unwrapErr())

      const channel = resolved.unwrap()

      const existingResult = await this.loadExistingChannelData(channel.channelId)
      if (existingResult.isErr()) return Result.err(existingResult.unwrapErr())

      const existing = existingResult.unwrap()
      const existingVideos = existing?.videos ?? []
      const existingIds = new Set(existingVideos.map((v) => v.id))
      const isFirstSync = existingVideos.length === 0

      const maxVideos = Number(
        isFirstSync
          ? process.env.YOUTUBE_BACKFILL_MAX_VIDEOS || '500'
          : process.env.YOUTUBE_INCREMENTAL_MAX_VIDEOS || '200'
      )

      const uploadsPlaylistIdResult = await this.getUploadsPlaylistId(channel.channelId)
      if (uploadsPlaylistIdResult.isErr()) return Result.err(uploadsPlaylistIdResult.unwrapErr())

      const uploadsPlaylistId = uploadsPlaylistIdResult.unwrap()
      const idsResult = await this.fetchUploadsVideoIds({
        uploadsPlaylistId,
        maxVideos,
        stopWhenSeenIds: isFirstSync ? undefined : existingIds
      })
      if (idsResult.isErr()) return Result.err(idsResult.unwrapErr())

      const fetchedIds = idsResult.unwrap()
      const newIds = fetchedIds.filter((id) => !existingIds.has(id))

      const detailsResult = await this.fetchVideoDetails(newIds)
      if (detailsResult.isErr()) return Result.err(detailsResult.unwrapErr())

      const newVideos = detailsResult.unwrap()

      // Merge (keep history, newest first)
      const byId = new Map<string, YouTubeVideo>()
      for (const v of [...newVideos, ...existingVideos]) {
        if (!byId.has(v.id)) byId.set(v.id, v)
      }
      const merged = Array.from(byId.values()).sort((a, b) => {
        const da = Date.parse(a.publishedAt || '') || 0
        const db = Date.parse(b.publishedAt || '') || 0
        return db - da
      })

      const save = await this.saveChannelData({
        channelId: channel.channelId,
        channelName: channel.channelName,
        videos: merged,
        lastSync: new Date().toISOString()
      })
      if (save.isErr()) return Result.err(save.unwrapErr())

      syncedChannels++
      totalVideos += merged.length
    }

    return Result.ok({ syncedChannels, totalVideos })
  }
}
