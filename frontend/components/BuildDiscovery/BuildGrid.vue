<template>
  <div class="build-grid">
    <div v-if="builds.length === 0" class="py-12 text-center">
      <p class="text-lg text-text">{{ t('buildDiscovery.noBuildsFound') }}</p>
      <p class="mt-2 text-sm text-text/70">
        {{
          hasActiveFilters
            ? t('buildDiscovery.adjustFilters')
            : t('buildDiscovery.createFirstBuild')
        }}
      </p>
      <NuxtLink
        v-if="!hasActiveFilters"
        :to="localePath('/builds/create')"
        class="mt-4 inline-block rounded bg-accent px-6 py-2 text-background hover:bg-accent-dark"
      >
        {{ t('buildsPage.createBuild') }}
      </NuxtLink>
    </div>

    <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      <div v-for="build in builds" :key="build.id" class="flex flex-col items-center gap-2">
        <!-- Informations au-dessus de la sheet (nom et auteur) -->
        <div
          class="flex min-h-[60px] w-full max-w-[300px] flex-col justify-center space-y-1 text-center"
        >
          <!-- Auteur -->
          <h3 class="text-lg font-semibold text-text">{{ build.author }}</h3>
          <!-- Nom du build -->
          <div class="text-sm text-text/70" :class="{ invisible: !build.author }">
            <span class="ml-1">{{ build.name }}</span>
          </div>
        </div>

        <!-- BuildCard Sheet -->
        <div class="relative">
          <div class="cursor-pointer" @click="navigateToBuild(build.id)">
            <div :ref="el => setBuildCardRef(build.id, el)" :data-build-id="build.id">
              <BuildCard :build="build" :readonly="true" />
            </div>
          </div>
          <!-- Boutons d'action utilisateur (supprimer/modifier) -->
          <div
            v-if="props.showUserActions"
            class="absolute -right-5 top-0 z-50 flex flex-col gap-1.5"
          >
            <!-- Bouton Supprimer -->
            <button
              class="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white shadow-md transition-colors hover:bg-error/80"
              :title="t('buildDiscovery.deleteBuild')"
              @click.stop="$emit('delete-build', build.id)"
            >
              ✕
            </button>
            <NuxtLink
              :to="localePath(`/builds/edit/${build.id}`)"
              class="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[10px] text-white shadow-md transition-colors hover:bg-accent-dark"
              :title="t('buildDiscovery.editBuild')"
              @click.stop
            >
              ✎
            </NuxtLink>
          </div>
        </div>

        <!-- Informations en dessous de la sheet (description, date, votes, partager) -->
        <div class="w-full max-w-[300px] space-y-2">
          <div class="flex items-center justify-end gap-2">
            <button
              class="rounded border border-accent/70 bg-surface px-2 py-1 text-xs text-text transition-colors hover:bg-accent/10"
              :title="t('theorycraft.testBuild')"
              @click.stop="goToTheorycraft(build)"
            >
              <span>{{ t('theorycraft.testBuild') }}</span>
            </button>
            <!-- Boutons de vote (désactivés pour les builds de l'utilisateur) -->
            <div v-if="!isUserBuild(build.id)" class="flex items-center gap-1">
              <!-- Bouton Upvote -->
              <button
                class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
                :class="
                  getUserVote(build.id) === 'up'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'border border-green-600 bg-surface text-green-600 hover:bg-green-50'
                "
                :title="
                  getUserVote(build.id) === 'up'
                    ? t('buildDiscovery.removeUpvote')
                    : t('buildDiscovery.upvoteBuild')
                "
                @click.stop="handleUpvote(build.id)"
              >
                <span>👍</span>
                <span>{{ getUpvoteCount(build.id) }}</span>
              </button>
              <!-- Bouton Downvote -->
              <button
                class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
                :class="
                  getUserVote(build.id) === 'down'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'border border-red-600 bg-surface text-red-600 hover:bg-red-50'
                "
                :title="
                  getUserVote(build.id) === 'down'
                    ? t('buildDiscovery.removeDownvote')
                    : t('buildDiscovery.downvoteBuild')
                "
                @click.stop="handleDownvote(build.id)"
              >
                <span>👎</span>
                <span>{{ getDownvoteCount(build.id) }}</span>
              </button>
            </div>
            <!-- Bouton Partager avec dropdown -->
            <div v-if="props.showComparisonButtons" class="relative">
              <button
                class="rounded border border-accent/70 bg-surface px-2 py-1 text-xs text-text transition-colors hover:bg-accent/10"
                @click.stop="toggleShareDropdown(build.id)"
              >
                {{ t('buildDiscovery.share') }}
              </button>
              <!-- Dropdown -->
              <div
                v-if="openShareDropdown === build.id"
                class="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-primary shadow-lg"
                style="background-color: rgb(26, 26, 46)"
                @click.stop
              >
                <button
                  class="flex w-full items-center gap-2 rounded-t-lg px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                  @click="copyBuildLink(build.id)"
                >
                  <span class="text-base">🔗</span>
                  <span>{{ t('buildDiscovery.copyLink') }}</span>
                </button>
                <button
                  class="flex w-full items-center gap-2 border-t border-primary px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                  @click="downloadBuildImage(build.id)"
                >
                  <span class="text-base">⬇️</span>
                  <span>{{ t('buildDiscovery.downloadImage') }}</span>
                </button>
                <button
                  class="flex w-full items-center gap-2 rounded-b-lg border-t border-primary px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/20"
                  @click="copyBuildImage(build.id)"
                >
                  <span class="text-base">📋</span>
                  <span>{{ t('buildDiscovery.copyImage') }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Description -->
          <div class="min-h-[60px] text-sm text-text/80">
            <template v-if="build.description">
              <p :class="expandedDescriptions[build.id] ? '' : 'line-clamp-3'">
                {{ build.description }}
              </p>
              <button
                v-if="build.description.length > 150"
                class="mt-1 text-xs text-accent hover:text-accent/80"
                @click.stop="toggleDescription(build.id)"
              >
                {{
                  expandedDescriptions[build.id]
                    ? t('buildDiscovery.showLess')
                    : t('buildDiscovery.showMore')
                }}
              </button>
            </template>
            <p v-else class="invisible">Placeholder</p>
          </div>

          <!-- Date de création -->
          <p class="min-h-[20px] text-xs text-text/50">
            <span v-if="build.createdAt"
              >{{ t('buildDiscovery.createdOn') }} {{ formatDate(build.createdAt) }}</span
            >
            <span v-else class="invisible">Placeholder</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BuildCard from '~/components/Build/BuildCard.vue'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useBuildStore } from '~/stores/BuildStore'
import { useVoteStore } from '~/stores/VoteStore'
import { useVersionStore } from '~/stores/VersionStore'
import type { Build } from '~/types/build'

const { t, locale } = useI18n()
const buildStore = useBuildStore()
const openShareDropdown = ref<string | null>(null)
const buildCardRefs = ref<Record<string, HTMLElement | null>>({})
const expandedDescriptions = ref<Record<string, boolean>>({})

interface Props {
  showComparisonButtons?: boolean
  customBuilds?: Build[]
  showUserActions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showComparisonButtons: true,
  customBuilds: undefined,
  showUserActions: false,
})

