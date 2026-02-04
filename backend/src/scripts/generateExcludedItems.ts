import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { join } from 'path'
import { DiscordService } from '../services/DiscordService.js'

/**
 * Script to generate a JSON file listing items to exclude from item.json
 * Based on a whitelist of allowed item IDs
 */

// Whitelist of allowed item IDs (from the user's list - extracted from items/XXX.png paths)
const ALLOWED_ITEM_IDS = new Set([
  '1082', '1056', '3070', '3865', '1054', '1055', '1083', '1101', '1102', '1103', '1004', '1042', '2022', '1006', '1027', '1029', '1036', '1028', '1033', '1052', '1018', '1026', '1037', '1058', '1038', '2422', '1001', '3158', '3171', '3009', '3170', '3006', '3020', '3172', '3175', '3047', '3174', '3111', '3173', '3866', '3114', '3144', '1043', '6690', '1031', '3066', '3067', '3076', '3123', '3801', '3916', '1057', '3108', '1011', '1053', '2508', '3024', '3057', '3113', '4642', '6660', '3082', '3134', '3133', '2019', '3044', '3145', '4630', '2021', '3051', '3077', '3086', '3802', '3211', '3140', '3147', '3155', '3803', '6670', '2020', '3035', '2420', '4632', '3867', '3869', '3870', '3871', '3876', '3877', '3041', '2065', '3050', '3190', '3504', '6617', '6620', '2526', '2530', '4005', '6616', '2524', '3107', '3109', '3222', '3002', '3119', '3121', '3075', '2525', '3110', '6621', '6695', '3116', '6657', '2512', '3046', '3085', '3094', '3152', '6675', '8020', '3065', '3068', '3087', '3118', '3143', '4628', '6701', '6655', '6696', '2502', '2503', '2523', '3091', '3142', '3179', '4401', '4646', '6664', '3165', '6698', '2504', '3003', '3004', '3040', '3042', '3100', '3115', '3742', '6662', '6692', '8010', '2517', '3033', '3071', '3073', '3084', '3102', '3124', '3135', '3137', '3146', '3181', '3302', '3814', '4629', '6653', '6672', '6673', '6676', '6694', '6697', '6699', '3508', '2510', '2522', '3032', '3083', '3156', '3161', '4633', '6609', '6610', '2520', '3026', '3053', '3097', '3139', '3153', '4645', '6665', '3157', '2501', '3036', '3074', '3748', '6333', '6631', '3078', '3072', '3031', '3089',
])

const EXCLUDED_ITEM_IDS = new Set([
  '2003', '2055', '2031', '667112', '667101', '664011', '663172', '663064',
  '663060', '663058', '663056', '663039', '2051', '3112', '3177', '3184', 
])

interface ItemData {
  name: string
  description: string
  colloq?: string
  plaintext?: string
  into?: string[]
  image?: {
    full: string
    sprite: string
    group: string
    x: number
    y: number
    w: number
    h: number
  }
  gold?: {
    base: number
    purchasable: boolean
    total: number
    sell: number
  }
  tags?: string[]
  maps?: Record<string, boolean>
  stats?: Record<string, number>
}

interface ItemJson {
  data: Record<string, ItemData>
}

interface ExcludedItem {
  id: string
  name: string
  reason: 'blacklist' | 'not_in_whitelist' | 'new_item'
}

/**
 * Generate excluded items JSON
 */
