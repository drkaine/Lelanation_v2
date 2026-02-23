<!-- eslint-disable vue/no-v-html -- spell/description from game data -->
<template>
  <div class="build-card-wrapper">
    <div class="build-card">
      <!-- Version (top right) -->
      <div class="build-version">{{ version }}</div>

      <!-- Bouton Reset (seulement si pas en mode readonly) -->
      <button
        v-if="!readonly"
        class="reset-button"
        title="Réinitialiser la sheet"
        @click="resetBuild"
      >
        <Icon name="mdi:refresh" size="16px" />
      </button>

      <!-- Roles Section - Entre la version et le séparateur -->
      <div class="roles-section">
        <div class="roles-container">
          <button
            v-for="role in allRoles"
            :key="role"
            type="button"
            :class="[
              'role-icon',
              selectedRoles.includes(role) ? 'role-selected' : 'role-unselected',
            ]"
            :title="getRoleName(role)"
            :disabled="readonly"
            @click="!readonly && toggleRole(role)"
          >
            <img
              :src="`/icons/roles/${role === 'adc' ? 'bot' : role}.png`"
              :alt="getRoleName(role)"
              class="role-image"
            />
          </button>
        </div>
      </div>

      <!-- Champion Section (Top) - Toujours visible -->
      <div class="champion-section">
        <!-- Portrait en forme de losange -->
        <div class="champion-portrait-container">
          <img
            v-if="selectedChampion"
            :src="getChampionImageUrl(versionForImages, selectedChampion.image.full)"
            :alt="selectedChampion.name"
            class="champion-portrait"
            @mouseenter="onChampionMouseEnter"
            @mouseleave="onChampionMouseLeave"
          />
          <div v-else class="champion-portrait-placeholder"></div>
        </div>

        <!-- Nom du champion en majuscules -->
        <h2 class="champion-name">
          {{ selectedChampion ? selectedChampion.name.toUpperCase() : '' }}
        </h2>

        <!-- Sorts d'invocateur (juste sous le nom) - Toujours visible -->
        <div class="summoner-spells-row">
          <template v-for="(spell, index) in filteredSummonerSpells" :key="index">
            <img
              v-if="spell"
              :src="getSpellImageUrl(versionForImages, spell.image.full)"
              :alt="spell.name"
              class="summoner-spell-icon"
              :title="sheetTooltip(spell?.name, 'Summoner Spell')"
            />
          </template>
          <div
            v-for="n in 2 - filteredSummonerSpells.length"
            :key="`empty-${n}`"
            class="summoner-spell-placeholder"
          ></div>
        </div>

        <!-- Ligne de séparation -->
        <div class="separator-line"></div>
      </div>

      <!-- Runes Section - Toujours visible -->
      <div class="runes-section">
        <div class="runes-container">
          <!-- Keystone (grande icône à gauche) - première rune principale -->
          <div class="keystone-container">
            <img
              v-if="keystoneRuneId"
              :src="getRuneIconById(keystoneRuneId)"
              alt="Keystone"
              class="keystone-icon"
              :title="sheetTooltip(keystoneRuneId ? getRuneNameById(keystoneRuneId) : '', 'Rune')"
            />
            <div v-else class="keystone-placeholder"></div>
          </div>

          <!-- Runes principales et secondaires -->
          <div class="runes-main">
            <!-- Runes principales (3 horizontales) - Toujours visible -->
            <div class="primary-runes-row">
              <img
                v-for="(runeId, index) in primaryRunesRow"
                :key="index"
                :src="getRuneIconById(runeId)"
                :alt="`Rune ${index + 1}`"
                class="primary-rune-icon"
                :title="sheetTooltip(runeId ? getRuneNameById(runeId) : '', 'Rune')"
              />
              <div
                v-for="n in 3 - primaryRunesRow.length"
                :key="`empty-primary-${n}`"
                class="primary-rune-placeholder"
              ></div>
            </div>

            <!-- Runes secondaires (path icon + 2 runes horizontales en dessous) - Toujours visible -->
            <div class="secondary-runes-row">
              <!-- Icône du path secondaire -->
              <img
                v-if="secondaryPathIcon"
                :src="secondaryPathIcon"
                :alt="secondaryPathName"
                class="secondary-path-icon"
                :title="sheetTooltip(secondaryPathName, 'Secondary Path')"
              />
              <div v-else class="secondary-path-placeholder"></div>
              <!-- Runes secondaires -->
              <img
                v-for="(runeId, index) in filteredSecondaryRuneIds"
                :key="index"
                :src="getRuneIconById(runeId)"
                :alt="`Secondary Rune ${index + 1}`"
                class="secondary-rune-icon"
                :title="sheetTooltip(runeId ? getRuneNameById(runeId) : '', 'Rune')"
              />
              <div
                v-for="n in 2 - filteredSecondaryRuneIds.length"
                :key="`empty-secondary-${n}`"
                class="secondary-rune-placeholder"
              ></div>
            </div>
          </div>
        </div>

        <!-- Shards collés au bord droit, dans la même zone que les runes - Toujours visible -->
        <div class="shards-strip">
          <img
            v-for="(shardId, index) in filteredShardIds"
            :key="index"
            :src="getShardIconById(shardId)"
            :alt="`Shard ${index + 1}`"
            class="shard-icon-strip"
            :title="sheetTooltip(shardId ? getShardNameById(shardId) : '', 'Shard')"
          />
          <div
            v-for="n in 3 - filteredShardIds.length"
            :key="`empty-shard-${n}`"
            class="shard-placeholder"
          ></div>
        </div>
      </div>

      <!-- Séparateur entre runes et items - Toujours visible -->
      <div class="separator-line"></div>

      <!-- Items Section - Toujours visible -->
      <div class="items-section">
        <!-- Starting Items (2) + Boots slot (1) - Toujours visible -->
        <div class="starting-items-row">
          <div v-for="item in startingItems" :key="`starter-${item.id}`" class="item-wrapper">
            <img
              :src="getItemImageUrl(versionForImages, item.image.full)"
              :alt="item.name"
              class="item-icon"
              :title="sheetTooltip(item?.name, 'Item')"
            />
          </div>
          <div
            v-for="n in 2 - startingItems.length"
            :key="`empty-starting-${n}`"
            class="item-placeholder"
          ></div>

          <!-- Boots slot (always shown) -->
          <div class="boots-slot">
            <!-- Une seule paire de bottes : icône complète -->
            <img
              v-if="bootsItems.length === 1 && bootsItems[0]"
              :src="getItemImageUrl(versionForImages, bootsItems[0].image.full)"
              :alt="bootsItems[0].name"
              class="boots-icon-single"
              :title="sheetTooltip(bootsItems[0]?.name, 'Boots')"
            />

            <!-- Deux paires de bottes : image recomposée en deux moitiés -->
            <template v-else-if="bootsItems.length >= 2">
              <div
                class="boots-item-split boots-item-left"
                :style="getBootBackgroundStyle(bootsItems[0])"
                :title="sheetTooltip(bootsItems[0]?.name, 'Boots')"
              ></div>
              <div
                class="boots-item-split boots-item-right"
                :style="getBootBackgroundStyle(bootsItems[1])"
                :title="sheetTooltip(bootsItems[1]?.name, 'Boots')"
              ></div>
            </template>

            <div v-if="bootsItems.length === 0" class="item-placeholder"></div>
          </div>
        </div>

        <!-- Core Items Paths - Toujours visible -->
        <div class="core-items-paths">
          <!-- Path 1 (3 items avec flèches) -->
          <div class="items-path">
            <template v-for="(item, index) in coreItemsPath1" :key="`path1-${item.id}`">
              <div class="item-wrapper">
                <img
                  :src="getItemImageUrl(versionForImages, item.image.full)"
                  :alt="item.name"
                  class="item-icon"
                  :title="sheetTooltip(item?.name, 'Item')"
                />
              </div>
              <span v-if="index < coreItemsPath1.length - 1" class="arrow-right">→</span>
            </template>
            <template
              v-for="(n, idx) in Array(Math.max(0, 3 - coreItemsPath1.length)).fill(0)"
              :key="`empty-path1-${idx}`"
            >
              <span v-if="idx === 0 && coreItemsPath1.length > 0" class="arrow-right">→</span>
              <div class="item-placeholder"></div>
              <span v-if="idx < Math.max(0, 3 - coreItemsPath1.length - 1)" class="arrow-right"
                >→</span
              >
            </template>
          </div>

          <!-- Path 2 (3 items avec flèches) -->
          <div class="items-path">
            <template v-for="(item, index) in coreItemsPath2" :key="`path2-${item.id}`">
              <div class="item-wrapper">
                <img
                  :src="getItemImageUrl(versionForImages, item.image.full)"
                  :alt="item.name"
                  class="item-icon"
                  :title="sheetTooltip(item?.name, 'Item')"
                />
              </div>
              <span v-if="index < coreItemsPath2.length - 1" class="arrow-right">→</span>
            </template>
            <template
              v-for="(n, idx) in Array(Math.max(0, 3 - coreItemsPath2.length)).fill(0)"
              :key="`empty-path2-${idx}`"
            >
              <span v-if="idx === 0 && coreItemsPath2.length > 0" class="arrow-right">→</span>
              <div class="item-placeholder"></div>
              <span v-if="idx < Math.max(0, 3 - coreItemsPath2.length - 1)" class="arrow-right"
                >→</span
              >
            </template>
          </div>
        </div>
      </div>

      <!-- First Three Ups Section (Between items and skills) - Toujours visible -->
      <div class="first-three-ups-section">
        <div class="first-three-ups-vertical">
          <div
            v-for="(ability, index) in firstThreeUpsAbilities"
            :key="index"
            class="first-three-ups-item"
          >
            <div class="skill-icon-wrapper">
              <img
                :src="
                  getChampionSpellImageUrl(
                    versionForImages,
                    selectedChampion?.id || '',
                    ability.image.full
                  )
                "
                :alt="ability.name"
                class="skill-icon"
                :title="ability.name"
              />
              <span class="skill-key">
                {{ t(`skills.key.${ability.key}`) }}
              </span>
              <span class="level-badge">{{ index + 1 }}</span>
            </div>
            <span v-if="index < firstThreeUpsAbilities.length - 1" class="arrow-down">↓</span>
          </div>
          <div
            v-for="n in 3 - firstThreeUpsAbilities.length"
            :key="`empty-first-${n}`"
            class="first-three-ups-item"
          >
            <div class="skill-placeholder-wrapper">
              <div class="skill-placeholder"></div>
              <span class="level-badge">{{ firstThreeUpsAbilities.length + n }}</span>
            </div>
            <span v-if="n < 3 - firstThreeUpsAbilities.length" class="arrow-down">↓</span>
          </div>
        </div>
      </div>

      <!-- Skill Order Section (Right) - Toujours visible (même disposition que first three ups : clé sur l'image) -->
      <div class="skill-order-section">
        <div class="skill-order-vertical">
          <div
            v-for="(ability, index) in skillOrderAbilities"
            :key="index"
            class="skill-order-item"
          >
            <div class="skill-icon-wrapper">
              <img
                :src="
                  getChampionSpellImageUrl(
                    versionForImages,
                    selectedChampion?.id || '',
                    ability.image.full
                  )
                "
                :alt="ability.name"
                class="skill-icon"
                :title="ability.name"
              />
              <span class="skill-key">
                {{ t(`skills.key.${ability.key}`) }}
              </span>
            </div>
            <span v-if="index < skillOrderAbilities.length - 1" class="arrow-down">↓</span>
          </div>
          <div
            v-for="n in 3 - skillOrderAbilities.length"
            :key="`empty-skill-${n}`"
            class="skill-order-item"
          >
            <div class="skill-placeholder-wrapper">
              <div class="skill-placeholder"></div>
            </div>
            <span v-if="n < 3 - skillOrderAbilities.length" class="arrow-down">↓</span>
          </div>
        </div>
      </div>

      <!-- Lelanation (bottom left) -->
      <div class="build-footer">lelanation.fr</div>

      <!-- Tooltip -->
      <div
        v-if="showTooltip && selectedChampion"
        ref="tooltipRef"
        class="tooltip-box absolute z-50 rounded-lg border border-accent bg-background shadow-lg"
        :class="tooltipPositionClass"
      >
        <!-- Tooltip content (same as before) -->
        <div class="tooltip-top">
          <div class="tooltip-present">
            <img
              :src="getChampionImageUrl(versionForImages, selectedChampion.image.full)"
              :alt="selectedChampion.name"
              class="tooltip-champion-image"
            />
            <div class="tooltip-text">
              <div class="tooltip-champion-name">{{ selectedChampion.name }}</div>
              <div class="tooltip-champion-title">{{ selectedChampion.title }}</div>
            </div>
          </div>
          <div
            v-if="selectedChampion.tags && selectedChampion.tags.length > 0"
            class="tooltip-tags-container"
          >
            <div class="tooltip-tags">
              {{ translatedTags }}
            </div>
          </div>
        </div>

        <hr class="tooltip-separator" />

        <div class="tooltip-body">
          <div class="tooltip-spells">
            <div
              v-if="selectedChampion.passive && selectedChampion.passive.image"
              class="tooltip-spell"
            >
              <div class="tooltip-spell-img-container">
                <img
                  :src="
                    getChampionPassiveImageUrl(
                      versionForImages,
                      selectedChampion.passive.image.full
                    )
                  "
                  :alt="selectedChampion.passive.name"
                  class="tooltip-spell-img"
                />
              </div>
              <div class="tooltip-spell-content">
                <div class="tooltip-spell-name">Passive: {{ selectedChampion.passive.name }}</div>
                <div
                  v-if="formattedPassive"
                  class="tooltip-spell-description"
                  v-html="formattedPassive"
                />
              </div>
            </div>

            <div
              v-for="(spell, index) in formattedSpells"
              :key="spell.id || index"
              class="tooltip-spell"
            >
              <div v-if="spell && spell.image" class="tooltip-spell-wrapper">
                <div
                  class="tooltip-spell-img-container"
                  :data-spell-key="['Q', 'W', 'E', 'R'][index]"
                >
                  <img
                    :src="
                      getChampionSpellImageUrl(
                        versionForImages,
                        selectedChampion.id,
                        spell.image.full
                      )
                    "
                    :alt="spell.name"
                    class="tooltip-spell-img"
                  />
                </div>
                <div class="tooltip-spell-content">
                  <div class="tooltip-spell-name">
                    {{ ['Q', 'W', 'E', 'R'][index] }}: {{ spell.name }}
                  </div>
                  <div
                    v-if="spell.description"
                    class="tooltip-spell-description"
                    v-html="spell.description"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Items Manager (under the card): drag & drop, remove & reset items (seulement si pas readonly) -->
    <div v-if="!readonly" class="items-manager">
      <div class="items-manager-header">
        <div class="items-manager-title">{{ t('buildCard.itemsManagement') }}</div>
        <div class="items-manager-header-actions">
          <button
            class="items-stats-toggle-btn"
            type="button"
            @click="showItemStats = !showItemStats"
          >
            {{ showItemStats ? 'Masquer stats items' : 'Stats items' }}
          </button>
          <button class="items-reset-btn" type="button" @click="resetItemsOnly">
            {{ t('buildCard.resetItems') }}
          </button>
        </div>
      </div>
      <div v-if="buildItems.length === 0" class="items-manager-empty">
        {{ t('buildCard.noItems') }}
      </div>
      <div v-else>
        <div class="items-manager-inline">
          <template v-for="(item, index) in buildItems" :key="`${item.id}-${index}`">
            <img
              :src="getItemImageUrl(versionForImages, item.image.full)"
              :alt="item.name"
              class="items-manager-inline-icon"
              :title="getItemDisplayName(item)"
            />
            <span v-if="index < buildItems.length - 1" class="items-manager-inline-separator"
              >→</span
            >
          </template>
        </div>

        <div v-if="showItemStats" class="items-manager-stats">
          <p class="items-manager-stats-note">
            Stats des items (hors starters, et 1 seule botte prise en compte).
          </p>
          <div v-if="itemStatsRows.length === 0" class="items-manager-empty">
            Aucune stat item détectée
          </div>
          <div v-else class="items-manager-stats-grid">
            <div v-for="row in itemStatsRows" :key="row.key" class="items-manager-stats-row">
              <span class="items-manager-stats-label">{{ row.label }}</span>
              <span class="items-manager-stats-value">{{ row.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBuildStore } from '~/stores/BuildStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import {
  getChampionImageUrl,
  getChampionSpellImageUrl,
  getChampionPassiveImageUrl,
  getSpellImageUrl,
  getRunePathImageUrl,
  getRuneImageUrl,
  getItemImageUrl,
} from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'
import type { Build, Item, Role } from '~/types/build'

interface Props {
  build?: Build | null // Build optionnel - si non fourni, utilise currentBuild du store
  readonly?: boolean // Si true, désactive les interactions (bouton reset, toggle rôles, etc.)
  sheetTooltips?: boolean // Active les tooltips de la sheet (summoners/runes/shards/items)
}

const props = withDefaults(defineProps<Props>(), {
  build: null,
  readonly: false,
  sheetTooltips: false,
})

const buildStore = useBuildStore()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const { locale, t } = useI18n()

/** Nom d'affichage de l'item (résolu via le store pour éviter d'afficher l'id quand l'item n'a pas de nom) */
function getItemDisplayName(item: Item): string {
  const full = itemsStore.items.find(i => i.id === item.id)
  return full?.name ?? item.name ?? item.id
}

function sheetTooltip(label?: string | null, fallback = ''): string {
  if (!props.sheetTooltips) return ''
  return label?.trim() || fallback
}

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

const showTooltip = ref(false)
const tooltipRef = ref<HTMLElement | null>(null)
const tooltipPosition = ref<'right' | 'left'>('right')
const tooltipVerticalPosition = ref<'top' | 'bottom'>('top')

const onChampionMouseEnter = () => {
  showTooltip.value = true
}

const onChampionMouseLeave = () => {
  showTooltip.value = false
}

// Utiliser le build en prop si fourni, sinon le build courant du store
const displayBuild = computed(() => props.build || buildStore.currentBuild)

const selectedChampion = computed(() => {
  return displayBuild.value?.champion || null
})

const { version: defaultVersion } = useGameVersion()
// Version affichée (build ou courante)
const version = computed(() => displayBuild.value?.gameVersion || defaultVersion.value)
// Version pour les URLs d'images : toujours la version courante (assets disponibles côté serveur)
const versionForImages = defaultVersion

// Rôles
const allRoles: Role[] = ['top', 'jungle', 'mid', 'adc', 'support']
const selectedRoles = computed(() => displayBuild.value?.roles || [])

const getRoleName = (role: Role): string => {
  const names: Record<Role, string> = {
    top: 'Top',
    jungle: 'Jungle',
    mid: 'Mid',
    adc: 'ADC',
    support: 'Support',
  }
  return names[role]
}

const toggleRole = (role: Role) => {
  if (props.readonly || props.build) return // Ne pas modifier si readonly ou si build en prop
  const currentRoles = selectedRoles.value
  if (currentRoles.includes(role)) {
    // Retirer le rôle
    buildStore.setRoles(currentRoles.filter(r => r !== role))
  } else {
    // Ajouter le rôle
    buildStore.setRoles([...currentRoles, role])
  }
}

// Get selected runes, spells, and shards
const selectedPrimaryRunes = computed(() => displayBuild.value?.runes)
const selectedSecondaryRunes = computed(() => displayBuild.value?.runes)
const selectedSummonerSpells = computed(() => displayBuild.value?.summonerSpells || [])
const filteredSummonerSpells = computed(() => {
  return selectedSummonerSpells.value.filter(spell => spell !== null && spell !== undefined)
})
const selectedShards = computed(() => displayBuild.value?.shards)
const buildItems = computed(() => displayBuild.value?.items || [])
const showItemStats = ref(false)

// Helper to check if item is boots
const isBootsItem = (item: Item): boolean => {
  // Signal principal : tag "Boots"
  if (item.tags && item.tags.includes('Boots')) return true

  // Ensemble des IDs de bottes (cohérent avec ItemSelector)
  const bootIds = new Set([
    '1001', // Bottes
    '3005', // Bottes du vigilant
    '3006', // Jambières du berzerker
    '3009', // Bottes de célérité
    '3010', // Bottes de lucidité spéciales
    '3020', // Chaussures du sorcier
    '3047', // Coques en acier renforcé
    '3111', // Sandales de mercure
    '3117', // Bottes de mobilité
    '3158', // Bottes de lucidité
  ])

  if (bootIds.has(item.id)) return true

  // Les upgrades comme "Jambières de métal" héritent d'une botte dans `from`
  if (item.from && item.from.some(parentId => bootIds.has(parentId))) {
    return true
  }

  return false
}

const starterItemIds = new Set([
  '1036',
  '1054',
  '1055',
  '1056',
  '1082',
  '1083',
  '3070',
  '3865',
  '3866',
  '3867',
  '2003',
  '2009',
  '2010',
  '2031',
  '2032',
  '2033',
  '2055',
  '1101',
  '1102',
  '1103',
])
const starterNamePatterns = [
  'seau',
  'anneau de doran',
  'lame de doran',
  'bouclier de doran',
  'larme de la déesse',
  'cull',
  'abatteur',
  'atlas',
  'épée de voleur',
  'épée longue',
  'long sword',
  'faucheuse',
  'fragment',
  'potion',
  'ward',
  'elixir',
  'biscuit',
]
const atlasUpgradeIds = new Set(['3869', '3870', '3871', '3876', '3877'])

const isStarterItem = (item: Item): boolean => {
  if (atlasUpgradeIds.has(item.id)) return false
  const itemNameLower = item.name.toLowerCase()
  return (
    starterItemIds.has(item.id) ||
    starterNamePatterns.some(pattern => itemNameLower.includes(pattern)) ||
    Boolean(item.tags && item.tags.includes('Consumable'))
  )
}

// Starting items (2 premiers - starter items only)
const startingItems = computed(() => {
  return buildItems.value.filter(item => isStarterItem(item)).slice(0, 2)
})

// Boots items (can have 2, they share 1 slot)
const bootsItems = computed(() => {
  return buildItems.value.filter(item => isBootsItem(item)).slice(0, 2)
})

// Core items (items restants après starter et boots, organisés en 2 chemins)
const coreItems = computed(() => {
  const starterIds = new Set(startingItems.value.map(i => i.id))
  const bootsIds = new Set(bootsItems.value.map(i => i.id))
  return buildItems.value.filter(item => !starterIds.has(item.id) && !bootsIds.has(item.id))
})

// Path 1 : premier chemin (jusqu'à 3 items)
const coreItemsPath1 = computed(() => {
  return coreItems.value.slice(0, 3)
})

// Path 2 : deuxième chemin (jusqu'à 3 items)
const coreItemsPath2 = computed(() => {
  return coreItems.value.slice(3, 6)
})

// First Three Ups - Les 3 premiers "up" (niveaux 1, 2, 3)
const firstThreeUpsAbilities = computed(() => {
  if (!selectedChampion.value || !displayBuild.value?.skillOrder) return []

  const skillOrder = displayBuild.value.skillOrder
  if (!skillOrder.firstThreeUps) return []

  // Retourner les 3 compétences dans l'ordre de firstThreeUps
  return skillOrder.firstThreeUps
    .filter((ability): ability is 'Q' | 'W' | 'E' | 'R' => ability !== null)
    .map(key => {
      const index = key === 'Q' ? 0 : key === 'W' ? 1 : key === 'E' ? 2 : 3
      const spell = selectedChampion.value?.spells[index]
      return spell ? { ...spell, key } : null
    })
    .filter(Boolean) as Array<{ key: 'Q' | 'W' | 'E' | 'R'; image: { full: string }; name: string }>
})

// Skill order - calculer les 3 premières compétences à maxer
// Afficher l'ordre de montée des compétences (skillUpOrder)
const skillOrderAbilities = computed(() => {
  if (!selectedChampion.value || !displayBuild.value?.skillOrder) return []

  const skillOrder = displayBuild.value.skillOrder
  if (!skillOrder.skillUpOrder) return []

  // Retourner les 3 compétences dans l'ordre de skillUpOrder
  return skillOrder.skillUpOrder
    .filter((ability): ability is 'Q' | 'W' | 'E' | 'R' => ability !== null)
    .map(key => {
      const index = key === 'Q' ? 0 : key === 'W' ? 1 : key === 'E' ? 2 : 3
      const spell = selectedChampion.value?.spells[index]
      return spell ? { ...spell, key } : null
    })
    .filter(Boolean) as Array<{ key: 'Q' | 'W' | 'E' | 'R'; image: { full: string }; name: string }>
})

// Primary rune path
const primaryPath = computed(() => {
  if (!selectedPrimaryRunes.value?.primary?.pathId) return null
  return runesStore.getRunePathById(selectedPrimaryRunes.value.primary.pathId)
})

// Keystone (première rune principale)
const keystoneRuneId = computed(() => {
  if (!selectedPrimaryRunes.value?.primary?.keystone) return null
  return selectedPrimaryRunes.value.primary.keystone
})

// Runes principales (keystone + 3 slots) - exclure keystone pour la ligne horizontale
const primaryRunesRow = computed(() => {
  if (!selectedPrimaryRunes.value?.primary) return []
  return [
    selectedPrimaryRunes.value.primary.slot1,
    selectedPrimaryRunes.value.primary.slot2,
    selectedPrimaryRunes.value.primary.slot3,
  ].filter(id => id && id !== 0)
})

// Secondary rune path
const secondaryPath = computed(() => {
  if (!selectedSecondaryRunes.value?.secondary?.pathId) return null
  return runesStore.getRunePathById(selectedSecondaryRunes.value.secondary.pathId)
})

const secondaryPathIcon = computed(() => {
  if (!secondaryPath.value) return null
  return getRunePathImageUrl(versionForImages.value, secondaryPath.value.icon)
})

const secondaryPathName = computed(() => {
  return secondaryPath.value?.name || ''
})

const filteredSecondaryRuneIds = computed(() => {
  if (!selectedSecondaryRunes.value?.secondary) return []
  return [
    selectedSecondaryRunes.value.secondary.slot1,
    selectedSecondaryRunes.value.secondary.slot2,
  ].filter(id => id && id !== 0)
})

// Internal helper to find a rune object by ID in currently loaded paths
const findRuneById = (runeId: number) => {
  const paths = [primaryPath.value, secondaryPath.value].filter(
    Boolean
  ) as (typeof primaryPath.value)[]
  for (const path of paths) {
    for (const slot of path!.slots) {
      for (const rune of slot.runes) {
        if (rune.id === runeId) {
          return rune
        }
      }
    }
  }
  return null
}

// Get rune icon by ID
const getRuneIconById = (runeId: number): string => {
  if (!primaryPath.value && !secondaryPath.value) {
    return ''
  }

  const rune = findRuneById(runeId)
  return rune ? getRuneImageUrl(versionForImages.value, rune.icon) : ''
}

const getRuneNameById = (runeId: number): string => {
  const rune = findRuneById(runeId)
  return rune ? rune.name : ''
}

// Shards metadata (icon + label)
const shardInfo: Record<
  number,
  {
    icon: string
    name: string
  }
> = {
  5008: { icon: '/icons/shards/adaptative.png', name: 'Force adaptative' },
  5005: { icon: '/icons/shards/speed.png', name: 'Vitesse d’attaque' },
  5007: { icon: '/icons/shards/cdr.png', name: 'Hâte de compétence' },
  5001: { icon: '/icons/shards/hp.png', name: 'PV' },
  5002: { icon: '/icons/shards/growth.png', name: 'Armure' },
  5003: { icon: '/icons/shards/tenacity.png', name: 'Résistance magique' },
}

// Get shard icon by ID
const getShardIconById = (shardId: number): string => {
  return shardInfo[shardId]?.icon || '/icons/shards/adaptative.png'
}

const getShardNameById = (shardId: number): string => {
  return shardInfo[shardId]?.name || ''
}

const filteredShardIds = computed(() => {
  if (!selectedShards.value) return []
  return [
    selectedShards.value.slot1,
    selectedShards.value.slot2,
    selectedShards.value.slot3,
  ].filter(id => id && id !== 0)
})

// Translate tags
const translatedTags = computed(() => {
  if (!selectedChampion.value?.tags) return ''
  return selectedChampion.value.tags
    .map((tag: string) => (tag === 'Fighter' ? 'Combattant' : tag === 'Marksman' ? 'Tireur' : tag))
    .join(', ')
})

// Format passive description with HTML
const formattedPassive = computed(() => {
  if (!selectedChampion.value?.passive?.description) return ''
  return selectedChampion.value.passive.description
})

// Format spells with HTML descriptions
const formattedSpells = computed(() => {
  if (!selectedChampion.value?.spells) return []
  return selectedChampion.value.spells.map(spell => ({
    ...spell,
    description: spell.description || '',
  }))
})

// Compute tooltip position class
const tooltipPositionClass = computed(() => {
  const classes: string[] = []

  if (tooltipPosition.value === 'right') {
    classes.push('left-full', 'ml-2')
  } else {
    classes.push('right-full', 'mr-2')
  }

  if (tooltipVerticalPosition.value === 'top') {
    classes.push('top-0')
  } else {
    classes.push('bottom-0')
  }

  return classes.join(' ')
})

// Calculate tooltip position to avoid going off-screen
const calculateTooltipPosition = async () => {
  if (!tooltipRef.value || !showTooltip.value) return

  await nextTick()

  const tooltip = tooltipRef.value
  const rect = tooltip.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  if (rect.right > viewportWidth) {
    tooltipPosition.value = 'left'
  } else {
    tooltipPosition.value = 'right'
  }

  if (rect.bottom > viewportHeight) {
    tooltipVerticalPosition.value = 'bottom'
  } else {
    tooltipVerticalPosition.value = 'top'
  }
}

watch(showTooltip, async newValue => {
  if (newValue) {
    await nextTick()
    calculateTooltipPosition()

    window.addEventListener('scroll', calculateTooltipPosition, true)
    window.addEventListener('resize', calculateTooltipPosition)
  } else {
    window.removeEventListener('scroll', calculateTooltipPosition, true)
    window.removeEventListener('resize', calculateTooltipPosition)
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', calculateTooltipPosition, true)
  window.removeEventListener('resize', calculateTooltipPosition)
})

// Reset build function
const resetBuild = () => {
  if (props.readonly || props.build) return // Ne pas modifier si readonly ou si build en prop
  buildStore.createNewBuild()
  // Sauvegarder le build vide
  buildStore.saveBuild()
}

const resetItemsOnly = () => {
  if (props.readonly || props.build) return // Ne pas modifier si readonly ou si build en prop
  buildStore.setItems([])
}

const getBootBackgroundStyle = (item?: Item | null) => {
  if (!item) return {}
  return {
    backgroundImage: `url(${getItemImageUrl(versionForImages.value, item.image.full)})`,
  }
}

const itemStatsTotals = computed(() => {
  const totals = {
    health: 0,
    mana: 0,
    attackDamage: 0,
    abilityPower: 0,
    armor: 0,
    magicResist: 0,
    attackSpeedPercent: 0,
    critChancePercent: 0,
    lifeStealPercent: 0,
    omnivampPercent: 0,
    movementSpeedFlat: 0,
    movementSpeedPercent: 0,
    healthRegen: 0,
    manaRegen: 0,
    lethality: 0,
    armorPenPercent: 0,
    magicPenPercent: 0,
    abilityHaste: 0,
  }

  const nonStarter = buildItems.value.filter(item => !isStarterItem(item))
  let firstBootKept = false
  const itemsForStats = nonStarter.filter(item => {
    if (!isBootsItem(item)) return true
    if (firstBootKept) return false
    firstBootKept = true
    return true
  })

  for (const item of itemsForStats) {
    if (!item.stats) continue
    totals.health += item.stats.FlatHPPoolMod || 0
    totals.mana += item.stats.FlatMPPoolMod || 0
    totals.attackDamage += item.stats.FlatPhysicalDamageMod || 0
    totals.abilityPower += item.stats.FlatMagicDamageMod || 0
    totals.armor += item.stats.FlatArmorMod || 0
    totals.magicResist += item.stats.FlatSpellBlockMod || 0
    totals.attackSpeedPercent += item.stats.PercentAttackSpeedMod || 0
    totals.critChancePercent += item.stats.FlatCritChanceMod || 0
    totals.lifeStealPercent += item.stats.PercentLifeStealMod || 0
    totals.movementSpeedFlat += item.stats.FlatMovementSpeedMod || 0
    totals.movementSpeedPercent += item.stats.PercentMovementSpeedMod || 0
    totals.healthRegen += item.stats.FlatHPRegenMod || 0
    totals.manaRegen += item.stats.FlatMPRegenMod || 0
    totals.armorPenPercent += (item.stats.rPercentArmorPenetrationMod || 0) * 100
    totals.magicPenPercent += (item.stats.rPercentSpellPenetrationMod || 0) * 100
    totals.abilityHaste += item.stats.rFlatCooldownModPerLevel || 0
    totals.lethality += (item.stats as any).FlatLethality || 0
    totals.omnivampPercent +=
      ((item.stats as any).FlatOmnivamp || 0) + ((item.stats as any).PercentOmnivamp || 0)
  }

  return totals
})

const itemStatsRows = computed(() => {
  const s = itemStatsTotals.value
  const rows: Array<{ key: string; label: string; value: string }> = []
  const add = (key: string, label: string, value: number, suffix = '', digits = 0) => {
    if (!Number.isFinite(value) || Math.abs(value) < 0.01) return
    rows.push({ key, label, value: `+${value.toFixed(digits)}${suffix}` })
  }
  add('health', 'PV', s.health)
  add('mana', 'Mana', s.mana)
  add('attackDamage', 'AD', s.attackDamage)
  add('abilityPower', 'AP', s.abilityPower)
  add('armor', 'Armure', s.armor)
  add('magicResist', 'RM', s.magicResist)
  add('attackSpeedPercent', 'Vitesse d’attaque', s.attackSpeedPercent, '%', 1)
  add('critChancePercent', 'Critique', s.critChancePercent, '%', 1)
  add('lifeStealPercent', 'Vol de vie', s.lifeStealPercent, '%', 1)
  add('omnivampPercent', 'Omnivamp', s.omnivampPercent, '%', 1)
  add('movementSpeedFlat', 'Vitesse déplacement (flat)', s.movementSpeedFlat)
  add('movementSpeedPercent', 'Vitesse déplacement', s.movementSpeedPercent, '%', 1)
  add('healthRegen', 'Régénération PV', s.healthRegen, '', 1)
  add('manaRegen', 'Régénération mana', s.manaRegen, '', 1)
  add('lethality', 'Létalité', s.lethality)
  add('armorPenPercent', 'Pénétration armure', s.armorPenPercent, '%', 1)
  add('magicPenPercent', 'Pénétration magique', s.magicPenPercent, '%', 1)
  add('abilityHaste', 'Hâte', s.abilityHaste)
  return rows
})

// Persistance automatique - sauvegarder à chaque modification (seulement si pas de build en prop)
watch(
  () => buildStore.currentBuild,
  newBuild => {
    if (newBuild && !props.build) {
      // Sauvegarder automatiquement dans localStorage seulement si on utilise currentBuild
      try {
        const buildData = JSON.stringify(newBuild)
        localStorage.setItem('lelanation_current_build', buildData)
      } catch (error) {
        // Ignore storage errors
      }
    }
  },
  { deep: true }
)

// Charger le build sauvegardé au montage (seulement si pas de build en prop)
onMounted(() => {
  if (!props.build) {
    // Charger depuis localStorage
    try {
      const saved = localStorage.getItem('lelanation_current_build')
      if (saved) {
        const build = JSON.parse(saved) as Build
        buildStore.setCurrentBuild(build)
      } else if (!buildStore.currentBuild) {
        // Créer un nouveau build si aucun n'existe
        buildStore.createNewBuild()
      }
    } catch (error) {
      // Failed to load saved build - create new one
      if (!buildStore.currentBuild) {
        buildStore.createNewBuild()
      }
    }
  }

  // Load runes in current locale (for tooltips)
  runesStore.loadRunes(riotLocale.value)
})

watch(locale, () => {
  runesStore.loadRunes(riotLocale.value)
})
</script>

<style scoped>
.build-card-wrapper {
  display: inline-flex;
  flex-direction: column;
  gap: 8px;
}

.build-card {
  position: relative;
  width: 300px;
  height: 450px;
  background: var(--gradient-primary);
  background-attachment: fixed;
  border: 2px solid var(--color-gold-300);
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  font-family: var(--font-beaufort, ui-sans-serif, system-ui, sans-serif);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.build-version {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.roles-section {
  position: absolute;
  top: 30px;
  right: 8px; /* Aligné à droite comme la version */
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.roles-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.role-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}

.role-unselected {
  opacity: 0.3;
  filter: grayscale(100%);
}

.role-selected {
  opacity: 1;
  filter: grayscale(0%);
  border: 1px solid var(--color-gold-300);
  background: rgba(200, 155, 60, 0.1);
}

.role-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.reset-button {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--color-gold-300);
  border-radius: 4px;
  color: var(--color-gold-300);
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
}

.reset-button:hover {
  background: rgba(0, 0, 0, 0.5);
  transform: rotate(180deg);
}

/* Champion Section */
.champion-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 8px;
}

.champion-portrait-container {
  width: 72px;
  height: 72px;
  position: relative;
  margin-bottom: 8px;
  flex-shrink: 0;
}

/* Bordure dorée complète via pseudo-élément avec SVG en data URI */
.champion-portrait-container::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  transform: translate(-50%, -50%);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cmask id='diamond-border-mask'%3E%3Crect width='100' height='100' fill='white'/%3E%3Cpolygon points='50,6 94,50 50,94 6,50' fill='black'/%3E%3C/mask%3E%3C/defs%3E%3Cpolygon points='50,0 100,50 50,100 0,50' fill='%23c89b3c' mask='url(%23diamond-border-mask)'/%3E%3C/svg%3E");
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: center;
  z-index: 2;
  pointer-events: none;
}

/* Image du champion en losange (88%) */
.champion-portrait {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 88%;
  height: 88%;
  transform: translate(-50%, -50%);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  object-fit: cover;
  cursor: pointer;
  z-index: 1;
}

.champion-portrait-placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 88%;
  height: 88%;
  transform: translate(-50%, -50%);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  background: rgba(255, 255, 255, 0.05);
  border: 1px dashed var(--color-gold-300);
  opacity: 0.3;
  z-index: 1;
}

