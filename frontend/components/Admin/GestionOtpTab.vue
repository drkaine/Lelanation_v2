<template>
  <section class="rounded-lg border border-primary/30 bg-surface/40 p-5">
    <h2 class="mb-4 text-lg font-semibold">{{ t('gestion.otp.title') }}</h2>
    <p v-if="loading" class="text-sm text-text/70">{{ t('gestion.otp.loading') }}</p>
    <template v-else>
      <p class="mb-4 rounded border border-accent/60 px-3 py-2 text-sm" role="note">
        {{ t('gestion.otp.scheduleNote') }}
      </p>
      <div class="mb-6 grid gap-4 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          {{ t('gestion.otp.threshold') }}
          <input
            v-model.number="settings.thresholdPct"
            type="number"
            min="1"
            max="100"
            step="1"
            class="rounded border border-primary/30 bg-background px-2 py-1"
            :disabled="busy"
          />
          <span class="text-xs text-text/70">{{ t('gestion.otp.thresholdNote') }}</span>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          {{ t('gestion.otp.minGames') }}
          <input
            v-model.number="settings.minGames"
            type="number"
            min="1"
            step="1"
            class="rounded border border-primary/30 bg-background px-2 py-1"
            :disabled="busy"
          />
          <span class="text-xs text-text/70">{{ t('gestion.otp.minGamesNote') }}</span>
        </label>
      </div>
      <p
        v-if="message"
        class="mb-3 rounded border px-3 py-2 text-sm"
        :class="message.error ? 'border-error text-error' : 'border-accent/60'"
        role="status"
      >
        {{ message.text }}
      </p>
      <button
        type="button"
        class="rounded border border-accent px-4 py-2 text-sm font-semibold hover:bg-surface disabled:opacity-50"
        :disabled="busy || !otpSettingsValid(settings)"
        @click="save"
      >
        {{ t('gestion.otp.save') }}
      </button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useUserSession } from '~/composables/useUserSession'
import {
  DEFAULT_OTP_SETTINGS,
  otpSettingsValid,
  parseOtpSettings,
  type OtpSettings,
} from '~/utils/otpSettings'

const { t } = useI18n()
const { authFetch } = useUserSession()

const loading = ref(true)
const busy = ref(false)
const settings = ref<OtpSettings>({ ...DEFAULT_OTP_SETTINGS })
const message = ref<{ text: string; error: boolean } | null>(null)

async function load() {
  loading.value = true
  try {
    const res = await authFetch('/api/admin/otp-settings')
    if (!res.ok) throw new Error('load')
    settings.value = parseOtpSettings(await res.json())
  } catch {
    message.value = { text: t('gestion.otp.loadError'), error: true }
  } finally {
    loading.value = false
  }
}

async function save() {
  busy.value = true
  message.value = null
  try {
    const put = await authFetch('/api/admin/otp-settings', {
      method: 'PUT',
      body: JSON.stringify(settings.value),
    })
    if (!put.ok) throw new Error('invalid')
    settings.value = parseOtpSettings(await put.json())
    message.value = { text: t('gestion.otp.saved'), error: false }
  } catch {
    message.value = { text: t('gestion.otp.saveError'), error: true }
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>