async function generateExcludedItems(
  itemJsonPath: string,
  outputPath: string
): Promise<{ excludedCount: number; allowedCount: number; totalCount: number }> {
  console.log(`Reading items from: ${itemJsonPath}`)

  if (!fs.existsSync(itemJsonPath)) {
    console.error(`File not found: ${itemJsonPath}`)
    throw new Error(`File not found: ${itemJsonPath}`)
  }

  const fileContent = fs.readFileSync(itemJsonPath, 'utf-8')
  const data: ItemJson = JSON.parse(fileContent)

  if (!data.data || typeof data.data !== 'object') {
    console.error(`Invalid JSON structure in ${itemJsonPath}`)
    throw new Error(`Invalid JSON structure in ${itemJsonPath}`)
  }

  const excludedItems: ExcludedItem[] = []
  const allItemIds = Object.keys(data.data)

  console.log(`Total items in item.json: ${allItemIds.length}`)
  console.log(`Items in whitelist: ${ALLOWED_ITEM_IDS.size}`)

  // Find all items that are NOT in the whitelist
  for (const itemId of allItemIds) {
    if (!ALLOWED_ITEM_IDS.has(itemId)) {
      const item = data.data[itemId]
      excludedItems.push({
        id: itemId,
        name: item.name || 'Unknown',
        reason: 'not_in_whitelist',
      })
    }
  }

  // Sort by ID for easier reading
  excludedItems.sort((a, b) => a.id.localeCompare(b.id))

  // Create output structure
  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalItemsInJson: allItemIds.length,
      whitelistSize: ALLOWED_ITEM_IDS.size,
      blacklistSize: EXCLUDED_ITEM_IDS.size,
      excludedCount: excludedItems.length,
      description:
        'Items to exclude from item.json. Items in blacklist are always excluded, and new items not in whitelist will be automatically excluded.',
    },
    excludedItems: excludedItems,
    // Also provide as a simple array of IDs for easy filtering
    excludedIds: excludedItems.map((item) => item.id),
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write output file
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8')

  console.log(`\n✓ Generated excluded items file: ${outputPath}`)
  console.log(`  Excluded items: ${excludedItems.length}`)
  console.log(`  - Blacklisted: ${excludedItems.filter(i => i.reason === 'blacklist').length}`)
  console.log(`  - Not in whitelist: ${excludedItems.filter(i => i.reason === 'not_in_whitelist').length}`)
  console.log(`  Allowed items: ${ALLOWED_ITEM_IDS.size}`)
  console.log(`  Total items: ${allItemIds.length}`)

  return {
    excludedCount: excludedItems.length,
    allowedCount: ALLOWED_ITEM_IDS.size,
    totalCount: allItemIds.length,
  }
}

// Main execution
async function main() {
  const startTime = new Date()
  console.log('[Generate Excluded Items] Starting...')

  const discordService = new DiscordService()
  // await discordService.sendSuccess(
  //   '🔄 Generate Excluded Items Started',
  //   'Generating excluded items JSON file',
  //   {
  //     startedAt: startTime.toISOString(),
  //   }
  // )

  const version = '16.2.1'
  const basePath = join(process.cwd(), '..', 'frontend', 'public', 'data', 'game', version)

  const frItemPath = join(basePath, 'fr_FR', 'item.json')
  const outputPath = join(process.cwd(), 'data', 'excluded-items.json')

  if (!fs.existsSync(frItemPath)) {
    const err = new Error(`French item.json not found: ${frItemPath}`)
    console.error(err.message)
    console.error('Please ensure the file exists before running this script.')
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await discordService.sendAlert(
      '❌ Generate Excluded Items - File Not Found',
      'Failed to find item.json file',
      err,
      {
        filePath: frItemPath,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      }
    )
    process.exit(1)
  }

  try {
    const stats = await generateExcludedItems(frItemPath, outputPath)

    // Send success notification
    // const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    // await discordService.sendSuccess(
    //   '✅ Generate Excluded Items Completed Successfully',
    //   'Excluded items JSON file generated successfully',
    //   {
    //     excludedItems: stats.excludedCount,
    //     allowedItems: stats.allowedCount,
    //     totalItems: stats.totalCount,
    //     outputPath: outputPath,
    //     duration: `${duration}s`,
    //     timestamp: new Date().toISOString(),
    //   }
    // )

    console.log(`\n✓ Script completed! Excluded items: ${stats.excludedCount}`)
  } catch (error) {
    const duration = Math.round((new Date().getTime() - startTime.getTime()) / 1000)
    await discordService.sendAlert(
      '❌ Generate Excluded Items Failed',
      'Failed to generate excluded items JSON file',
      error,
      {
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
      }
    )
    throw error
  }
}

main().catch((error) => {
  console.error('[Generate Excluded Items] Fatal error:', error)
  process.exit(1)
})