.champion-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary-light);
  text-align: center;
  margin: 0 0 8px 0;
  letter-spacing: 2px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.separator-line {
  width: 100%;
  height: 1px;
  background: var(--color-gold-300);
  opacity: 0.8;
  margin: 8px 0;
}

.summoner-spells-row {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-top: 6px;
  margin-bottom: 6px;
}

.summoner-spell-icon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid var(--color-gold-300);
  object-fit: cover;
}

.summoner-spell-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px dashed var(--color-gold-300);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
}

/* Runes Section */
.runes-section {
  margin: 8px 0;
  position: relative;
  padding-right: 40px; /* espace réservé pour la colonne de shards à droite */
}

.runes-container {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.keystone-container {
  flex-shrink: 0;
}

.keystone-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 2px solid var(--color-gold-300);
  object-fit: cover;
}

.keystone-placeholder {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 2px dashed var(--color-gold-300);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
}

.runes-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.primary-runes-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.primary-rune-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--color-gold-300);
  object-fit: cover;
}

.primary-rune-placeholder {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px dashed var(--color-gold-300);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
}

.shards-vertical {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 4px;
}

.shard-icon-small {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  border: 1px solid var(--color-gold-300);
  object-fit: cover;
}

/* Colonne de shards à droite, dans la même zone que les runes */
.shards-strip {
  position: absolute;
  top: 0;
  right: 8px;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
}

