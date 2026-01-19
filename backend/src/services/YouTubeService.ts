import axios, { AxiosInstance } from 'axios'
import { Result } from '../utils/Result.js'
import { ExternalApiError, AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'
import { join } from 'path'

interface YouTubeVideo {
  id: string
  title: string
  description: string
  publishedAt: string
  thumbnailUrl: string
  channelId: string
  channelTitle: string
  url: string
}

interface YouTubeChannelConfig {
  channelId: string
  channelName: string
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
      params: {
        key: this.apiKey
      }
    })
  }

  /**
   * Fetch videos from a YouTube channel
   */
  async fetchChannelVideos(
    channelId: string,
    maxResults: number = 50
  ): Promise<Result<YouTubeVideo[], AppError>> {
    if (!this.apiKey) {
      return Result.err(
        new AppError('YouTube API key not configured', 'CONFIG_ERROR')
      )
    }

    try {
      // First, get the uploads playlist ID from channel
      const channelResponse = await this.api.get('/channels', {
        params: {
          part: 'contentDetails',
          id: channelId
        }
      })

      if (
        !channelResponse.data?.items ||
        channelResponse.data.items.length === 0
      ) {
        return Result.err(
          new ExternalApiError(`Channel not found: ${channelId}`)
        )
      }

      const uploadsPlaylistId =
        channelResponse.data.items[0].contentDetails?.relatedPlaylists
          ?.uploads

      if (!uploadsPlaylistId) {
        return Result.err(
          new ExternalApiError(`No uploads playlist found for channel: ${channelId}`)
        )
      }

      // Get videos from uploads playlist
      const videosResponse = await this.api.get('/playlistItems', {
        params: {
          part: 'snippet,contentDetails',
          playlistId: uploadsPlaylistId,
          maxResults
        }
      })

      if (!videosResponse.data?.items) {
        return Result.ok([])
      }

      // Extract video IDs
      const videoIds = videosResponse.data.items
        .map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId)
        .filter((id: string | undefined): id is string => Boolean(id))

      if (videoIds.length === 0) {
        return Result.ok([])
      }

      // Get video details
      const detailsResponse = await this.api.get('/videos', {
        params: {
          part: 'snippet,statistics',
          id: videoIds.join(',')
        }
      })

      if (!detailsResponse.data?.items) {
        return Result.ok([])
      }

      // Map to our format
      const videos: YouTubeVideo[] = detailsResponse.data.items.map(
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
          channelId: item.snippet?.channelId || channelId,
          channelTitle: item.snippet?.channelTitle || 'Unknown',
          url: `https://www.youtube.com/watch?v=${item.id}`
        })
      )

      return Result.ok(videos)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle rate limiting (429)
        if (error.response?.status === 429) {
          return Result.err(
            new ExternalApiError(
              'YouTube API rate limit exceeded. Please retry later.',
              429,
              error
            )
          )
        }

        // Handle quota exceeded (403)
        if (error.response?.status === 403) {
          return Result.err(
            new ExternalApiError(
              'YouTube API quota exceeded',
              403,
              error
            )
          )
        }

        return Result.err(
          new ExternalApiError(
            `Failed to fetch YouTube videos: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(
        new ExternalApiError('Failed to fetch YouTube videos', undefined, error)
      )
    }
  }

  /**
   * Save videos to local JSON file
   */
  async saveVideos(
    videos: YouTubeVideo[],
    channelId: string
  ): Promise<Result<void, AppError>> {
    const filePath = join(this.dataDir, `${channelId}.json`)
    return FileManager.writeJson(filePath, {
      channelId,
      videos,
      lastSync: new Date().toISOString()
    })
  }

  /**
   * Synchronize videos for multiple channels
   */
  async syncChannels(
    channels: YouTubeChannelConfig[]
  ): Promise<Result<{ syncedChannels: number; totalVideos: number }, AppError>> {
    let syncedChannels = 0
    let totalVideos = 0

    for (const channel of channels) {
      const videosResult = await this.fetchChannelVideos(channel.channelId)
      if (videosResult.isErr()) {
        // Log error but continue with other channels
        console.error(
          `[YouTubeService] Failed to sync channel ${channel.channelId}:`,
          videosResult.unwrapErr()
        )
        continue
      }

      const videos = videosResult.unwrap()
      const saveResult = await this.saveVideos(videos, channel.channelId)
      if (saveResult.isErr()) {
        console.error(
          `[YouTubeService] Failed to save videos for channel ${channel.channelId}:`,
          saveResult.unwrapErr()
        )
        continue
      }

      syncedChannels++
      totalVideos += videos.length
    }

    return Result.ok({ syncedChannels, totalVideos })
  }
}
