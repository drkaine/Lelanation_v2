import axios, { AxiosInstance } from 'axios'
import { join } from 'path'
import { Result } from '../utils/Result.js'
import { ExternalApiError, AppError } from '../utils/errors.js'
import { FileManager } from '../utils/fileManager.js'
import { ImageService } from './ImageService.js'
import { CommunityDragonOrnnService } from './CommunityDragonOrnnService.js'

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
   * Filters items to only include those available on Summoner's Rift (map 11),
   * purchasable, with cost > 0, and excludes items from excluded-items.json
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

      // Load excluded items from excluded-items.json
      let excludedItemIds = new Set<string>()
      const excludedItemsPath = join(process.cwd(), 'data', 'excluded-items.json')
      const excludedItemsResult = await FileManager.readJson<{
        excludedIds: string[]
      }>(excludedItemsPath)
      
      if (excludedItemsResult.isOk()) {
        excludedItemIds = new Set(excludedItemsResult.unwrap().excludedIds)
        console.log(
          `[DataDragon] Loaded ${excludedItemIds.size} excluded item IDs from excluded-items.json`
        )
      } else {
        console.warn(
          `[DataDragon] Could not load excluded-items.json: ${excludedItemsResult.unwrapErr().message}. Continuing without exclusion list.`
        )
      }

      // Items to exclude from selection (by name - legacy filter)
      const FILTERED_ITEMS = [
        'Oracle Lens',
        'Farsight Alteration',
        'Stealth Ward',
        'Your Cut',
        'Ardent Censer',
        "Mikael's Blessing",
        'Redemption',
        "Staff of Flowing Water",
        "Shurelya's Battlesong",
        'Moonstone Renewer',
        'Chemtech Putrifier',
      ]

      // Filter items
      const allItems = response.data.data
      const filteredItems: ItemData = {}
      const seenNames = new Set<string>()

      for (const [itemId, item] of Object.entries(allItems)) {
        // Check if item should be included
        const itemData = item as any
        
        // Skip if item ID is in excluded list
        if (excludedItemIds.has(itemId)) {
          continue
        }

        if (
          itemData.maps?.['11'] === true &&
          itemData.gold?.purchasable === true &&
          itemData.gold?.total > 0 &&
          !FILTERED_ITEMS.includes(itemData.name)
        ) {
          // Deduplicate by name
          if (!seenNames.has(itemData.name)) {
            seenNames.add(itemData.name)
            filteredItems[itemId] = item
          }
        }
      }

      console.log(
        `[DataDragon] Filtered items: ${Object.keys(filteredItems).length} items (excluded ${excludedItemIds.size} by ID)`
      )

      return Result.ok(filteredItems)
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
   * Filters spells to only include those available in CLASSIC mode
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

      // Filter spells to only include those available in CLASSIC mode
      const allSpells = response.data.data
      const filteredSpells: SummonerSpellData = {}

      for (const [spellId, spell] of Object.entries(allSpells)) {
        const spellData = spell as any
        if (spellData.modes && Array.isArray(spellData.modes) && spellData.modes.includes('CLASSIC')) {
          filteredSpells[spellId] = spell
        }
      }

      return Result.ok(filteredSpells)
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
    championsFull: Record<string, any>,
    items: ItemData,
    runes: RuneData[],
    summonerSpells: SummonerSpellData,
    language: string = 'fr_FR'
  ): Promise<Result<void, AppError>> {
    const versionDir = join(this.dataDir, version, language)

    // Single source: championFull only (champion.json removed; merge step overlays CD later)
    const championsFullPath = join(versionDir, 'championFull.json')
    const championsFullResult = await FileManager.writeJson(championsFullPath, {
      data: championsFull
    })
    if (championsFullResult.isErr()) {
      return championsFullResult
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

    // Sync for each language (single champion source: championFull only)
    for (const language of languages) {
      const [championsFullResult, itemsResult, runesResult, spellsResult] = await Promise.all([
        this.fetchChampionsFull(gameVersion, language),
        this.fetchItems(gameVersion, language),
        this.fetchRunes(gameVersion, language),
        this.fetchSummonerSpells(gameVersion, language)
      ])

      if (championsFullResult.isErr()) {
        return Result.err(championsFullResult.unwrapErr())
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

      const saveResult = await this.saveGameData(
        gameVersion,
        championsFullResult.unwrap(),
        itemsResult.unwrap(),
        runesResult.unwrap(),
        spellsResult.unwrap(),
        language
      )

      if (saveResult.isErr()) {
        return Result.err(saveResult.unwrapErr())
      }
    }

    // Enrich items with Ornn Masterwork items from Community Dragon
    const ornnService = new CommunityDragonOrnnService(
      join(process.cwd(), 'data', 'images')
    )
    const localeMap: Record<string, string> = {
      fr_FR: 'fr_fr',
      en_US: 'default',
    }
    let allIconUrls: Array<{ url: string; filename: string }> = []
    for (const language of languages) {
      const versionDir = join(this.dataDir, gameVersion, language)
      const itemsPath = join(versionDir, 'item.json')
      const readResult = await FileManager.readJson<{ data: Record<string, unknown> }>(
        itemsPath
      )
      if (readResult.isErr()) continue

      const itemJson = readResult.unwrap()
      if (!itemJson?.data || typeof itemJson.data !== 'object') continue

      const cdLocale = localeMap[language] ?? 'default'
      const fetchResult = await ornnService.fetchCommunityDragonItems(cdLocale)
      if (fetchResult.isErr()) {
        console.warn(
          `[DataDragon] Ornn masterwork fetch failed for ${language}:`,
          fetchResult.unwrapErr().message
        )
        continue
      }

      const { items: masterworkItems, iconUrls } = ornnService.extractMasterworkItems(
        fetchResult.unwrap()
      )
      if (allIconUrls.length === 0 && iconUrls.length > 0) {
        allIconUrls = iconUrls
      }

      let added = 0
      for (const mw of masterworkItems) {
        const baseExists = !mw.baseItemId || mw.baseItemId in itemJson.data
        if (baseExists && !(mw.id in itemJson.data)) {
          ;(itemJson.data as Record<string, unknown>)[mw.id] = mw
          added++
        }
      }

      if (added > 0) {
        await FileManager.writeJson(itemsPath, itemJson)
        console.log(
          `[DataDragon] Added ${added} Ornn masterwork items to ${language}`
        )
      }
    }
    if (allIconUrls.length > 0) {
      const dlResult = await ornnService.downloadOrnnIcons(allIconUrls)
      if (dlResult.isOk()) {
        const stats = dlResult.unwrap()
        console.log(
          `[DataDragon] Ornn icons: ${stats.downloaded} downloaded, ${stats.skipped} skipped`
        )
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

      // Fetch data for images (champion list from championFull)
      const championsFullResult = await this.fetchChampionsFull(
        gameVersion,
        primaryLanguage
      )
      const itemsResult = await this.fetchItems(gameVersion, primaryLanguage)
      const runesResult = await this.fetchRunes(gameVersion, primaryLanguage)
      const spellsResult = await this.fetchSummonerSpells(gameVersion, primaryLanguage)

      if (
        championsFullResult.isErr() ||
        itemsResult.isErr() ||
        runesResult.isErr() ||
        spellsResult.isErr()
      ) {
        console.warn('[DataDragon] Failed to fetch data for image download, skipping images')
      } else {
        const championsFullData = championsFullResult.unwrap()
        const championsData = championsFullData as unknown as Record<
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
            championsFullData
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
   * Fetch full champions data (including spells and passive)
   * Removes unnecessary fields: skins, lore, blurb, allytips, enemytips
   */
  async fetchChampionsFull(
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

      // Clean up champions data: remove unnecessary fields
      const cleanedData: Record<string, any> = {}
      for (const [championId, championData] of Object.entries(response.data.data)) {
        const cleaned: any = { ...championData }
        // Remove fields we don't need
        delete cleaned.skins
        delete cleaned.lore
        delete cleaned.blurb
        delete cleaned.allytips
        delete cleaned.enemytips
        cleanedData[championId] = cleaned
      }

      return Result.ok(cleanedData)
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
