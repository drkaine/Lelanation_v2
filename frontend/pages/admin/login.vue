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
      <p class="mt-4 text-center text-sm text-text/70">
        {{ t('auth.haveCode') }}
        <NuxtLink :to="localePath('/inscription')" class="text-accent hover:underline">
          {{ t('auth.registerLink') }}
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserSession } from '~/composables/useUserSession'
import { apiUrl } from '~/utils/apiUrl'
import { isLoginEndpointMissing } from '~/utils/teamAccess'
import { parseStoredSession, postLoginPath } from '~/utils/userSession'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { setAuth, checkLoggedIn } = useAdminAuth()
const { setSession } = useUserSession()

const username = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

/** Retour vers la page demandée (chemin interne seulement). */
function redirectTarget(fallback: string): string {
  const r = route.query.redirect
  return typeof r === 'string' && r.startsWith('/') && !r.startsWith('//')
    ? r
    : localePath(fallback)
}

onMounted(() => {
  if (checkLoggedIn()) {
    navigateTo(redirectTarget('/admin'))
  }
})

/** Ancien backend sans /api/users : vérification Basic sur /api/admin/me. */
async function basicLogin(): Promise<boolean> {
  const token = toBasicToken(username.value, password.value)
  const res = await fetch(apiUrl('/api/admin/me'), {
    headers: { Authorization: `Basic ${token}` },
  })
  if (res.status === 429) {
    error.value = t('admin.login.tooManyAttempts')
    return false
  }
  if (!res.ok) {
    error.value = t('admin.login.invalid')
    return false
  }
  setAuth(username.value, password.value)
  return true
}

async function submit() {
  error.value = null
  loading.value = true
  try {
    const res = await fetch(apiUrl('/api/users/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    })
    if (isLoginEndpointMissing(res.status)) {
      if (await basicLogin()) await navigateTo(localePath('/admin'))
      return
    }
    if (res.status === 429) {
      error.value = t('admin.login.tooManyAttempts')
      return
    }
    const session = res.ok ? parseStoredSession(JSON.stringify(await res.json())) : null
    if (!session) {
      error.value = t('admin.login.invalid')
      return
    }
    setSession(session)
    await navigateTo(redirectTarget(postLoginPath(session.user.role)))
  } catch {
    error.value = t('admin.login.error')
  } finally {
    loading.value = false
  }
}
</script>
