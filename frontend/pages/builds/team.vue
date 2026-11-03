<template>
  <BuildsIndexTabPage tab="team">
    <template #team>
      <div class="team-builds">
        <div v-if="!loaded" class="py-12 text-center text-text/70">…</div>

        <div v-else-if="!role" class="py-12 text-center">
          <p class="mb-4">{{ t('buildsPage.teamLoginRequired') }}</p>
          <NuxtLink
            :to="localePath('/admin/login')"
            class="inline-block rounded bg-accent px-6 py-2 text-background"
          >
            {{ t('buildsPage.teamLogin') }}
          </NuxtLink>
        </div>

        <template v-else>
          <p v-if="error" class="mb-4 text-error">{{ error }}</p>
          <p v-if="loading" class="py-12 text-center text-text/70">…</p>
          <p v-else-if="builds.length === 0" class="py-12 text-center text-text/70">
            {{ t('buildsPage.teamEmpty') }}
          </p>
          <BuildGrid
            v-else
            :custom-builds="builds"
            :show-all-custom-builds="true"
            :show-comparison-buttons="true"
            :show-visibility-toggle="actions.canChangeVisibility"
            :show-delete-action="actions.canDelete"
            :show-edit-action="actions.canEdit"
            :linked-guides="guides"
            @toggle-visibility="toggleVisibility"
            @delete-build="removeBuild"
            @edit-build="prepareEdit"
          />
        </template>
      </div>
    </template>
  </BuildsIndexTabPage>
</template>

<script setup lang="ts">
import type { Build, MatchupGuide } from '@lelanation/shared-types'
import BuildGrid from '~/components/BuildDiscovery/BuildGrid.vue'
import BuildsIndexTabPage from '~/components/builds/BuildsIndexTabPage.vue'
import { useBuildStore } from '~/stores/BuildStore'
import { hydrateBuild, isStoredBuild } from '~/utils/buildSerialize'
import { teamBuildActions, teamBuildGuides, teamVisibilityRequest } from '~/utils/sharedBuildSync'
import { useMatchupGuideStore } from '~/stores/MatchupGuideStore'

definePageMeta({ key: 'builds-team' })

const { t } = useI18n()
const localePath = useLocalePath()
const { session, role, authFetch } = useUserSession()
const buildStore = useBuildStore()
const loaded = ref(false)
onMounted(() => {
  loaded.value = true
})

useSeoMeta({ robots: 'noindex' })

const builds = ref<Build[]>([])
const guides = ref<MatchupGuide[]>([])
const matchupGuideStore = useMatchupGuideStore()
const loading = ref(false)
const error = ref('')
const actions = computed(() => teamBuildActions(role.value))

async function load() {
  if (!session.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await authFetch('/api/shared-builds')
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { builds?: unknown[] }
    guides.value = teamBuildGuides(data.builds)
    for (const guide of guides.value) matchupGuideStore.upsertGuideLocal(guide)
    builds.value = (data.builds ?? []).map(b => (isStoredBuild(b) ? hydrateBuild(b) : (b as Build)))
  } catch {
    error.value = t('buildsPage.teamLoadError')
  } finally {
    loading.value = false
  }
}

async function toggleVisibility(id: string) {
  const build = builds.value.find(b => b.id === id)
  if (!build || !actions.value.canChangeVisibility) return
  const action = teamVisibilityRequest(build.visibility)
  const res = await authFetch(`/api/shared-builds/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
  })
  if (!res.ok) {
    error.value = t('buildsPage.teamActionError')
    return
  }
  build.visibility = action === 'publish' ? 'public' : 'private'
}

async function removeBuild(id: string) {
  if (!actions.value.canDelete || !confirm(t('buildsPage.teamDeleteConfirm'))) return
  const res = await authFetch(`/api/shared-builds/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    error.value = t('buildsPage.teamActionError')
    return
  }
  builds.value = builds.value.filter(b => b.id !== id)
}

/** L'éditeur lit les builds du navigateur : y copier le build d'équipe avant d'ouvrir l'édition. */
function prepareEdit(id: string) {
  const build = builds.value.find(b => b.id === id)
  if (build) buildStore.upsertImportedBuild({ ...build, teamShared: true })
}

watch(session, s => s && load(), { immediate: true })
</script>
