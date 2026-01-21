export interface YouTubeVideo {
  id: string
  title: string
  description: string
  publishedAt: string
  thumbnailUrl: string
  channelId: string
  channelTitle: string
  url: string
  duration?: string
  isShort?: boolean
}

export interface YouTubeChannelStatus {
  channelId: string
  channelName?: string
  synced: boolean
  lastSync: string | null
  videoCount: number
  error?: string
}

export interface YouTubeChannelData {
  channelId: string
  channelName?: string
  lastSync?: string
  videos: YouTubeVideo[]
}