.shard-icon-strip {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  border: 1px solid var(--color-gold-300);
  object-fit: cover;
}

.shard-placeholder {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  border: 1px dashed var(--color-gold-300);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
}

.secondary-runes-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.secondary-path-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--color-gold-300);
  object-fit: cover;
}

.secondary-path-placeholder {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px dashed var(--color-gold-300);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
}

.secondary-rune-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--color-gold-300);
  object-fit: cover;
}

.secondary-rune-placeholder {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px dashed var(--color-gold-300);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
}
/* Items Section */
.items-section {
  margin: 8px 0;
  padding-left: 10px; /* Même espacement que les skills à droite */
}

.starting-items-row {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-start;
  margin-bottom: 8px;
  padding-left: 0;
  /* Centrer par rapport à un path de 3 items (32px * 3 + 14px * 2 flèches = 124px) */
  /* Starting items = 32px * 2 + 6px gap = 70px, donc offset = (124 - 70) / 2 = 27px */
  margin-left: 27px;
}

.boots-slot {
  width: 32px;
  height: 32px;
  position: relative;
  border-radius: 4px;
  border: 1px dashed var(--color-gold-300);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
}

.boots-icon-single {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.boots-item-split {
  position: absolute;
  top: 0;
  width: 50%;
  height: 100%;
  cursor: pointer;
  transition: opacity 0.2s;
  background-size: 32px 32px;
  background-repeat: no-repeat;
}

.boots-item-split:hover {
  opacity: 0.7;
}

.boots-item-left {
  left: 0;
  background-position: left center;
}

.boots-item-right {
  right: 0;
  background-position: right center;
}

/* Items manager (below card) */
.items-manager {
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.15);
}

