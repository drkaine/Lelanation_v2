<template>
  <div class="flex min-h-[70vh] flex-col items-center justify-center p-4 text-text">
    <div class="w-full max-w-sm rounded-lg border border-primary/30 bg-surface/50 p-6 shadow-lg">
      <h1 class="mb-2 text-xl font-bold text-text-accent">{{ t('auth.register.title') }}</h1>
      <p class="mb-6 text-sm text-text/70">{{ t('auth.register.intro') }}</p>
      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <label for="reg-code" class="mb-1 block text-sm font-medium">{{
            t('auth.register.code')
          }}</label>
          <input
            id="reg-code"
            v-model.trim="code"
            type="text"
            autocomplete="off"
            required
            class="w-full rounded border border-primary/50 bg-background px-3 py-2 font-mono"
          />
        </div>
        <div>
          <label for="reg-username" class="mb-1 block text-sm font-medium">{{
            t('auth.register.username')
          }}</label>
          <input
            id="reg-username"
            v-model.trim="username"
            type="text"
            autocomplete="username"
            required
            class="w-full rounded border border-primary/50 bg-background px-3 py-2"
          />
        </div>
        <div>
          <label for="reg-password" class="mb-1 block text-sm font-medium">{{
            t('auth.register.password')
          }}</label>
          <input
            id="reg-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
            class="w-full rounded border border-primary/50 bg-background px-3 py-2"
          />
          <p class="mt-1 text-xs text-text/60">{{ t('auth.register.passwordHint') }}</p>
        </div>
        <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>
        <button
          type="submit"
          class="w-full rounded bg-accent px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
          :disabled="loading"
        >
          {{ loading ? '…' : t('auth.register.submit') }}
        </button>
      </form>
      <p class="mt-4 text-center text-sm text-text/70">
        <NuxtLink :to="localePath('/admin/login')" class="text-accent hover:underline">
          {{ t('auth.loginLink') }}
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserSession } from '~/composables/useUserSession'
import { apiUrl } from '~/utils/apiUrl'
import { parseStoredSession, postLoginPath, registerErrorKey } from '~/utils/userSession'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const { setSession } = useUserSession()

useHead({ title: () => t('auth.register.title'), meta: [{ name: 'robots', content: 'noindex' }] })

const code = ref(typeof route.query.code === 'string' ? route.query.code : '')
const username = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function submit() {
  error.value = null
  loading.value = true
  try {
    const res = await fetch(apiUrl('/api/users/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code.value,
        username: username.value,
        password: password.value,
      }),
    })
    const body: unknown = await res.json().catch(() => null)
    const session = res.ok ? parseStoredSession(JSON.stringify(body)) : null
    if (!session) {
      const errCode = res.status === 429 ? 'TOO_MANY' : (body as { error?: unknown } | null)?.error
      error.value =
        errCode === 'TOO_MANY' ? t('admin.login.tooManyAttempts') : t(registerErrorKey(errCode))
      return
    }
    setSession(session)
    await navigateTo(localePath(postLoginPath(session.user.role)))
  } catch {
    error.value = t('auth.errors.generic')
  } finally {
    loading.value = false
  }
}
</script>
