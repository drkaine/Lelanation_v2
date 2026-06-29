<template>
  <ShowIf :show-if="isAdmin">
    <div class="matchup-sheets-create min-h-screen px-[10px] pb-8 pt-4 text-text">
      <div class="mx-auto max-w-lg text-center">
        <NuxtLink
          :to="localePath('/matchups/sheets/discover')"
          class="mb-6 inline-flex items-center gap-1 text-sm text-text-secondary transition-colors hover:text-text"
        >
          {{ t('matchupGuidePage.backToSheets') }}
        </NuxtLink>
        <h1 class="text-xl font-bold text-text-accent">{{ t('matchupGuidePage.createGuide') }}</h1>
        <p class="mt-3 text-sm text-text-secondary">{{ t('matchupGuidePage.createComingSoon') }}</p>
      </div>
    </div>
  </ShowIf>
</template>

<script setup lang="ts">
import ShowIf from '~/components/ShowIf.vue'
import { useAdminAuth } from '~/composables/useAdminAuth'

definePageMeta({
  middleware: 'matchup-guides-admin',
})

const { t } = useI18n()
const localePath = useLocalePath()
const { isLoggedIn: isAdmin } = useAdminAuth()
</script>
