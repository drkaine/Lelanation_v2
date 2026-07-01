<template>
  <section class="space-y-6">
    <div class="ui-build-card-surface rounded-lg p-4">
      <h3 class="text-sm font-semibold text-text-accent">
        {{ t('buildsPage.shareCodeTitle') }}
      </h3>
      <p class="mt-1 text-sm text-text/70">
        {{ t('buildsPage.shareCodeDescription') }}
      </p>

      <div v-if="shareLoading" class="mt-4 text-sm text-text/60">
        {{ t('buildsPage.shareLoading') }}
      </div>
      <template v-else>
        <div
          v-if="shareCode"
          class="mt-4 flex w-fit max-w-full flex-wrap items-center gap-3 rounded-lg border-2 border-accent bg-background px-4 py-3 font-mono text-lg font-bold tracking-[0.25em] text-accent sm:text-xl"
        >
          {{ shareCode }}
          <button
            type="button"
            class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-1 text-text/60 transition-colors hover:text-accent"
            :aria-label="t('buildsPage.shareCodeCopy')"
            :title="t('buildsPage.shareCodeCopy')"
            @click="copyShareCode()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
        <p v-else class="mt-4 text-sm text-text/60">
          {{ t('buildsPage.shareNoBuilds') }}
        </p>
      </template>

      <p v-if="shareCopied" class="mt-2 text-sm text-emerald-300">
        {{ t('buildsPage.shareCodeCopied') }}
      </p>
      <p class="mt-3 text-xs text-text/55">
        {{ t('buildsPage.shareCodeExpiry') }}
      </p>
      <button
        type="button"
        class="ui-build-card-button mt-3 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
        :disabled="shareLoading"
        @click="shareBuilds()"
      >
        {{ t('buildsPage.shareCodeRegenerate') }}
      </button>
    </div>

    <div class="ui-build-card-surface rounded-lg p-4">
      <h3 class="text-sm font-semibold text-text-accent">
        {{ t('buildsPage.importCodeTitle') }}
      </h3>
      <p class="mt-1 text-sm text-text/70">
        {{ t('buildsPage.importCodeBlurb') }}
      </p>
      <input
        :value="importCode"
        type="text"
        class="mt-3 w-full rounded-lg border border-primary/60 bg-background px-3 py-2 font-mono text-sm text-text"
        :placeholder="t('buildsPage.shareCodeInputPlaceholder')"
        maxlength="24"
        @input="importCode = ($event.target as HTMLInputElement).value.toUpperCase()"
        @keyup.enter="importBuildsByCode()"
      />
      <button
        type="button"
        class="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-accent-dark disabled:opacity-50"
        :disabled="importLoading || !importCode.trim()"
        @click="importBuildsByCode()"
      >
        {{ importLoading ? t('buildsPage.shareLoading') : t('buildsPage.shareCodeImportAction') }}
      </button>
      <p v-if="importSuccess" class="mt-2 text-sm text-emerald-300">
        {{ t('buildsPage.importCodeSuccess') }}
      </p>
    </div>

    <p v-if="shareError" class="rounded-lg bg-error/90 px-4 py-3 text-sm text-white">
      {{ shareError }}
    </p>

    <p class="text-xs text-text/55">
      {{ t('statisticsPage.settingsDataTransferCompanionNote') }}
      <NuxtLink :to="localePath('/download')" class="text-accent underline hover:text-accent-dark">
        {{ t('statisticsPage.settingsDataTransferCompanionLink') }}
      </NuxtLink>
    </p>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const localePath = useLocalePath()
const {
  shareCode,
  importCode,
  shareLoading,
  importLoading,
  shareError,
  shareCopied,
  importSuccess,
  shareBuilds,
  copyShareCode,
  importBuildsByCode,
} = useBuildShareTransfer()

onMounted(() => {
  if (import.meta.client) shareBuilds()
})
</script>
