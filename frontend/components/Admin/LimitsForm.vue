<template>
  <section class="rounded-lg border border-primary/30 bg-surface/40 p-5">
    <h2 class="mb-2 text-lg font-semibold">{{ t(`${prefix}.title`) }}</h2>
    <p class="mb-4 text-sm text-text/70">{{ t(`${prefix}.description`) }}</p>
    <p v-if="loading" class="text-sm text-text/70">{{ t('gestion.limits.loading') }}</p>
    <template v-else>
      <div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label v-for="spec in specs" :key="spec.key" class="flex flex-col gap-1 text-sm">
          {{ t(`${prefix}.fields.${spec.key}`) }}
          <input
            v-model.number="values[spec.key]"
            type="number"
            :min="spec.min"
            :max="spec.max"
            :step="spec.step"
            class="rounded border border-primary/30 bg-background px-2 py-1"
            :disabled="busy"
          />
          <span class="text-xs text-text/70">{{ t(`${prefix}.notes.${spec.key}`) }}</span>
        </label>
      </div>
      <p v-if="!valid" class="mb-3 text-sm text-error" role="alert">
        {{ t('gestion.limits.invalid') }}
      </p>
      <p
        v-if="message"
        class="mb-3 rounded border px-3 py-2 text-sm"
        :class="message.error ? 'border-error text-error' : 'border-accent/60'"
        role="status"
      >
        {{ message.text }}
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded border border-accent px-4 py-2 text-sm font-semibold hover:bg-surface disabled:opacity-50"
          :disabled="busy || !valid"
          @click="save"
        >
          {{ t('gestion.limits.save') }}
        </button>
        <button
          v-if="defaults"
          type="button"
          class="rounded border border-primary/30 px-4 py-2 text-sm hover:bg-surface disabled:opacity-50"
          :disabled="busy"
          @click="resetDefaults"
        >
          {{ t('gestion.limits.defaults') }}
        </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useAdminAuth } from '~/composables/useAdminAuth'
import { apiUrl } from '~/utils/apiUrl'
import { limitsValid, parseLimitsResponse, type LimitFieldSpec } from '~/utils/limitsSettings'

const props = defineProps<{
  endpoint: string
  prefix: string
  specs: ReadonlyArray<LimitFieldSpec<string>>
  defaults?: Record<string, number>
}>()

const { t } = useI18n()
const { fetchWithAuth } = useAdminAuth()

const loading = ref(true)
const busy = ref(false)
const values = ref<Record<string, number>>({ ...props.defaults })
const message = ref<{ text: string; error: boolean } | null>(null)
const valid = computed(() => limitsValid(props.specs, values.value))

async function load() {
  loading.value = true
  try {
    const res = await fetchWithAuth(apiUrl(props.endpoint))
    const parsed = res.ok ? parseLimitsResponse(props.specs, await res.json()) : null
    if (!parsed) throw new Error('load')
    values.value = parsed
  } catch {
    message.value = { text: t('gestion.limits.loadError'), error: true }
  } finally {
    loading.value = false
  }
}

function resetDefaults() {
  values.value = { ...props.defaults }
  message.value = null
}

async function save() {
  busy.value = true
  message.value = null
  try {
    const res = await fetchWithAuth(apiUrl(props.endpoint), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values.value),
    })
    const parsed = res.ok ? parseLimitsResponse(props.specs, await res.json()) : null
    if (!parsed) throw new Error('save')
    values.value = parsed
    message.value = { text: t('gestion.limits.saved'), error: false }
  } catch {
    message.value = { text: t('gestion.limits.saveError'), error: true }
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>
