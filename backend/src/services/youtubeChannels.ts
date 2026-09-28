/**
 * YouTube channels config (`data/youtube/channels.json`) and per-channel sync files
 * (`<channelId>.json`, backend copy first, frontend public copy as fallback).
 */
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'

export type YouTubeChannelEntry = { channelId: string; channelName: string } | string
export type YouTubeChannelsConfig = { channels: YouTubeChannelEntry[] }
export type StoredChannelData = {
  channelId: string
  channelName?: string
  lastSync?: string
  videos?: Array<unknown>
}

type Failure = { ok: false; status: number; error: string }

export function channelEntryId(entry: YouTubeChannelEntry): string {
  return typeof entry === 'string' ? entry : entry.channelId
}

/** Missing file = no channel; any other read error → 500. */
export async function readChannelsConfig(
  file: string
): Promise<{ ok: true; value: YouTubeChannelsConfig } | Failure> {
  const configResult = await FileManager.readJson<YouTubeChannelsConfig>(file)
  if (configResult.isErr()) {
    if (configResult.unwrapErr().code === 'FILE_NOT_FOUND') {
      return { ok: true, value: { channels: [] } }
    }
    return { ok: false, status: 500, error: configResult.unwrapErr().message }
  }
  const config = configResult.unwrap()
  return { ok: true, value: { channels: Array.isArray(config.channels) ? config.channels : [] } }
}

async function writeChannels(
  file: string,
  channels: YouTubeChannelEntry[]
): Promise<{ ok: true; channels: YouTubeChannelEntry[] } | Failure> {
  const writeResult = await FileManager.writeJson(file, { channels })
  if (writeResult.isErr()) {
    return { ok: false, status: 500, error: writeResult.unwrapErr().message }
  }
  return { ok: true, channels }
}

/** Appends the channel unless already present (config left untouched then). */
export async function addChannelToConfig(
  file: string,
  channel: { channelId: string; channelName: string }
): Promise<{ ok: true; channels: YouTubeChannelEntry[] } | Failure> {
  const config = await readChannelsConfig(file)
  if (!config.ok) return config
  const channels = config.value.channels ?? []
  if (channels.some(entry => channelEntryId(entry) === channel.channelId)) {
    return { ok: true, channels }
  }
  return writeChannels(file, [
    ...channels,
    { channelId: channel.channelId, channelName: channel.channelName },
  ])
}

export async function removeChannelFromConfig(
  file: string,
  channelId: string
): Promise<{ ok: true; channels: YouTubeChannelEntry[] } | Failure> {
  const config = await readChannelsConfig(file)
  if (!config.ok) return config
  return writeChannels(
    file,
    (config.value.channels ?? []).filter(entry => channelEntryId(entry) !== channelId)
  )
}

/** Sync state of one channel from its stored file. */
export async function channelSyncStatus(
  entry: YouTubeChannelEntry,
  dirs: { backendDir: string; frontendDir: string }
) {
  const channelId = channelEntryId(entry)
  const channelName = typeof entry === 'string' ? entry : entry.channelName
  let filePath = join(dirs.backendDir, `${channelId}.json`)
  let exists = await FileManager.exists(filePath)
  if (!exists) {
    filePath = join(dirs.frontendDir, `${channelId}.json`)
    exists = await FileManager.exists(filePath)
  }
  if (!exists) {
    return { channelId, channelName, synced: false, lastSync: null, videoCount: 0 }
  }
  const dataResult = await FileManager.readJson<StoredChannelData>(filePath)
  if (dataResult.isErr()) {
    return {
      channelId,
      channelName,
      synced: false,
      lastSync: null,
      videoCount: 0,
      error: dataResult.unwrapErr().message,
    }
  }
  const data = dataResult.unwrap()
  return {
    channelId: data.channelId || channelId,
    channelName: data.channelName || channelName,
    synced: true,
    lastSync: data.lastSync || null,
    videoCount: Array.isArray(data.videos) ? data.videos.length : 0,
  }
}