defineEmits<{
  'delete-build': [buildId: string]
}>()

const discoveryStore = useBuildDiscoveryStore()
const voteStore = useVoteStore()
const router = useRouter()

// Filtrer les customBuilds avec les mêmes critères que discoveryStore
const filteredCustomBuilds = computed(() => {
  if (!props.customBuilds) return null

  let results = [...props.customBuilds]
  const versionStore = useVersionStore()
  const currentVersion = versionStore.currentVersion

  // Search by champion name or author
  if (discoveryStore.searchQuery) {
    const query = discoveryStore.searchQuery.toLowerCase()
    results = results.filter(
      build =>
        build.champion?.name.toLowerCase().includes(query) ||
        build.champion?.id.toLowerCase().includes(query) ||
        (build.author && build.author.toLowerCase().includes(query))
    )
  }

  // Filter by champion
  if (discoveryStore.selectedChampion) {
    results = results.filter(build => build.champion?.id === discoveryStore.selectedChampion)
  }

  // Filter by role
  if (discoveryStore.selectedRole) {
    results = results.filter(build => build.roles?.includes(discoveryStore.selectedRole!))
  }

  // Filter by up-to-date
  if (discoveryStore.onlyUpToDate) {
    results = results.filter(build => build.gameVersion === currentVersion)
  }

  // Sort
  switch (discoveryStore.sortBy) {
    case 'recent':
      results.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime()
        const dateB = new Date(b.createdAt || 0).getTime()
        return dateB - dateA
      })
      break
    case 'popular': {
      results.sort((a, b) => {
        const votesA = voteStore.getVoteCount(a.id)
        const votesB = voteStore.getVoteCount(b.id)
        if (votesA !== votesB) {
          return votesB - votesA
        }
        // If same votes, sort by most recent
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      })
      break
    }
    case 'name':
      results.sort((a, b) => {
        const nameA = a.name?.toLowerCase() || ''
        const nameB = b.name?.toLowerCase() || ''
        return nameA.localeCompare(nameB)
      })
      break
  }

  return results
})