.items-manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.items-manager-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.items-manager-title {
  font-weight: 700;
  font-size: 12px;
  margin-bottom: 8px;
  opacity: 0.9;
}

.items-reset-btn {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.35);
  cursor: pointer;
}

.items-stats-toggle-btn {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.45);
  background: rgba(200, 155, 60, 0.18);
  cursor: pointer;
}

.items-reset-btn:hover {
  background: rgba(0, 0, 0, 0.55);
}

.items-stats-toggle-btn:hover {
  background: rgba(200, 155, 60, 0.28);
}

.items-manager-empty {
  font-size: 12px;
  opacity: 0.7;
}

.items-manager-inline {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  overflow-x: auto;
  white-space: nowrap;
  padding-bottom: 4px;
}

.items-manager-inline-icon {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid var(--color-gold-300);
  flex: 0 0 auto;
}

.items-manager-inline-separator {
  font-size: 12px;
  color: var(--color-gold-300);
  opacity: 0.9;
  flex: 0 0 auto;
}

.items-manager-stats {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.items-manager-stats-note {
  font-size: 11px;
  opacity: 0.75;
  margin-bottom: 6px;
}

.items-manager-stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
}

.items-manager-stats-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  padding: 3px 0;
}

.items-manager-stats-label {
  opacity: 0.85;
}

