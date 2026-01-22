import axios, { AxiosInstance } from 'axios'
import { join } from 'path'
import { Result } from '../utils/Result.js'
import { ExternalApiError, AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'
import { ImageService } from './ImageService.js'

interface ChampionData {
  [key: string]: {
    id: string
    key: string
    name: string
    title: string
    // Add other champion fields as needed
  }
}

interface ItemData {
  [key: string]: {
    name: string
    description: string
    // Add other item fields as needed
  }
}

interface RuneData {
  id: number
  key: string
  name: string
  // Add other rune fields as needed
}

interface SummonerSpellData {
  [key: string]: {
    id: string
    name: string
    description: string
    // Add other spell fields as needed
  }
}

export class DataDragonService {
  private readonly api: AxiosInstance
  private readonly baseUrl = 'https://ddragon.leagueoflegends.com/cdn'
  private readonly dataDir: string
  private readonly imageService: ImageService

  constructor(
    dataDir: string = join(process.cwd(), 'data', 'game'),
    imagesDir: string = join(process.cwd(), 'data', 'images')
  ) {
    this.dataDir = dataDir
    this.imageService = new ImageService(imagesDir)
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'Lelanation/1.0'
      }
    })
  }

  /**
   * Get latest game version from Data Dragon API
   */
  async getLatestVersion(): Promise<Result<string, AppError>> {
    try {
      // Data Dragon returns a JSON array of version strings (e.g. ["15.1.1", ...])
      const response = await this.api.get<string[]>(
        'https://ddragon.leagueoflegends.com/api/versions.json'
      )

      if (!response.data || response.data.length === 0) {
        return Result.err(
          new ExternalApiError('No versions found in Data Dragon API')
        )
      }

      // Latest version is first in the array
      const latestVersion = response.data[0]
      if (!latestVersion || typeof latestVersion !== 'string') {
        return Result.err(
          new ExternalApiError('Invalid versions payload from Data Dragon API')
        )
      }
      return Result.ok(latestVersion)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return Result.err(
          new ExternalApiError(
            `Failed to fetch version: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(
        new ExternalApiError('Failed to fetch version', undefined, error)
      )
    }
  }

  /**
   * Fetch champions data for a specific version and language
   */
  async fetchChampions(
    version: string,
    language: string = 'fr_FR'
  ): Promise<Result<ChampionData, AppError>> {
    try {
      const url = `/${version}/data/${language}/champion.json`
      const response = await this.api.get<{ data: ChampionData }>(url)

      if (!response.data || !response.data.data) {
        return Result.err(
          new ExternalApiError('Invalid champions data from Data Dragon API')
        )
      }

      return Result.ok(response.data.data)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Handle rate limiting (429)
        if (error.response?.status === 429) {
          return Result.err(
            new ExternalApiError(
              'Rate limit exceeded. Please retry later.',
              429,
              error
            )
          )
        }
        return Result.err(
          new ExternalApiError(
            `Failed to fetch champions: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(
        new ExternalApiError('Failed to fetch champions', undefined, error)
      )
    }
  }

  /**
   * Fetch items data for a specific version and language
   */
  async fetchItems(
    version: string,
    language: string = 'fr_FR'
  ): Promise<Result<ItemData, AppError>> {
    try {
      const url = `/${version}/data/${language}/item.json`
      const response = await this.api.get<{ data: ItemData }>(url)

      if (!response.data || !response.data.data) {
        return Result.err(
          new ExternalApiError('Invalid items data from Data Dragon API')
        )
      }

      return Result.ok(response.data.data)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          return Result.err(
            new ExternalApiError(
              'Rate limit exceeded. Please retry later.',
              429,
              error
            )
          )
        }
        return Result.err(
          new ExternalApiError(
            `Failed to fetch items: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(
        new ExternalApiError('Failed to fetch items', undefined, error)
      )
    }
  }

  /**
   * Fetch runes data for a specific version and language
   */
  async fetchRunes(
    version: string,
    language: string = 'fr_FR'
  ): Promise<Result<RuneData[], AppError>> {
    try {
      const url = `/${version}/data/${language}/runesReforged.json`
      const response = await this.api.get<RuneData[]>(url)

      if (!response.data || !Array.isArray(response.data)) {
        return Result.err(
          new ExternalApiError('Invalid runes data from Data Dragon API')
        )
      }

      return Result.ok(response.data)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          return Result.err(
            new ExternalApiError(
              'Rate limit exceeded. Please retry later.',
              429,
              error
            )
          )
        }
        return Result.err(
          new ExternalApiError(
            `Failed to fetch runes: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(
        new ExternalApiError('Failed to fetch runes', undefined, error)
      )
    }
  }

  /**
   * Fetch summoner spells data for a specific version and language
   */
  async fetchSummonerSpells(
    version: string,
    language: string = 'fr_FR'
  ): Promise<Result<SummonerSpellData, AppError>> {
    try {
      const url = `/${version}/data/${language}/summoner.json`
      const response = await this.api.get<{ data: SummonerSpellData }>(url)

      if (!response.data || !response.data.data) {
        return Result.err(
          new ExternalApiError('Invalid summoner spells data from Data Dragon API')
        )
      }

      return Result.ok(response.data.data)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          return Result.err(
            new ExternalApiError(
              'Rate limit exceeded. Please retry later.',
              429,
              error
            )
          )
        }
        return Result.err(
          new ExternalApiError(
            `Failed to fetch summoner spells: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(
        new ExternalApiError('Failed to fetch summoner spells', undefined, error)
      )
    }
  }

  /**
   * Save game data to local JSON files
   */
  async saveGameData(
    version: string,
    champions: ChampionData,
    items: ItemData,
    runes: RuneData[],
    summonerSpells: SummonerSpellData,
    language: string = 'fr_FR'
  ): Promise<Result<void, AppError>> {
    const versionDir = join(this.dataDir, version, language)

    // Save champions
    const championsPath = join(versionDir, 'champion.json')
    const championsResult = await FileManager.writeJson(championsPath, {
      data: champions
    })
    if (championsResult.isErr()) {
      return championsResult
    }

    // Save items
    const itemsPath = join(versionDir, 'item.json')
    const itemsResult = await FileManager.writeJson(itemsPath, {
      data: items
    })
    if (itemsResult.isErr()) {
      return itemsResult
    }

    // Save runes
    const runesPath = join(versionDir, 'runesReforged.json')
    const runesResult = await FileManager.writeJson(runesPath, runes)
    if (runesResult.isErr()) {
      return runesResult
    }

    // Save summoner spells
    const spellsPath = join(versionDir, 'summoner.json')
    const spellsResult = await FileManager.writeJson(spellsPath, {
      data: summonerSpells
    })
    if (spellsResult.isErr()) {
      return spellsResult
    }

    return Result.ok(undefined)
  }

  /**
   * Synchronize all game data for a specific version
   */
  async syncGameData(
    version?: string,
    languages: string[] = ['fr_FR', 'en_US'],
    downloadImages: boolean = true
  ): Promise<Result<{ version: string; syncedAt: Date }, AppError>> {
    // Get version if not provided
    let gameVersion = version
    if (!gameVersion) {
      const versionResult = await this.getLatestVersion()
      if (versionResult.isErr()) {
        return Result.err(versionResult.unwrapErr())
      }
      gameVersion = versionResult.unwrap()
    }

    // Use first language for image downloads (images are language-agnostic)
    const primaryLanguage = languages[0] || 'fr_FR'

    // Sync for each language
    for (const language of languages) {
      // Fetch all data
      const [championsResult, itemsResult, runesResult, spellsResult] =
        await Promise.all([
          this.fetchChampions(gameVersion, language),
          this.fetchItems(gameVersion, language),
          this.fetchRunes(gameVersion, language),
          this.fetchSummonerSpells(gameVersion, language)
        ])

      // Check for errors
      if (championsResult.isErr()) {
        return Result.err(championsResult.unwrapErr())
      }
      if (itemsResult.isErr()) {
        return Result.err(itemsResult.unwrapErr())
      }
      if (runesResult.isErr()) {
        return Result.err(runesResult.unwrapErr())
      }
      if (spellsResult.isErr()) {
        return Result.err(spellsResult.unwrapErr())
      }

      // Save data
      const saveResult = await this.saveGameData(
        gameVersion,
        championsResult.unwrap(),
        itemsResult.unwrap(),
        runesResult.unwrap(),
        spellsResult.unwrap(),
        language
      )

      if (saveResult.isErr()) {
        return Result.err(saveResult.unwrapErr())
      }
    }

    // Download images if requested (only once, using primary language data)
    if (downloadImages) {
      console.log(`[DataDragon] Downloading images for version ${gameVersion}...`)

      // Delete existing images for this version to ensure fresh download
      const deleteResult = await this.imageService.deleteVersionImages(gameVersion)
      if (deleteResult.isErr()) {
        console.warn(
          `[DataDragon] Failed to delete existing images for version ${gameVersion}: ${deleteResult.unwrapErr()}`
        )
        // Continue anyway - we'll overwrite during download
      }

      // Delete old version images to save disk space (keep only current version)
      const deleteOldResult = await this.imageService.deleteOldVersionImages(gameVersion)
      if (deleteOldResult.isOk()) {
        const deleted = deleteOldResult.unwrap()
        if (deleted.deleted > 0) {
          console.log(
            `[DataDragon] Deleted ${deleted.deleted} old version image directories`
          )
        }
      } else {
        console.warn(
          `[DataDragon] Failed to delete old version images: ${deleteOldResult.unwrapErr()}`
        )
        // Continue anyway - not critical
      }

      // Fetch full champion data for images (need spells and passive)
      const championsFullResult = await this.fetchChampionsFull(
        gameVersion,
        primaryLanguage
      )
      const championsResult = await this.fetchChampions(gameVersion, primaryLanguage)
      const itemsResult = await this.fetchItems(gameVersion, primaryLanguage)
      const runesResult = await this.fetchRunes(gameVersion, primaryLanguage)
      const spellsResult = await this.fetchSummonerSpells(gameVersion, primaryLanguage)

      if (
        championsFullResult.isErr() ||
        championsResult.isErr() ||
        itemsResult.isErr() ||
        runesResult.isErr() ||
        spellsResult.isErr()
      ) {
        console.warn('[DataDragon] Failed to fetch data for image download, skipping images')
      } else {
        // Download images in parallel
        // Type assertions needed because DataDragon API returns partial data
        // We use 'as unknown as' to safely cast since we know the actual API response includes image fields
        const championsData = championsResult.unwrap() as unknown as Record<
          string,
          { id: string; image: { full: string } }
        >
        const itemsData = itemsResult.unwrap() as unknown as Record<
          string,
          { id: string; image: { full: string } }
        >
        const runesData = runesResult.unwrap() as unknown as Array<{
          id: number
          icon: string
          slots: Array<{
            runes: Array<{ id: number; icon: string }>
          }>
        }>
        const spellsData = spellsResult.unwrap() as unknown as Record<
          string,
          { id: string; image: { full: string } }
        >

        const [
          championsImagesResult,
          itemsImagesResult,
          runesImagesResult,
          spellsImagesResult,
          championSpellsImagesResult
        ] = await Promise.allSettled([
          this.imageService.downloadChampionImages(gameVersion, championsData),
          this.imageService.downloadItemImages(gameVersion, itemsData),
          this.imageService.downloadRuneImages(gameVersion, runesData),
          this.imageService.downloadSummonerSpellImages(gameVersion, spellsData),
          this.imageService.downloadChampionSpellImages(
            gameVersion,
            championsFullResult.unwrap()
          )
        ])

        // Log results (don't fail sync if images fail)
        const logResult = (name: string, result: PromiseSettledResult<any>) => {
          if (result.status === 'fulfilled' && result.value.isOk()) {
            const stats = result.value.unwrap()
            console.log(
              `[DataDragon] ${name} images: ${stats.downloaded} downloaded, ${stats.skipped} skipped`
            )
          } else {
            console.warn(`[DataDragon] ${name} images download failed or had errors`)
          }
        }

        logResult('Champions', championsImagesResult)
        logResult('Items', itemsImagesResult)
        logResult('Runes', runesImagesResult)
        logResult('Summoner spells', spellsImagesResult)
        logResult('Champion spells', championSpellsImagesResult)
      }
    }

    return Result.ok({
      version: gameVersion,
      syncedAt: new Date()
    })
  }

  /**
   * Fetch full champions data (including spells and passive) for image downloading
   */
  private async fetchChampionsFull(
    version: string,
    language: string = 'fr_FR'
  ): Promise<Result<Record<string, any>, AppError>> {
    try {
      const url = `/${version}/data/${language}/championFull.json`
      const response = await this.api.get<{ data: Record<string, any> }>(url)

      if (!response.data || !response.data.data) {
        return Result.err(
          new ExternalApiError('Invalid champions full data from Data Dragon API')
        )
      }

      return Result.ok(response.data.data)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          return Result.err(
            new ExternalApiError(
              'Rate limit exceeded. Please retry later.',
              429,
              error
            )
          )
        }
        return Result.err(
          new ExternalApiError(
            `Failed to fetch champions full: ${error.message}`,
            error.response?.status,
            error
          )
        )
      }
      return Result.err(
        new ExternalApiError('Failed to fetch champions full', undefined, error)
      )
    }
  }
}