const builds = computed(() => filteredCustomBuilds.value ?? discoveryStore.filteredBuilds)
const hasActiveFilters = computed(() => {
  return (
    !!discoveryStore.searchQuery ||
    !!discoveryStore.selectedChampion ||
    !!discoveryStore.selectedRole ||
    discoveryStore.onlyUpToDate ||
    discoveryStore.sortBy !== 'recent'
  )
})

const localePath = useLocalePath()
const navigateToBuild = (buildId: string) => {
  router.push(localePath(`/builds/${buildId}`))
}

const formatDate = (dateString: string): string => {
  const localeCode = locale.value === 'fr' ? 'fr-FR' : 'en-US'
  return new Date(dateString).toLocaleDateString(localeCode, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const toggleDescription = (buildId: string) => {
  expandedDescriptions.value[buildId] = !expandedDescriptions.value[buildId]
}

const getUpvoteCount = (buildId: string): number => {
  return voteStore.getUpvoteCount(buildId)
}

const getDownvoteCount = (buildId: string): number => {
  return voteStore.getDownvoteCount(buildId)
}

const getUserVote = (buildId: string): 'up' | 'down' | null => {
  return voteStore.getUserVote(buildId)
}

const handleUpvote = async (buildId: string) => {
  voteStore.upvote(buildId)
  const build = discoveryStore.builds.find(b => b.id === buildId)
  if (build) {
    buildStore.setCurrentBuild(build)
    await buildStore.checkAndUpdateVisibility()
  }
}

const handleDownvote = async (buildId: string) => {
  voteStore.downvote(buildId)
  const build = discoveryStore.builds.find(b => b.id === buildId)
  if (build) {
    buildStore.setCurrentBuild(build)
    await buildStore.checkAndUpdateVisibility()
  }
}

const isUserBuild = (buildId: string): boolean => {
  const savedBuilds = buildStore.getSavedBuilds()
  return savedBuilds.some(b => b.id === buildId)
}

const setBuildCardRef = (buildId: string, el: unknown) => {
  if (el && el instanceof HTMLElement) {
    // Stocker la référence au div qui contient le BuildCard
    buildCardRefs.value[buildId] = el
  }
}

const toggleShareDropdown = (buildId: string) => {
  if (openShareDropdown.value === buildId) {
    openShareDropdown.value = null
  } else {
    openShareDropdown.value = buildId
  }
}

const copyBuildLink = async (buildId: string) => {
  const buildUrl = `${window.location.origin}/builds/${buildId}`
  try {
    await navigator.clipboard.writeText(buildUrl)
    openShareDropdown.value = null
    // Optionnel: afficher une notification
  } catch (error) {
    // Fallback pour les navigateurs qui ne supportent pas clipboard API
    const textarea = document.createElement('textarea')
    textarea.value = buildUrl
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    openShareDropdown.value = null
  }
}

const captureBuildImage = async (buildId: string): Promise<Blob | null> => {
  const cardElement = buildCardRefs.value[buildId]
  if (!cardElement) {
    // eslint-disable-next-line no-console
    console.error('BuildCard element not found for build:', buildId)
    return null
  }

  try {
    // Trouver le BuildCard à l'intérieur (élément avec classe build-card-wrapper)
    const buildCardWrapper = cardElement.querySelector('.build-card-wrapper') as HTMLElement
    if (!buildCardWrapper) {
      // eslint-disable-next-line no-console
      console.error('BuildCard wrapper not found in element:', cardElement)
      return null
    }

    // Attendre un peu pour s'assurer que tout est rendu
    await new Promise(resolve => setTimeout(resolve, 200))

    // Cloner l'élément pour éviter de modifier l'original
    const clonedElement = buildCardWrapper.cloneNode(true) as HTMLElement

    // Positionner le clone hors écran mais visible pour le rendu
    // IMPORTANT: Ne pas mettre opacity à 0, sinon dom-to-image-more ne peut pas capturer
    clonedElement.style.position = 'fixed'
    clonedElement.style.left = '-9999px'
    clonedElement.style.top = '0'
    clonedElement.style.zIndex = '9999'
    clonedElement.style.opacity = '1'
    clonedElement.style.visibility = 'visible'
    clonedElement.style.pointerEvents = 'none'
    document.body.appendChild(clonedElement)

    // Fonction pour forcer tous les backgrounds à être transparents sauf ceux explicitement définis
    const sanitizeStyles = (element: HTMLElement) => {
      const allElements = [element, ...Array.from(element.querySelectorAll('*'))] as HTMLElement[]

      // Fonction helper pour détecter si une couleur est blanche ou gris très clair
      const isWhiteOrLightGrey = (color: string): boolean => {
        if (!color) return false
        const normalized = color.toLowerCase().trim()

        // Couleurs blanches
        if (
          normalized === 'rgb(255, 255, 255)' ||
          normalized === 'rgba(255, 255, 255, 1)' ||
          normalized === '#ffffff' ||
          normalized === '#fff' ||
          normalized === 'white'
        ) {
          return true
        }

        // Gris très clair (comme rgb(229, 231, 235))
        const rgbMatch = normalized.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
        if (
          rgbMatch &&
          rgbMatch[1] !== undefined &&
          rgbMatch[2] !== undefined &&
          rgbMatch[3] !== undefined
        ) {
          const r = parseInt(rgbMatch[1], 10)
          const g = parseInt(rgbMatch[2], 10)
          const b = parseInt(rgbMatch[3], 10)
          // Si toutes les valeurs sont > 200, c'est très clair
          if (r > 200 && g > 200 && b > 200) {
            return true
          }
        }

        return false
      }

      allElements.forEach(el => {
        const computed = window.getComputedStyle(el)
        const style = el.style

        // Vérifier si c'est un séparateur (doit conserver son background)
        const isSeparator = el.classList.contains('separator-line')
        // Clés de spell et badges de niveau : conserver fond opaque pour la capture (lisibilité)
        const isSpellOrLevelBadge =
          el.classList.contains('skill-key') || el.classList.contains('level-badge')

        // FORCER le background à transparent par défaut (sauf séparateurs et badges spell/niveau)
        if (!isSeparator && !isSpellOrLevelBadge) {
          style.backgroundColor = 'transparent'
        }

        // Pour skill-key et level-badge : forcer des couleurs opaques pour dom-to-image
        if (el.classList.contains('skill-key')) {
          style.backgroundColor = 'rgba(0, 0, 0, 0.9)'
          style.color = computed.color || '#c9a227'
        } else if (el.classList.contains('level-badge')) {
          style.backgroundColor = '#c9a227'
          style.color = '#2563eb'
        }

        // Puis appliquer seulement si une couleur est explicitement définie et non blanche/transparente
        const bgColor = computed.backgroundColor
        if (
          !isSpellOrLevelBadge &&
          bgColor &&
          !isWhiteOrLightGrey(bgColor) &&
          bgColor !== 'rgba(0, 0, 0, 0)' &&
          bgColor !== 'transparent'
        ) {
          style.backgroundColor = bgColor
          // Pour les séparateurs, aussi appliquer l'opacité
          if (isSeparator) {
            style.opacity = computed.opacity || '0.8'
          }
        }

        // Même chose pour les images de fond
        if (computed.backgroundImage && computed.backgroundImage !== 'none') {
          style.backgroundImage = computed.backgroundImage
          style.backgroundSize = computed.backgroundSize
          style.backgroundPosition = computed.backgroundPosition
          style.backgroundRepeat = computed.backgroundRepeat
        }

        // Supprimer les bordures blanches/gris clair
        const borderColor = computed.borderColor
        if (isWhiteOrLightGrey(borderColor)) {
          // Supprimer la bordure si elle est blanche/gris clair
          style.border = 'none'
          style.borderWidth = '0'
          style.borderColor = 'transparent'
        } else if (
          borderColor &&
          borderColor !== 'rgba(0, 0, 0, 0)' &&
          borderColor !== 'transparent'
        ) {
          // Garder la bordure seulement si elle a une couleur valide
          style.borderColor = borderColor
        } else {
          // Pas de bordure
          style.border = 'none'
        }

        // Remplacer color (mais pas si c'est noir par défaut)
        if (computed.color && computed.color !== 'rgb(0, 0, 0)') {
          style.color = computed.color
        }

        // Pour les séparateurs, s'assurer que la hauteur et la largeur sont préservées
        if (isSeparator) {
          style.width = computed.width || '100%'
          style.height = computed.height || '1px'
          style.margin = computed.margin || '8px 0'
        }
      })
    }

    // Nettoyer les styles
    sanitizeStyles(clonedElement)

    // Attendre un peu pour que les styles soient appliqués et que le clone soit rendu
    await new Promise(resolve => setTimeout(resolve, 300))

    // Vérifier que le clone est bien dans le DOM et visible
    // eslint-disable-next-line no-console
    console.log(
      'Clone element:',
      clonedElement,
      'Visible:',
      clonedElement.offsetWidth,
      'x',
      clonedElement.offsetHeight
    )

    // Utiliser dom-to-image-more directement pour convertir en blob
    const domtoimage = await import('dom-to-image-more')

    // eslint-disable-next-line no-console
    console.log('Converting element to blob...')

    // Convertir directement en blob (plus simple et plus fiable)
    const resultBlob = await domtoimage.toBlob(clonedElement, {
      bgcolor: '#0a0a14',
      quality: 1.0,
    })

    // eslint-disable-next-line no-console
    console.log('Blob created:', resultBlob ? `Size: ${resultBlob.size} bytes` : 'null')

    // Nettoyer : retirer le clone du DOM
    document.body.removeChild(clonedElement)

    return resultBlob
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to capture image:', error)
    return null
  }
}

const downloadBuildImage = async (buildId: string) => {
  // eslint-disable-next-line no-console
  console.log('Download image clicked for build:', buildId)
  try {
    const blob = await captureBuildImage(buildId)
    // eslint-disable-next-line no-console
    console.log('Blob received:', blob ? `Size: ${blob.size} bytes` : 'null')
    if (!blob) {
      // eslint-disable-next-line no-console
      console.error('No blob returned from captureBuildImage')
      return
    }

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `build-${buildId}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    openShareDropdown.value = null
    // eslint-disable-next-line no-console
    console.log('Image download triggered')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to download image:', error)
  }
}

const copyBuildImage = async (buildId: string) => {
  // eslint-disable-next-line no-console
  console.log('Copy image clicked for build:', buildId)
  try {
    const blob = await captureBuildImage(buildId)
    // eslint-disable-next-line no-console
    console.log('Blob received for copy:', blob ? `Size: ${blob.size} bytes` : 'null')
    if (!blob) {
      // eslint-disable-next-line no-console
      console.error('No blob returned from captureBuildImage')
      return
    }

    // Utiliser l'API Clipboard pour copier l'image
    if (navigator.clipboard && navigator.clipboard.write) {
      const item = new ClipboardItem({ 'image/png': blob })
      await navigator.clipboard.write([item])
      openShareDropdown.value = null
      // eslint-disable-next-line no-console
      console.log('Image copied to clipboard')
    } else {
      // eslint-disable-next-line no-console
      console.error('Clipboard API not available')
      // Fallback: convertir en data URL et copier via un élément temporaire
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const img = new Image()
        img.src = dataUrl
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0)
            canvas.toBlob(async blob => {
              if (blob && navigator.clipboard && navigator.clipboard.write) {
                const item = new ClipboardItem({ 'image/png': blob })
                await navigator.clipboard.write([item])
              }
            })
          }
        }
      }
      reader.readAsDataURL(blob)
      openShareDropdown.value = null
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to copy image:', error)
  }
}

// Fermer le dropdown si on clique ailleurs
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  // Vérifier si le clic est en dehors du dropdown
  const clickedInsideDropdown = target.closest('.relative') && target.closest('button')
  if (!clickedInsideDropdown) {
    openShareDropdown.value = null
  }
}

const goToTheorycraft = async (build: Build) => {
  if (!build) return
  // Charger le build dans le store theorycraft avant de naviguer
  const { useTheorycraftStore } = await import('~/stores/TheorycraftStore')
  const theorycraftStore = useTheorycraftStore()
  theorycraftStore.loadBuild(build)
  navigateTo(localePath('/theorycraft'))
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