.items-manager-stats-value {
  color: var(--color-gold-300);
  font-weight: 600;
}

.core-items-paths {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.items-path {
  display: flex;
  align-items: center;
  gap: 6px; /* Même gap que les starting items */
  justify-content: flex-start;
}

.item-wrapper {
  position: relative;
  cursor: pointer;
  transition: opacity 0.2s;
}

.item-wrapper:hover {
  opacity: 0.7;
}

.item-icon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid var(--color-gold-300);
  object-fit: cover;
  display: block;
}

.item-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px dashed var(--color-gold-300);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
}

.arrow-right {
  color: var(--color-gold-300);
  font-size: 14px;
  font-weight: bold;
}

/* First Three Ups Section */
.first-three-ups-section {
  position: absolute;
  left: 200px; /* Positionné pour avoir le même espace entre items (~120px) et skill order (~280px) */
  top: 300px; /* Descendu pour s'aligner avec les items */
  z-index: 10;
}

.first-three-ups-vertical {
  display: flex;
  flex-direction: column;
  gap: 6px; /* Même gap que les items */
  align-items: center;
}

.first-three-ups-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  position: relative;
}

.first-three-ups-item .skill-icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.first-three-ups-item .skill-placeholder-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.first-three-ups-item .skill-icon {
  position: relative;
}

