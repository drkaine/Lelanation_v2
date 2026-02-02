<template>
  <div class="admin-login flex min-h-screen flex-col items-center justify-center p-4 text-text">
    <div class="w-full max-w-sm rounded-lg border border-primary/30 bg-surface/50 p-6 shadow-lg">
      <h1 class="mb-6 text-xl font-bold text-text-accent">{{ t('admin.login.title') }}</h1>
      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label for="admin-username" class="mb-1 block text-sm font-medium text-text">
            {{ t('admin.login.username') }}
          </label>
          <input
            id="admin-username"
            v-model="username"
            type="text"
            autocomplete="username"
            required
            class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text"
          />
        </div>
        <div>
          <label for="admin-password" class="mb-1 block text-sm font-medium text-text">
            {{ t('admin.login.password') }}
          </label>
          <input
            id="admin-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full rounded border border-primary/50 bg-background px-3 py-2 text-text"
          />
        </div>
        <p v-if="error" class="text-sm text-error">{{ error }}</p>
        <button
          type="submit"
          class="w-full rounded bg-accent px-4 py-2 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          :disabled="loading"
        >
          {{ loading ? '…' : t('admin.login.submit') }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { apiUrl } from '~/utils/apiUrl'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const localePath = useLocalePath()
const { setAuth, checkLoggedIn } = useAdminAuth()

const username = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

onMounted(() => {
  if (checkLoggedIn()) {
    navigateTo(localePath('/admin'))
  }
})

async function submit() {
  error.value = null
  loading.value = true
  try {
    const token = btoa(`${username.value}:${password.value}`)
    const res = await fetch(apiUrl('/api/admin/me'), {
      headers: { Authorization: `Basic ${token}` },
    })
    if (!res.ok) {
      error.value = t('admin.login.invalid')
      return
    }
    setAuth(username.value, password.value)
    await navigateTo(localePath('/admin'))
  } catch {
    error.value = t('admin.login.error')
  } finally {
    loading.value = false
  }
}
</script>