.first-three-ups-item .skill-key {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: rgba(0, 0, 0, 0.9);
  color: var(--color-gold-300);
  font-size: 10px;
  font-weight: bold;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  z-index: 1;
}

.first-three-ups-item .level-badge {
  position: absolute;
  top: -2px;
  left: -2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--color-gold-300);
  color: var(--color-blue-600);
  font-size: 9px;
  font-weight: bold;
  z-index: 1;
}

/* Skill Order Section */
.skill-order-section {
  position: absolute;
  right: 20px; /* Décalé de 20px du bord droit */
  top: 300px; /* Descendu pour s'aligner avec les items */
}

.skill-order-vertical {
  display: flex;
  flex-direction: column;
  gap: 6px; /* Même gap que les items */
  align-items: center;
}

.skill-order-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  position: relative;
}

/* Wrapper pour positionner la clé (Q/W/E/R) sur l'icône, comme first-three-ups */
.skill-order-item .skill-icon-wrapper,
.skill-order-item .skill-placeholder-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skill-order-item .skill-icon {
  position: relative;
}

.skill-icon {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid var(--color-gold-300);
  object-fit: cover;
}

.skill-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px dashed var(--color-gold-300);
  background: rgba(255, 255, 255, 0.05);
  opacity: 0.3;
}

/* Fond opaque pour lisibilité à l'écran et à la capture image (fallback pour dom-to-image) */
.skill-key {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: rgba(0, 0, 0, 0.9);
  color: var(--color-gold-300);
  font-size: 10px;
  font-weight: bold;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  z-index: 1;
}

.arrow-down {
  color: var(--color-gold-300);
  font-size: 8px;
  font-weight: bold;
  margin-top: 1px;
  line-height: 1;
}

/* Footer */
.build-footer {
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

/* Tooltip styles (same as before) */
.tooltip-box {
  width: min(680px, calc(100vw - 2rem));
  max-width: min(680px, calc(100vw - 2rem));
  min-width: 320px;
  padding: 1.2em;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

@media (max-width: 768px) {
  .tooltip-box {
    width: calc(100vw - 2rem);
    max-width: calc(100vw - 2rem);
    min-width: 280px;
    padding: 1em;
  }
}

@media (max-width: 480px) {
  .tooltip-box {
    width: calc(100vw - 1rem);
    max-width: calc(100vw - 1rem);
    min-width: 250px;
    padding: 0.8em;
  }
}

.tooltip-top {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.tooltip-present {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
  margin-bottom: 1em;
}

.tooltip-champion-image {
  width: 45px;
  height: 45px;
  border-radius: 50%;
  border: 1px solid rgb(var(--rgb-accent));
  object-fit: cover;
  flex-shrink: 0;
}

.tooltip-text {
  display: flex;
  flex-direction: column;
  text-align: right;
  flex: 1;
}

.tooltip-champion-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgb(var(--rgb-accent));
  line-height: 1.2;
}

.tooltip-champion-title {
  font-size: 0.8rem;
  color: rgb(var(--rgb-text) / 0.8);
  line-height: 1.3;
}

.tooltip-tags-container {
  width: 100%;
  padding-top: 0.5em;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.tooltip-tags {
  font-size: 0.8rem;
  color: rgb(var(--rgb-text) / 0.7);
  line-height: 1.4;
}

.tooltip-separator {
  background-color: rgb(var(--rgb-accent));
  width: 100%;
  height: 1px;
  border: 0;
  margin: 0.5em 0;
  opacity: 0.2;
  flex-shrink: 0;
}

.tooltip-body {
  flex: 1;
  overflow: visible;
  min-height: 0;
}

.tooltip-spells {
  display: flex;
  flex-direction: column;
  gap: 0.8em;
  margin-top: 1em;
}

.tooltip-spell {
  flex-shrink: 0;
  display: flex;
  gap: 0.75em;
}

.tooltip-spell-wrapper {
  display: flex;
  gap: 0.75em;
  width: 100%;
}

.tooltip-spell-img-container {
  border: 1px solid rgb(var(--rgb-accent));
  position: relative;
  margin-top: 0.1em;
  height: 2.5em;
  width: 2.5em;
  flex-shrink: 0;
  border-radius: 4px;
}

.tooltip-spell-img-container[data-spell-key='Q']::before {
  content: 'Q';
  color: rgb(var(--rgb-accent));
  position: absolute;
  font-size: 0.75rem;
  font-weight: 400;
  bottom: -0.15em;
  left: 0.1em;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.tooltip-spell-img-container[data-spell-key='W']::before {
  content: 'W';
  color: rgb(var(--rgb-accent));
  position: absolute;
  font-size: 0.75rem;
  font-weight: 400;
  bottom: -0.15em;
  left: 0.1em;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.tooltip-spell-img-container[data-spell-key='E']::before {
  content: 'E';
  color: rgb(var(--rgb-accent));
  position: absolute;
  font-size: 0.75rem;
  font-weight: 400;
  bottom: -0.15em;
  left: 0.1em;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.tooltip-spell-img-container[data-spell-key='R']::before {
  content: 'R';
  color: rgb(var(--rgb-accent));
  position: absolute;
  font-size: 0.75rem;
  font-weight: 400;
  bottom: -0.15em;
  left: 0.1em;
  text-shadow:
    1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px 1px 0 rgba(0, 0, 0, 0.8),
    -1px -1px 0 rgba(0, 0, 0, 0.8),
    1px -1px 0 rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.tooltip-spell-img {
  display: block;
  height: 100%;
  width: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.tooltip-spell-content {
  flex: 1;
  min-width: 0;
}

.tooltip-spell-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgb(var(--rgb-text));
  line-height: 1.3;
  margin-bottom: 4px;
}

.tooltip-spell-description {
  font-size: 0.8rem;
  color: rgb(var(--rgb-text) / 0.7);
  line-height: 1.4;
}
</style>
